import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  Bell,
  CalendarDays,
  ChevronRight,
  CircleDot,
  Clock3,
  Flag,
  LogOut,
  MapPin,
  Pencil,
  ShieldAlert,
  Star,
  Trophy,
  Users,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import heroImage from "@/assets/matches-hero.jpg";
import { AppShell } from "@/components/app/app-shell";
import { MatchDrawer } from "@/components/app/match-drawer";
import { PlayerAvatar } from "@/components/app/player-avatar";
import { ErrorState } from "@/components/app/states";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ensureCurrentProfile,
  fetchMatches,
  fetchPlayerPublicStats,
  updateProfile,
} from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { effectiveStatus, playerCount } from "@/lib/match-utils";
import { friendlyError, supabase } from "@/lib/supabase";
import type { MatchWithRelations } from "@/lib/types";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({
    meta: [
      { title: "Perfil do jogador — The Match" },
      {
        name: "description",
        content: "Seu perfil no The Match com partidas, nota, gols e cartões registrados.",
      },
      { property: "og:title", content: "Perfil do jogador — The Match" },
      {
        property: "og:description",
        content: "Partidas e desempenho real do jogador no The Match.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ProfilePage,
});

type ProfileTab = "matches" | "performance";

function formatMatchDate(match: MatchWithRelations) {
  const date = new Date(match.scheduled_at ?? match.created_at);
  const today = new Date();
  const tomorrow = new Date();
  tomorrow.setDate(today.getDate() + 1);
  const day = date.toDateString() === today.toDateString()
    ? "Hoje"
    : date.toDateString() === tomorrow.toDateString()
      ? "Amanhã"
      : date.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
  const time = date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  return `${day} • ${time}`;
}

function matchLabel(match: MatchWithRelations) {
  return match.name ?? (match.match_type === "campeonato" ? "Jogo de campeonato" : "Futebol society");
}

function statusLabel(match: MatchWithRelations) {
  const status = effectiveStatus(match);
  if (status === "finished") return "Finalizada";
  if (status === "cancelled") return "Cancelada";
  const start = new Date(match.scheduled_at ?? match.created_at).getTime();
  return start > Date.now() ? "Confirmada" : "Ao vivo";
}

function ProfileSkeleton() {
  return (
    <div className="space-y-6 px-4 pt-safe">
      <div className="flex items-start justify-between pt-4">
        <div className="size-16 animate-pulse rounded-full bg-surface-2" />
        <div className="size-12 animate-pulse rounded-full bg-surface-2" />
      </div>
      <div className="space-y-2">
        <div className="h-9 w-48 animate-pulse rounded-xl bg-surface-2" />
        <div className="h-4 w-32 animate-pulse rounded-lg bg-surface-2" />
      </div>
      <div className="h-14 animate-pulse rounded-full bg-surface-2" />
      <div className="aspect-[4/5] animate-pulse rounded-[2rem] bg-surface-2" />
    </div>
  );
}

function MatchHero({ match, onOpen }: { match: MatchWithRelations; onOpen: () => void }) {
  const finished = effectiveStatus(match) === "finished";
  const photo = match.venue?.photo_url || heroImage;
  return (
    <Button
      type="button"
      variant="ghost"
      onClick={onOpen}
      className="press elevate-float group relative h-auto min-h-[420px] w-full overflow-hidden rounded-[2.25rem] border border-border/70 p-0 text-left"
    >
      <img
        src={photo}
        alt={match.venue?.name ? `Partida em ${match.venue.name}` : "Partida de futebol"}
        className="absolute inset-0 size-full object-cover transition-transform duration-500 group-hover:scale-[1.02]"
      />
      <div className="absolute inset-0 bg-gradient-to-b from-background/15 via-background/5 to-background" />
      <div className="absolute inset-x-0 top-0 flex items-center justify-between p-5">
        <div className="flex -space-x-2">
          {match.participants.filter((participant) => participant.role === "player").slice(0, 3).map((participant) => (
            <PlayerAvatar
              key={participant.id}
              name={participant.profile?.full_name ?? "Jogador"}
              nickname={participant.profile?.nickname}
              photoUrl={participant.profile?.avatar_url}
              size="sm"
              className="border-card"
            />
          ))}
          {playerCount(match) > 3 ? (
            <span className="grid size-9 place-items-center rounded-full border-2 border-card bg-primary text-[10px] font-bold text-primary-foreground">
              +{playerCount(match) - 3}
            </span>
          ) : null}
        </div>
        <span className="rounded-full border border-border/60 bg-background/75 px-4 py-2 text-xs font-bold text-foreground backdrop-blur-xl">
          {statusLabel(match)}
        </span>
      </div>
      <div className="absolute inset-x-0 bottom-0 p-6">
        <p className="text-xs font-bold tracking-wider text-primary uppercase">
          {match.match_type === "campeonato" ? "Campeonato" : "Pelada"}
        </p>
        <h2 className="text-display mt-1 w-full whitespace-normal break-words text-2xl leading-tight font-bold text-foreground [overflow-wrap:anywhere] sm:text-4xl">
          {matchLabel(match)}
        </h2>
        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-foreground/85">
          <span className="flex items-center gap-1.5"><Clock3 className="size-4 text-primary" />{formatMatchDate(match)}</span>
          <span className="flex items-center gap-1.5"><Users className="size-4 text-primary" />{playerCount(match)} jogadores</span>
        </div>
        <div className="mt-3 flex items-end justify-between gap-4">
          <p className="flex min-w-0 items-center gap-1.5 text-sm text-foreground/80">
            <MapPin className="size-4 shrink-0 text-primary" />
            <span className="truncate">{match.venue?.name ?? "Local não informado"}</span>
          </p>
          {finished ? (
            <span className="text-display shrink-0 text-3xl font-bold text-foreground tabular-nums">
              {match.score_team_a} × {match.score_team_b}
            </span>
          ) : (
            <span className="grid size-11 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground">
              <ChevronRight className="size-5" />
            </span>
          )}
        </div>
      </div>
    </Button>
  );
}

function CompactMatchCard({ match, onOpen }: { match: MatchWithRelations; onOpen: () => void }) {
  return (
    <Button
      type="button"
      variant="ghost"
      onClick={onOpen}
      className="press h-auto w-full justify-start gap-4 rounded-[1.75rem] border border-border/60 bg-card p-3 text-left shadow-[var(--shadow-soft)]"
    >
      <div className="relative size-24 shrink-0 overflow-hidden rounded-[1.35rem]">
        <img src={match.venue?.photo_url || heroImage} alt="" className="size-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-background/75 to-transparent" />
        {effectiveStatus(match) === "finished" ? (
          <span className="text-display absolute inset-x-0 bottom-2 text-center text-xl font-bold text-foreground tabular-nums">
            {match.score_team_a} × {match.score_team_b}
          </span>
        ) : null}
      </div>
      <div className="min-w-0 flex-1 py-1">
        <p className="text-[10px] font-bold tracking-wider text-primary uppercase">{statusLabel(match)}</p>
        <h3 className="mt-1 truncate text-base font-bold text-foreground">{matchLabel(match)}</h3>
        <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground"><CalendarDays className="size-3.5" />{formatMatchDate(match)}</p>
        <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground"><MapPin className="size-3.5" /><span className="truncate">{match.venue?.name ?? "Local não informado"}</span></p>
      </div>
      <ChevronRight className="size-5 shrink-0 text-muted-foreground" />
    </Button>
  );
}

function ProfilePage() {
  const { user, profile, profileLoading, loading: authLoading, refetchProfile } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<ProfileTab>("matches");
  const [editing, setEditing] = useState(false);
  const [selectedMatch, setSelectedMatch] = useState<string | null>(null);
  const [nickname, setNickname] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");

  const metadata = user?.user_metadata;
  const accountFullName = profile?.full_name || (typeof metadata?.["full_name"] === "string" ? metadata["full_name"] : "") || user?.email?.split("@")[0] || "Boleiro";
  const accountNickname = profile?.nickname || (typeof metadata?.["nickname"] === "string" ? metadata["nickname"] : "") || accountFullName.split(" ")[0] || "Boleiro";
  const accountCity = profile?.city || (typeof metadata?.["city"] === "string" ? metadata["city"] : "");
  const accountState = profile?.state || (typeof metadata?.["state"] === "string" ? metadata["state"] : "");
  const accountAvatar = profile?.avatar_url || (typeof metadata?.["avatar_url"] === "string" ? metadata["avatar_url"] : null);

  useEffect(() => {
    if (!user) return;
    setNickname(accountNickname);
    setCity(accountCity);
    setState(accountState);
  }, [user, accountNickname, accountCity, accountState]);

  const matchesQuery = useQuery({
    queryKey: ["profile-matches", user?.id],
    enabled: Boolean(user?.id),
    queryFn: async () => {
      const matches = await fetchMatches();
      return matches
        .filter((match) => match.participants.some((participant) => participant.user_id === user?.id))
        .sort((a, b) => new Date(b.scheduled_at ?? b.created_at).getTime() - new Date(a.scheduled_at ?? a.created_at).getTime());
    },
  });

  const statsQuery = useQuery({
    queryKey: ["player-public-stats", user?.id],
    enabled: Boolean(user?.id),
    queryFn: () => fetchPlayerPublicStats(user?.id ?? ""),
  });

  const save = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error("Sua conta ainda não carregou.");
      await ensureCurrentProfile();
      await updateProfile(user.id, { nickname, city, state: state.toUpperCase() });
    },
    onSuccess: async () => {
      toast.success("Perfil atualizado.");
      setEditing(false);
      await queryClient.invalidateQueries({ queryKey: ["profile"] });
      await refetchProfile();
    },
    onError: (error) => toast.error(friendlyError(error)),
  });

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    void navigate({ to: "/auth", replace: true });
  }

  const matches = matchesQuery.data ?? [];
  const featuredMatch = matches[0] ?? null;
  const otherMatches = matches.slice(1);
  const stats = statsQuery.data;
  const totalCards = (stats?.yellow_cards ?? 0) + (stats?.red_cards ?? 0);
  const metricCards = useMemo(() => {
    const items = [
      ...(stats && stats.ratings_count > 0 ? [{ label: "Nota média", value: stats.avg_score.toFixed(1), icon: Star, tone: "text-gold" }] : []),
      { label: "Jogos", value: String(stats?.matches_played ?? 0), icon: Trophy, tone: "text-primary" },
      { label: "Gols", value: String(stats?.goals ?? 0), icon: CircleDot, tone: "text-primary" },
      { label: "Cartões", value: String(totalCards), icon: Flag, tone: "text-gold" },
    ];
    return items;
  }, [stats, totalCards]);

  const loading = authLoading || profileLoading || (Boolean(user) && (matchesQuery.isPending || statsQuery.isPending));

  return (
    <AppShell title="Perfil" bare>
      <div className="radar-immersive -mb-32 min-h-dvh overflow-x-hidden pb-40">
        <div className="mx-auto max-w-2xl">
          {loading ? <ProfileSkeleton /> : !user ? (
            <div className="px-4 pt-safe">
              <div className="mt-16 rounded-[2rem] border border-border bg-card p-6 text-center">
                <ShieldAlert className="mx-auto size-8 text-primary" />
                <h1 className="text-display mt-4 text-2xl font-bold text-foreground">Perfil não encontrado</h1>
                <p className="mt-2 text-sm text-muted-foreground">Não foi possível carregar sua conta agora.</p>
                <Button className="mt-6 h-12 w-full rounded-full" onClick={() => void refetchProfile()}>Tentar novamente</Button>
              </div>
            </div>
          ) : (
            <>
              <header className="px-4 pt-safe">
                <div className="flex items-start justify-between pt-4">
                  <PlayerAvatar name={accountFullName} nickname={accountNickname} photoUrl={accountAvatar} size="lg" className="elevate-float border-primary/70" />
                  <Button type="button" variant="secondary" size="icon" aria-label="Notificações" className="size-12 rounded-full border border-border/70 bg-secondary/80 backdrop-blur-xl">
                    <Bell className="size-5" />
                  </Button>
                </div>
                <div className="mt-6 flex items-end justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold tracking-wider text-primary uppercase">Meu perfil</p>
                    <h1 className="text-display mt-1 truncate text-4xl leading-none font-bold text-foreground">{accountNickname}</h1>
                    <p className="mt-2 truncate text-sm text-muted-foreground">
                      {accountFullName}{accountCity ? ` • ${accountCity}${accountState ? ` / ${accountState}` : ""}` : ""}
                    </p>
                  </div>
                  <Button type="button" variant="secondary" size="icon" aria-label="Editar perfil" onClick={() => setEditing(true)} className="size-11 shrink-0 rounded-full border border-border/70">
                    <Pencil className="size-4" />
                  </Button>
                </div>
              </header>

              <div className="px-4">
                <div className="mt-7 grid grid-cols-2 rounded-full border border-border/70 bg-secondary/70 p-1.5 backdrop-blur-xl">
                  <Button type="button" variant={tab === "matches" ? "default" : "ghost"} onClick={() => setTab("matches")} className="h-11 rounded-full text-sm font-bold">Meus Jogos</Button>
                  <Button type="button" variant={tab === "performance" ? "default" : "ghost"} onClick={() => setTab("performance")} className="h-11 rounded-full text-sm font-bold">Desempenho</Button>
                </div>
              </div>

              {tab === "matches" ? (
                <main className="px-4 pt-6">
                  {matchesQuery.isError ? (
                    <ErrorState message={friendlyError(matchesQuery.error)} onRetry={() => void matchesQuery.refetch()} />
                  ) : featuredMatch ? (
                    <>
                      <MatchHero match={featuredMatch} onOpen={() => setSelectedMatch(featuredMatch.id)} />
                      {otherMatches.length > 0 ? (
                        <section className="mt-8">
                          <div className="mb-4 flex items-end justify-between gap-3">
                            <div>
                              <p className="text-xs font-semibold tracking-wider text-primary uppercase">Histórico</p>
                              <h2 className="text-display text-2xl font-bold text-foreground">Outras partidas</h2>
                            </div>
                            <span className="text-sm text-muted-foreground tabular-nums">{otherMatches.length}</span>
                          </div>
                          <div className="space-y-3">
                            {otherMatches.map((match) => <CompactMatchCard key={match.id} match={match} onOpen={() => setSelectedMatch(match.id)} />)}
                          </div>
                        </section>
                      ) : null}
                    </>
                  ) : (
                    <div className="rounded-[2rem] border border-border/70 bg-card p-7 text-center shadow-[var(--shadow-raised)]">
                      <CalendarDays className="mx-auto size-9 text-primary" />
                      <h2 className="text-display mt-4 text-2xl font-bold text-foreground">Nenhum jogo ainda</h2>
                      <p className="mx-auto mt-2 max-w-xs text-sm leading-relaxed text-muted-foreground">Quando você entrar em uma partida, ela aparecerá aqui com os dados reais do jogo.</p>
                      <Button className="mt-6 h-12 rounded-full px-6" onClick={() => void navigate({ to: "/matches" })}>Encontrar partidas</Button>
                    </div>
                  )}
                </main>
              ) : (
                <main className="px-4 pt-6">
                  {statsQuery.isError ? (
                    <ErrorState message={friendlyError(statsQuery.error)} onRetry={() => void statsQuery.refetch()} />
                  ) : (
                    <>
                      <section className="rounded-[2rem] border border-border/70 bg-card p-6 shadow-[var(--shadow-float)]">
                        <p className="text-xs font-semibold tracking-wider text-primary uppercase">Desempenho real</p>
                        <div className="mt-5 flex items-end justify-between gap-4">
                          <div>
                            <p className="text-display text-6xl leading-none font-bold text-foreground tabular-nums">{stats?.matches_played ?? 0}</p>
                            <p className="mt-2 text-sm text-muted-foreground">partidas registradas</p>
                          </div>
                          {stats && stats.ratings_count > 0 ? (
                            <div className="rounded-[1.4rem] bg-secondary px-5 py-4 text-right">
                              <div className="flex items-center justify-end gap-1.5 text-gold"><Star className="size-5 fill-current" /><span className="text-display text-3xl font-bold tabular-nums">{stats.avg_score.toFixed(1)}</span></div>
                              <p className="mt-1 text-[11px] text-muted-foreground">{stats.ratings_count} avaliações</p>
                            </div>
                          ) : null}
                        </div>
                      </section>
                      <section className="mt-8">
                        <h2 className="text-display text-2xl font-bold text-foreground">Suas estatísticas</h2>
                        <div className="-mx-4 mt-4 flex gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                          {metricCards.map(({ label, value, icon: Icon, tone }) => (
                            <article key={label} className="w-36 shrink-0 rounded-[1.65rem] border border-border/60 bg-card p-5 shadow-[var(--shadow-soft)]">
                              <Icon className={`size-5 ${tone}`} />
                              <p className="text-display mt-6 text-4xl font-bold text-foreground tabular-nums">{value}</p>
                              <p className="mt-1 text-xs text-muted-foreground">{label}</p>
                            </article>
                          ))}
                        </div>
                      </section>
                      <section className="mt-7 grid grid-cols-2 gap-3">
                        <div className="rounded-[1.6rem] border border-border/60 bg-card p-5">
                          <Flag className="size-5 text-gold" />
                          <p className="text-display mt-4 text-3xl font-bold text-foreground tabular-nums">{stats?.yellow_cards ?? 0}</p>
                          <p className="text-xs text-muted-foreground">Cartões amarelos</p>
                        </div>
                        <div className="rounded-[1.6rem] border border-border/60 bg-card p-5">
                          <Flag className="size-5 text-destructive" />
                          <p className="text-display mt-4 text-3xl font-bold text-foreground tabular-nums">{stats?.red_cards ?? 0}</p>
                          <p className="text-xs text-muted-foreground">Cartões vermelhos</p>
                        </div>
                      </section>
                    </>
                  )}
                </main>
              )}

              <div className="px-4 pt-8">
                <Button variant="ghost" className="h-12 w-full rounded-full text-destructive hover:bg-destructive/10" onClick={() => void signOut()}>
                  <LogOut className="size-4" /> Sair da conta
                </Button>
              </div>
            </>
          )}
        </div>
      </div>

      <Dialog open={editing} onOpenChange={setEditing}>
        <DialogContent className="w-[calc(100%-2rem)] rounded-[2rem] border-border bg-card p-5">
          <DialogHeader>
            <DialogTitle className="text-display text-2xl">Editar perfil</DialogTitle>
            <DialogDescription>Atualize somente os dados públicos do seu jogador.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div><Label htmlFor="nick">Apelido</Label><Input id="nick" className="mt-1 h-12 rounded-xl bg-surface-2" value={nickname} onChange={(event) => setNickname(event.target.value)} /></div>
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2"><Label htmlFor="city">Cidade</Label><Input id="city" className="mt-1 h-12 rounded-xl bg-surface-2" value={city} onChange={(event) => setCity(event.target.value)} /></div>
              <div><Label htmlFor="state">UF</Label><Input id="state" maxLength={2} className="mt-1 h-12 rounded-xl bg-surface-2 uppercase" value={state} onChange={(event) => setState(event.target.value)} /></div>
            </div>
            <div className="flex gap-2 pt-2">
              <Button variant="secondary" className="h-12 flex-1 rounded-full" onClick={() => setEditing(false)}>Cancelar</Button>
              <Button className="h-12 flex-1 rounded-full" disabled={save.isPending} onClick={() => save.mutate()}>{save.isPending ? "Salvando..." : "Salvar"}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <MatchDrawer matchId={selectedMatch} onOpenChange={(open) => { if (!open) setSelectedMatch(null); }} myCoords={null} />
    </AppShell>
  );
}
