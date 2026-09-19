import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowUpRight,
  CalendarDays,
  Check,
  ChevronRight,
  CircleDot,
  Loader2,
  MapPin,
  Plus,
  Shield,
  Sparkles,
  Star,
  Swords,
  Trash2,
  Trophy,
  Upload,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import fallbackFootballImage from "@/assets/matches-hero.jpg";
import logoAsset from "@/assets/logo.jpg.asset.json";
import { AppShell } from "@/components/app/app-shell";
import { PlayerAvatar } from "@/components/app/player-avatar";
import { ErrorState, FieldError } from "@/components/app/states";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  createTeam,
  deleteTeam,
  fetchConfrontos,
  fetchPlayerPublicStats,
  fetchTeams,
  removeMember,
  requestToJoinTeam,
  setMemberStatus,
} from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { compressProfileImage } from "@/lib/profile-image";
import { teamSchema, type TeamValues } from "@/lib/schemas";
import { friendlyError, supabase } from "@/lib/supabase";
import type { Confronto, Profile, Team } from "@/lib/types";

export const Route = createFileRoute("/_authenticated/teams/")({
  head: () => ({
    meta: [
      { title: "Times — The Match" },
      {
        name: "description",
        content: "Gerencie seu elenco, acompanhe o desempenho e encontre times de futebol perto de você.",
      },
      { property: "og:title", content: "Times — The Match" },
      {
        property: "og:description",
        content: "Sua central de times, elencos e confrontos no The Match.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TeamsPage,
});

function activeMembers(team: Team) {
  return (team.members ?? []).filter((member) => member.status === "active");
}

function teamInConfronto(confronto: Confronto, teamId: string) {
  return confronto.team_a_id === teamId || confronto.team_b_id === teamId;
}

function scoreFor(confronto: Confronto) {
  const scoreA = confronto.match?.score_team_a ?? confronto.reported_score_a_by_a;
  const scoreB = confronto.match?.score_team_b ?? confronto.reported_score_b_by_a;
  if (scoreA == null || scoreB == null) return null;
  return { scoreA, scoreB };
}

function formatMatchDate(value: string) {
  const date = new Date(value);
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  const day = sameDay(date, today)
    ? "Hoje"
    : sameDay(date, tomorrow)
      ? "Amanhã"
      : date.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
  return `${day} • ${date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
}

function TeamsPage() {
  const { user, profile } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [selectedPlayer, setSelectedPlayer] = useState<Profile | null>(null);
  const [shieldBlob, setShieldBlob] = useState<Blob | null>(null);
  const [shieldPreview, setShieldPreview] = useState<string | null>(null);
  const [compressingShield, setCompressingShield] = useState(false);
  const shieldInputRef = useRef<HTMLInputElement>(null);

  const teamsQuery = useQuery({ queryKey: ["teams"], queryFn: fetchTeams });
  const confrontosQuery = useQuery({ queryKey: ["confrontos"], queryFn: fetchConfrontos });
  const teams = teamsQuery.data ?? [];
  const confrontos = confrontosQuery.data ?? [];
  const selectedTeam = teams.find((team) => team.id === selectedTeamId) ?? null;

  const playerStatsQuery = useQuery({
    queryKey: ["player-public-stats", selectedPlayer?.id],
    queryFn: () => fetchPlayerPublicStats(selectedPlayer?.id ?? ""),
    enabled: Boolean(selectedPlayer?.id),
  });

  const categorized = useMemo(() => {
    const owned = teams.filter((team) => team.captain_id === user?.id);
    const participating = teams.filter(
      (team) => team.captain_id !== user?.id && team.members?.some((member) => member.user_id === user?.id),
    );
    const mine = [...owned, ...participating];
    const mineIds = new Set(mine.map((team) => team.id));
    return { mine, discover: teams.filter((team) => !mineIds.has(team.id)) };
  }, [teams, user?.id]);

  const primaryTeam = categorized.mine.find((team) => team.captain_id === user?.id)
    ?? categorized.mine.find((team) => team.members?.some((member) => member.user_id === user?.id && member.status === "active"))
    ?? null;

  const primaryConfrontos = useMemo(
    () => primaryTeam ? confrontos.filter((item) => teamInConfronto(item, primaryTeam.id)) : [],
    [confrontos, primaryTeam],
  );

  const nextMatch = useMemo(() => {
    const now = Date.now();
    return primaryConfrontos
      .filter((item) => item.status === "pending" && item.scheduled_at && new Date(item.scheduled_at).getTime() >= now)
      .sort((a, b) => new Date(a.scheduled_at ?? 0).getTime() - new Date(b.scheduled_at ?? 0).getTime())[0] ?? null;
  }, [primaryConfrontos]);

  const performance = useMemo(() => {
    if (!primaryTeam) return null;
    const completed = primaryConfrontos.flatMap((item) => {
      if (item.status !== "confirmed") return [];
      const score = scoreFor(item);
      if (!score) return [];
      const ours = item.team_a_id === primaryTeam.id ? score.scoreA : score.scoreB;
      const theirs = item.team_a_id === primaryTeam.id ? score.scoreB : score.scoreA;
      return [{ ours, theirs }];
    });
    if (completed.length === 0) return null;
    return {
      games: completed.length,
      wins: completed.filter((game) => game.ours > game.theirs).length,
      draws: completed.filter((game) => game.ours === game.theirs).length,
      losses: completed.filter((game) => game.ours < game.theirs).length,
      goals: completed.reduce((total, game) => total + game.ours, 0),
    };
  }, [primaryConfrontos, primaryTeam]);

  const nextOpponent = nextMatch && primaryTeam
    ? nextMatch.team_a_id === primaryTeam.id ? nextMatch.team_b : nextMatch.team_a
    : null;
  const heroImage = nextMatch?.venue?.photo_url || fallbackFootballImage;

  const form = useForm<TeamValues>({
    resolver: zodResolver(teamSchema),
    defaultValues: { name: "", shield_url: "", city: profile?.city || "", state: profile?.state || "" },
  });

  const invalidate = () => void queryClient.invalidateQueries({ queryKey: ["teams"] });
  const updateCachedMember = (memberId: string, action: "approve" | "reject") => {
    queryClient.setQueryData<Team[]>(["teams"], (current) =>
      current?.map((team) => ({
        ...team,
        members: (team.members ?? [])
          .map((member) => member.id === memberId && action === "approve" ? { ...member, status: "active" as const } : member)
          .filter((member) => action !== "reject" || member.id !== memberId),
      })) ?? [],
    );
  };

  const create = useMutation({
    mutationFn: async (values: TeamValues) => {
      if (!user?.id) throw new Error("Sessão não carregada. Tente fazer login novamente.");
      if (!shieldBlob) throw new Error("Escolha uma imagem para o escudo do time.");
      const shieldPath = `${user.id}/team-shields/${crypto.randomUUID()}.webp`;
      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(shieldPath, shieldBlob, { contentType: "image/webp", cacheControl: "31536000", upsert: false });
      if (uploadError) throw uploadError;
      const { data } = supabase.storage.from("avatars").getPublicUrl(shieldPath);
      return createTeam({ ...values, shield_url: data.publicUrl, state: values.state.toUpperCase(), captain_id: user.id });
    },
    onSuccess: () => {
      toast.success("Time fundado! Agora chame o elenco.");
      setOpen(false);
      if (shieldPreview) URL.revokeObjectURL(shieldPreview);
      setShieldBlob(null);
      setShieldPreview(null);
      form.reset();
      invalidate();
    },
    onError: (error) => toast.error(friendlyError(error)),
  });

  const join = useMutation({
    mutationFn: (teamId: string) => {
      if (!user?.id) throw new Error("Sessão não carregada.");
      return requestToJoinTeam(teamId, user.id);
    },
    onSuccess: () => {
      toast.success("Solicitação enviada ao capitão.");
      invalidate();
    },
    onError: (error) => toast.error(friendlyError(error)),
  });

  const approve = useMutation({
    mutationFn: (memberId: string) => setMemberStatus(memberId, "active"),
    onSuccess: (_, memberId) => {
      updateCachedMember(memberId, "approve");
      toast.success("Boleiro aprovado no elenco.");
      invalidate();
    },
    onError: (error) => toast.error(friendlyError(error)),
  });

  const reject = useMutation({
    mutationFn: (memberId: string) => removeMember(memberId),
    onSuccess: (_, memberId) => {
      updateCachedMember(memberId, "reject");
      toast.success("Solicitação removida.");
      invalidate();
    },
    onError: (error) => toast.error(friendlyError(error)),
  });

  const removeTeam = useMutation({
    mutationFn: deleteTeam,
    onSuccess: (_, teamId) => {
      queryClient.setQueryData<Team[]>(["teams"], (current) => current?.filter((team) => team.id !== teamId) ?? []);
      setSelectedTeamId(null);
      toast.success("Time eliminado.");
      invalidate();
    },
    onError: (error) => toast.error(friendlyError(error)),
  });

  const openCreate = (value: boolean) => {
    setOpen(value);
    if (value && profile) {
      form.setValue("city", profile.city || "");
      form.setValue("state", profile.state || "");
    }
  };

  const selectShield = async (file: File | undefined) => {
    if (!file) return;
    setCompressingShield(true);
    try {
      const compressed = await compressProfileImage(file);
      if (shieldPreview) URL.revokeObjectURL(shieldPreview);
      setShieldBlob(compressed);
      setShieldPreview(URL.createObjectURL(compressed));
      form.clearErrors("shield_url");
    } catch (error) {
      toast.error(friendlyError(error));
    } finally {
      setCompressingShield(false);
      if (shieldInputRef.current) shieldInputRef.current.value = "";
    }
  };

  return (
    <AppShell title="Times" bare>
      <div className="radar-immersive -mb-32 min-h-dvh overflow-x-clip pb-44">
        <div className="mx-auto w-full max-w-2xl px-4">
          <header className="pt-safe flex items-center justify-between gap-3 pb-5">
            <div className="flex min-w-0 items-center gap-2.5">
              <img src={logoAsset.url} alt="The Match" className="size-9 rounded-xl object-cover" />
              <div className="min-w-0">
                <p className="text-[10px] font-semibold tracking-[0.18em] text-primary uppercase">The Match</p>
                <h1 className="text-display truncate text-2xl leading-none font-extrabold text-foreground">Times</h1>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button asChild size="icon" variant="secondary" className="press size-11 rounded-full border border-border/60 bg-surface/90 backdrop-blur-xl" aria-label="Ver confrontos">
                <Link to="/teams/confrontos"><Swords className="size-5" /></Link>
              </Button>
              <Dialog open={open} onOpenChange={openCreate}>
                <DialogTrigger asChild>
                  <Button size="icon" className="press elevate-float size-11 rounded-full" aria-label="Criar time"><Plus className="size-5" /></Button>
                </DialogTrigger>
                <DialogContent className="max-w-[92vw] rounded-3xl sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle className="text-display text-2xl">Criar um time</DialogTitle>
                    <DialogDescription>Funde seu time e monte o elenco.</DialogDescription>
                  </DialogHeader>
                  <form className="space-y-4 py-2" onSubmit={form.handleSubmit((values) => create.mutate(values))}>
                    <div className="space-y-1.5">
                      <Label htmlFor="team-name" className="text-sm font-semibold">Nome do time</Label>
                      <Input id="team-name" placeholder="Ex: Topa do Ouro Preto" {...form.register("name")} className="h-12 bg-surface-2" />
                      <FieldError message={form.formState.errors.name?.message} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="shield" className="text-sm font-semibold">Escudo do time</Label>
                      <input
                        ref={shieldInputRef}
                        id="shield"
                        type="file"
                        accept="image/*"
                        className="sr-only"
                        onChange={(event) => void selectShield(event.target.files?.[0])}
                      />
                      <div className="flex items-center gap-3 rounded-2xl border border-border bg-surface-2 p-3">
                        <div className="grid size-16 shrink-0 place-items-center overflow-hidden rounded-2xl bg-surface">
                          {shieldPreview ? (
                            <img src={shieldPreview} alt="Prévia do escudo" className="size-full object-contain p-1" />
                          ) : (
                            <Shield className="size-8 text-primary" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-foreground">{shieldPreview ? "Escudo pronto" : "Adicionar escudo"}</p>
                          <p className="text-xs text-muted-foreground">A imagem será recortada e comprimida automaticamente.</p>
                        </div>
                        <Button
                          type="button"
                          size="icon"
                          variant="secondary"
                          className="size-11 shrink-0 rounded-full"
                          disabled={compressingShield}
                          onClick={() => shieldInputRef.current?.click()}
                          aria-label={shieldPreview ? "Trocar escudo" : "Adicionar escudo"}
                        >
                          {compressingShield ? <Loader2 className="size-5 animate-spin" /> : <Upload className="size-5" />}
                        </Button>
                      </div>
                      <input type="hidden" {...form.register("shield_url")} />
                      <FieldError message={form.formState.errors.shield_url?.message} />
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <div className="col-span-2 space-y-1.5">
                        <Label htmlFor="team-city" className="text-sm font-semibold">Cidade</Label>
                        <Input id="team-city" placeholder="Nova Iguaçu" {...form.register("city")} className="h-12 bg-surface-2" />
                        <FieldError message={form.formState.errors.city?.message} />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="team-state" className="text-sm font-semibold">UF</Label>
                        <Input id="team-state" placeholder="RJ" maxLength={2} {...form.register("state")} className="h-12 bg-surface-2 text-center uppercase" />
                        <FieldError message={form.formState.errors.state?.message} />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button type="submit" disabled={create.isPending || compressingShield} className="h-12 w-full rounded-full text-base font-bold">
                        {create.isPending ? <Loader2 className="size-5 animate-spin" /> : <Plus className="size-5" />} Criar time
                      </Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
          </header>

          {teamsQuery.isPending ? (
            <div className="space-y-6" aria-label="Carregando times">
              <div className="h-[29rem] animate-pulse rounded-[2.25rem] bg-surface" />
              <div className="grid grid-cols-2 gap-3">
                <div className="h-36 animate-pulse rounded-3xl bg-surface" />
                <div className="h-36 animate-pulse rounded-3xl bg-surface" />
              </div>
            </div>
          ) : teamsQuery.isError ? (
            <div className="pt-16"><ErrorState message={friendlyError(teamsQuery.error)} onRetry={() => void teamsQuery.refetch()} /></div>
          ) : (
            <>
              {primaryTeam ? (
                <section>
                  <button
                    type="button"
                    onClick={() => setSelectedTeamId(primaryTeam.id)}
                    className="press elevate-float group relative block h-[29rem] w-full overflow-hidden rounded-[2.25rem] border border-border/60 text-left"
                    aria-label={`Abrir ${primaryTeam.name}`}
                  >
                    <img src={heroImage} alt="Campo de futebol" className="size-full object-cover transition-transform duration-500 group-hover:scale-[1.02]" />
                    <div className="absolute inset-0 bg-gradient-to-b from-background/15 via-background/20 to-background/95" />
                    <div className="absolute inset-x-0 top-0 flex items-start justify-between p-5">
                      <span className="rounded-full border border-border/50 bg-background/45 px-3 py-1.5 text-[10px] font-bold tracking-[0.14em] text-foreground uppercase backdrop-blur-xl">
                        Seu time principal
                      </span>
                      <span className="grid size-10 place-items-center rounded-full border border-border/50 bg-background/45 text-foreground backdrop-blur-xl"><ArrowUpRight className="size-5" /></span>
                    </div>
                    <div className="absolute inset-x-0 bottom-0 p-5">
                      <div className="mb-4 flex items-end gap-4">
                        <div className="elevate-float grid size-24 shrink-0 place-items-center overflow-hidden rounded-[1.75rem] border border-border/70 bg-card/90 p-2 backdrop-blur-xl">
                          {primaryTeam.shield_url ? <img src={primaryTeam.shield_url} alt={`Escudo ${primaryTeam.name}`} className="size-full object-contain" /> : <Shield className="size-12 text-primary" />}
                        </div>
                        <div className="min-w-0 pb-1">
                          <p className="mb-1 text-xs font-semibold text-primary">{primaryTeam.captain_id === user?.id ? "CAPITÃO" : "NO ELENCO"}</p>
                          <h2 className="text-display break-words text-[2.25rem] leading-[0.92] font-extrabold text-foreground">{primaryTeam.name}</h2>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-border/50 pt-4 text-xs font-semibold text-foreground/90">
                        <span className="flex items-center gap-1.5"><Users className="size-4 text-primary" /> {activeMembers(primaryTeam).length} jogadores</span>
                        {(primaryTeam.city || primaryTeam.state) ? <span className="flex min-w-0 items-center gap-1.5"><MapPin className="size-4 shrink-0 text-primary" /><span className="truncate">{[primaryTeam.city, primaryTeam.state].filter(Boolean).join(" • ")}</span></span> : null}
                      </div>
                    </div>
                  </button>
                </section>
              ) : (
                <section className="elevate-float relative overflow-hidden rounded-[2.25rem] border border-border/60 bg-card p-6">
                  <div className="absolute inset-0 opacity-25"><img src={fallbackFootballImage} alt="" className="size-full object-cover" /></div>
                  <div className="absolute inset-0 bg-gradient-to-b from-background/40 to-background" />
                  <div className="relative pt-24">
                    <span className="grid size-16 place-items-center rounded-2xl bg-primary text-primary-foreground"><Shield className="size-8" /></span>
                    <h2 className="text-display mt-5 text-3xl leading-none font-extrabold">Você ainda não está em nenhum time.</h2>
                    <p className="mt-3 max-w-sm text-sm leading-relaxed text-muted-foreground">Encontre um time perto de você ou crie o seu.</p>
                    <div className="mt-5 flex flex-wrap gap-2">
                      <Button className="rounded-full" onClick={() => document.getElementById("descobrir-times")?.scrollIntoView({ behavior: "smooth" })}><Sparkles className="size-4" /> Encontrar times</Button>
                      <Button variant="secondary" className="rounded-full" onClick={() => openCreate(true)}><Plus className="size-4" /> Criar time</Button>
                    </div>
                  </div>
                </section>
              )}

              {primaryTeam ? (
                <section className="mt-8">
                  <div className="mb-3 flex items-end justify-between gap-3">
                    <div><p className="text-[10px] font-bold tracking-[0.16em] text-primary uppercase">Agenda do elenco</p><h2 className="text-display text-2xl font-extrabold">Próxima partida</h2></div>
                    <Button asChild variant="ghost" size="sm" className="rounded-full"><Link to="/teams/confrontos">Ver contras <ChevronRight className="size-4" /></Link></Button>
                  </div>
                  {confrontosQuery.isPending ? (
                    <div className="h-40 animate-pulse rounded-3xl bg-surface" />
                  ) : nextMatch && nextMatch.scheduled_at ? (
                    <div className="elevate-soft rounded-[1.75rem] border border-border/60 bg-card p-5">
                      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
                        <div className="min-w-0 text-center">
                          <PlayerAvatar name={primaryTeam.name} photoUrl={primaryTeam.shield_url} size="md" />
                          <p className="mt-2 truncate text-sm font-bold">{primaryTeam.name}</p>
                        </div>
                        <span className="text-display text-xl font-extrabold text-primary">VS</span>
                        <div className="min-w-0 text-center">
                          <PlayerAvatar name={nextOpponent?.name ?? "Adversário"} photoUrl={nextOpponent?.shield_url ?? null} size="md" />
                          <p className="mt-2 truncate text-sm font-bold">{nextOpponent?.name ?? "Adversário"}</p>
                        </div>
                      </div>
                      <div className="mt-4 flex flex-wrap justify-center gap-2 border-t border-border/60 pt-4 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1.5 rounded-full bg-surface-2 px-3 py-2"><CalendarDays className="size-3.5 text-primary" /> {formatMatchDate(nextMatch.scheduled_at)}</span>
                        {nextMatch.venue?.name ? <span className="flex items-center gap-1.5 rounded-full bg-surface-2 px-3 py-2"><MapPin className="size-3.5 text-primary" /> {nextMatch.venue.name}</span> : null}
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-[1.75rem] border border-dashed border-border bg-surface/60 p-6 text-center">
                      <CalendarDays className="mx-auto size-6 text-primary" />
                      <p className="mt-2 font-bold text-foreground">Nenhum jogo marcado</p>
                      <p className="mt-1 text-xs text-muted-foreground">O próximo confronto do time aparecerá aqui.</p>
                      {primaryTeam.captain_id === user?.id ? <Button asChild size="sm" className="mt-4 rounded-full"><Link to="/teams/confrontos"><Swords className="size-4" /> Marcar contra</Link></Button> : null}
                    </div>
                  )}
                </section>
              ) : null}

              {categorized.mine.length > 0 ? (
                <section className="mt-9">
                  <div className="mb-4 flex items-end justify-between"><div><p className="text-[10px] font-bold tracking-[0.16em] text-primary uppercase">Sua comunidade</p><h2 className="text-display text-2xl font-extrabold">Meus times</h2></div><span className="grid size-9 place-items-center rounded-full bg-primary/15 text-sm font-bold text-primary">{categorized.mine.length}</span></div>
                  <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                    {categorized.mine.map((team) => {
                      const membership = team.members?.find((member) => member.user_id === user?.id);
                      return (
                        <button key={team.id} type="button" onClick={() => setSelectedTeamId(team.id)} className="press elevate-soft w-[78%] max-w-[20rem] shrink-0 rounded-[1.75rem] border border-border/60 bg-card p-4 text-left">
                          <div className="flex items-center gap-3">
                            <div className="grid size-16 shrink-0 place-items-center overflow-hidden rounded-2xl bg-surface-2 p-2">{team.shield_url ? <img src={team.shield_url} alt={`Escudo ${team.name}`} className="size-full object-contain" /> : <Shield className="size-8 text-primary" />}</div>
                            <div className="min-w-0 flex-1"><p className="text-display truncate text-xl font-extrabold">{team.name}</p><p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground"><Users className="size-3.5" /> {activeMembers(team).length} jogadores</p></div>
                            <ChevronRight className="size-5 shrink-0 text-muted-foreground" />
                          </div>
                          <div className="mt-4 flex items-center justify-between gap-2 border-t border-border/60 pt-3 text-[11px]">
                            <span className="truncate text-muted-foreground">{[team.city, team.state].filter(Boolean).join(" • ") || "Local não informado"}</span>
                            <Badge variant="secondary" className="shrink-0">{team.captain_id === user?.id ? "Capitão" : membership?.status === "active" ? "No elenco" : "Aguardando"}</Badge>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </section>
              ) : null}

              {primaryTeam ? (
                <section className="mt-9">
                  <p className="text-[10px] font-bold tracking-[0.16em] text-primary uppercase">Números confirmados</p>
                  <h2 className="text-display mt-1 text-2xl font-extrabold">Desempenho</h2>
                  {confrontosQuery.isPending ? <div className="mt-4 h-28 animate-pulse rounded-3xl bg-surface" /> : performance ? (
                    <div className="mt-4 grid grid-cols-5 overflow-hidden rounded-[1.75rem] border border-border/60 bg-card">
                      {[{ label: "Jogos", value: performance.games }, { label: "Vitórias", value: performance.wins }, { label: "Empates", value: performance.draws }, { label: "Derrotas", value: performance.losses }, { label: "Gols", value: performance.goals }].map((stat, index) => (
                        <div key={stat.label} className={`min-w-0 px-1 py-5 text-center ${index > 0 ? "border-l border-border/60" : ""}`}><p className="text-display text-xl font-extrabold text-foreground tabular-nums">{stat.value}</p><p className="mt-1 truncate text-[9px] text-muted-foreground">{stat.label}</p></div>
                      ))}
                    </div>
                  ) : (
                    <div className="mt-4 rounded-3xl border border-border/60 bg-surface/60 p-5"><p className="text-sm font-semibold">Sem desempenho confirmado ainda.</p><p className="mt-1 text-xs text-muted-foreground">Os números aparecem após o primeiro confronto encerrado com placar.</p></div>
                  )}
                </section>
              ) : null}

              <section id="descobrir-times" className="mt-10 scroll-mt-6">
                <div className="mb-4 flex items-end justify-between gap-3"><div><p className="text-[10px] font-bold tracking-[0.16em] text-primary uppercase">Futebol na região</p><h2 className="text-display text-2xl font-extrabold">Descobrir times</h2></div><Sparkles className="size-5 text-primary" /></div>
                {categorized.discover.length === 0 ? (
                  <div className="rounded-[1.75rem] border border-dashed border-border bg-surface/60 p-6 text-center"><Users className="mx-auto size-7 text-primary" /><p className="mt-2 font-bold">Nenhum outro time disponível</p><p className="mt-1 text-xs text-muted-foreground">Novos times da comunidade aparecerão aqui.</p></div>
                ) : (
                  <ul className="space-y-3">
                    {categorized.discover.map((team) => (
                      <li key={team.id} className="elevate-soft rounded-[1.75rem] border border-border/60 bg-card p-4">
                        <div className="flex items-center gap-3">
                          <button type="button" onClick={() => setSelectedTeamId(team.id)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                            <div className="grid size-14 shrink-0 place-items-center overflow-hidden rounded-2xl bg-surface-2 p-2">{team.shield_url ? <img src={team.shield_url} alt={`Escudo ${team.name}`} className="size-full object-contain" /> : <Shield className="size-7 text-primary" />}</div>
                            <div className="min-w-0"><p className="text-display truncate text-lg font-extrabold">{team.name}</p><p className="mt-1 truncate text-xs text-muted-foreground">{activeMembers(team).length} jogadores • {[team.city, team.state].filter(Boolean).join(" • ") || "Local não informado"}</p></div>
                          </button>
                          <Button size="sm" className="shrink-0 rounded-full" disabled={join.isPending} onClick={() => join.mutate(team.id)}>{join.isPending && join.variables === team.id ? <Loader2 className="size-4 animate-spin" /> : <UserPlus className="size-4" />} Entrar</Button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section className="mt-10 rounded-[2rem] border border-primary/25 bg-primary/10 p-6 text-center">
                <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-primary text-primary-foreground"><Plus className="size-7" /></span>
                <h2 className="text-display mt-4 text-2xl font-extrabold">Monte seu próprio time</h2>
                <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">Crie um escudo, reúna seu elenco e comece a marcar contras.</p>
                <Button className="mt-5 h-12 rounded-full px-7 font-bold" onClick={() => openCreate(true)}><Shield className="size-5" /> Criar time</Button>
              </section>
            </>
          )}
        </div>
      </div>

      <Dialog open={Boolean(selectedTeam)} onOpenChange={(value) => !value && setSelectedTeamId(null)}>
        <DialogContent className="max-h-[88dvh] max-w-[92vw] overflow-y-auto rounded-3xl sm:max-w-lg">
          {selectedTeam ? (() => {
            const members = selectedTeam.members ?? [];
            const active = members.filter((member) => member.status === "active");
            const pending = members.filter((member) => member.status === "pending_approval");
            const isCaptain = selectedTeam.captain_id === user?.id;
            const myMembership = members.find((member) => member.user_id === user?.id);
            return (
              <>
                <DialogHeader>
                  <div className="flex items-center gap-3 pr-8">
                    <PlayerAvatar name={selectedTeam.name} photoUrl={selectedTeam.shield_url} size="md" />
                    <div className="min-w-0 text-left"><DialogTitle className="text-display truncate text-2xl">{selectedTeam.name}</DialogTitle><DialogDescription className="mt-1 flex items-center gap-1"><MapPin className="size-3.5" /> {[selectedTeam.city, selectedTeam.state].filter(Boolean).join(" • ") || "Local não informado"}</DialogDescription></div>
                  </div>
                </DialogHeader>
                <div className="space-y-5">
                  <div className="flex items-center gap-3 rounded-2xl bg-surface-2 p-3"><PlayerAvatar name={selectedTeam.captain?.full_name ?? "Capitão"} nickname={selectedTeam.captain?.nickname ?? null} photoUrl={selectedTeam.captain?.avatar_url ?? null} size="sm" /><div><p className="text-xs text-muted-foreground">Capitão</p><p className="font-semibold text-foreground">{selectedTeam.captain?.nickname ?? selectedTeam.captain?.full_name ?? "Boleiro"}</p></div></div>
                  <section>
                    <h3 className="mb-2 flex items-center gap-2 font-semibold text-foreground"><Users className="size-4 text-primary" /> Elenco ({active.length})</h3>
                    {active.length ? <div className="space-y-2">{active.map((member) => <Button key={member.id} type="button" variant="ghost" className="h-auto w-full justify-start gap-3 rounded-2xl bg-surface-2 p-3 text-left" onClick={() => { if (member.profile) setSelectedPlayer(member.profile); }}><PlayerAvatar name={member.profile?.full_name ?? "Boleiro"} nickname={member.profile?.nickname ?? null} photoUrl={member.profile?.avatar_url ?? null} size="sm" /><span className="font-medium text-foreground">{member.profile?.nickname ?? member.profile?.full_name ?? "Boleiro"}</span><ChevronRight className="ml-auto size-4 text-muted-foreground" /></Button>)}</div> : <p className="text-sm text-muted-foreground">Nenhum atleta no elenco.</p>}
                  </section>
                  {isCaptain && pending.length ? <section><h3 className="mb-2 text-sm font-semibold">Solicitações ({pending.length})</h3><div className="space-y-2">{pending.map((member) => <div key={member.id} className="flex items-center gap-2 rounded-2xl border border-border p-2"><PlayerAvatar name={member.profile?.full_name ?? "Boleiro"} nickname={member.profile?.nickname ?? null} photoUrl={member.profile?.avatar_url ?? null} size="sm" /><span className="min-w-0 flex-1 truncate text-sm font-medium">{member.profile?.nickname ?? member.profile?.full_name ?? "Boleiro"}</span><Button size="icon" variant="secondary" aria-label="Aprovar solicitação" disabled={approve.isPending || reject.isPending} onClick={() => approve.mutate(member.id)}><Check className="size-4" /></Button><Button size="icon" variant="ghost" aria-label="Recusar solicitação" disabled={approve.isPending || reject.isPending} onClick={() => reject.mutate(member.id)}><X className="size-4" /></Button></div>)}</div></section> : null}
                  {!isCaptain && !myMembership ? <Button className="w-full rounded-full" disabled={join.isPending} onClick={() => join.mutate(selectedTeam.id)}><UserPlus className="size-4" /> Solicitar entrada</Button> : null}
                  {isCaptain ? <AlertDialog><AlertDialogTrigger asChild><Button variant="destructive" className="w-full rounded-full" disabled={removeTeam.isPending}><Trash2 className="size-4" /> Eliminar time</Button></AlertDialogTrigger><AlertDialogContent className="max-w-[90vw] rounded-3xl sm:max-w-md"><AlertDialogHeader><AlertDialogTitle>Eliminar {selectedTeam.name}?</AlertDialogTitle><AlertDialogDescription>O time, o elenco e as solicitações serão removidos definitivamente.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => removeTeam.mutate(selectedTeam.id)}>Eliminar time</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog> : null}
                </div>
              </>
            );
          })() : null}
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(selectedPlayer)} onOpenChange={(value) => !value && setSelectedPlayer(null)}>
        <DialogContent className="max-w-[92vw] rounded-3xl sm:max-w-sm">
          {selectedPlayer ? <><DialogHeader className="items-center text-center"><PlayerAvatar name={selectedPlayer.full_name} nickname={selectedPlayer.nickname} photoUrl={selectedPlayer.avatar_url} size="xl" /><div><DialogTitle className="text-display mt-2 text-2xl">{selectedPlayer.nickname || selectedPlayer.full_name}</DialogTitle><DialogDescription>{selectedPlayer.full_name}</DialogDescription></div></DialogHeader><div className="flex items-center justify-center gap-1.5 text-sm text-muted-foreground"><MapPin className="size-4 text-primary" /><span>{selectedPlayer.city || "Bairro não informado"}{selectedPlayer.state ? ` • ${selectedPlayer.state}` : ""}</span></div>{playerStatsQuery.isPending ? <div className="grid grid-cols-2 gap-2" aria-label="Carregando informações do jogador">{[1, 2, 3, 4].map((item) => <div key={item} className="h-20 animate-pulse rounded-2xl bg-surface-2" />)}</div> : playerStatsQuery.isError ? <ErrorState message={friendlyError(playerStatsQuery.error)} onRetry={() => void playerStatsQuery.refetch()} /> : <div className="grid grid-cols-2 gap-2">{[{ label: "Jogos", value: playerStatsQuery.data?.matches_played ?? 0, icon: Swords }, { label: "Gols", value: playerStatsQuery.data?.goals ?? 0, icon: CircleDot }, { label: "Campeonatos", value: playerStatsQuery.data?.championships ?? 0, icon: Trophy }, { label: "Nota", value: (playerStatsQuery.data?.avg_score ?? 0).toFixed(2), icon: Star }].map(({ label, value, icon: Icon }) => <div key={label} className="rounded-2xl border border-border bg-surface-2 p-3 text-center"><Icon className="mx-auto size-4 text-primary" /><p className="text-display mt-1 text-xl font-bold">{value}</p><p className="text-[11px] text-muted-foreground">{label}</p></div>)}</div>}</> : null}
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
