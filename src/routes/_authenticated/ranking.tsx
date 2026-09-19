import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import {
  ChevronRight,
  Crown,
  MapPin,
  Shield,
  Star,
  Trophy,
  Users,
} from "lucide-react";
import { useState } from "react";

import { AppShell } from "@/components/app/app-shell";
import { PlayerAvatar } from "@/components/app/player-avatar";
import { ErrorState } from "@/components/app/states";
import { NotificationsBell } from "@/components/app/notifications-bell";
import { Button } from "@/components/ui/button";
import { fetchPlayerStats, fetchRanking } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { friendlyError } from "@/lib/supabase";
import type { RankingRow } from "@/lib/types";

type RankingScope = "local" | "state" | "global";
type RankingMode = "players" | "teams";

export const Route = createFileRoute("/_authenticated/ranking")({
  head: () => ({
    meta: [
      { title: "Ranking — The Match" },
      {
        name: "description",
        content: "Acompanhe os jogadores mais bem avaliados do The Match e encontre sua posição no ranking.",
      },
      { property: "og:title", content: "Ranking — The Match" },
      {
        property: "og:description",
        content: "O pódio dos jogadores mais bem avaliados do futebol amador.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: RankingPage,
});

const scopes: { value: RankingScope; label: string }[] = [
  { value: "local", label: "Bairro" },
  { value: "state", label: "Estado" },
  { value: "global", label: "Global" },
];

const podiumStyles = {
  1: {
    ring: "border-primary/80 bg-primary/15 shadow-[0_0_34px_color-mix(in_oklab,var(--primary)_28%,transparent)]",
    badge: "bg-primary text-primary-foreground",
    height: "h-28",
    tone: "text-primary",
  },
  2: {
    ring: "border-border/80 bg-card",
    badge: "bg-secondary text-foreground",
    height: "h-20",
    tone: "text-silver",
  },
  3: {
    ring: "border-border/80 bg-card",
    badge: "bg-secondary text-foreground",
    height: "h-16",
    tone: "text-bronze",
  },
} as const;

function displayName(row: RankingRow) {
  return row.nickname || row.full_name || "Jogador";
}

function RankingSkeleton() {
  return (
    <div className="animate-pulse px-4 pt-5" aria-label="Ranking carregando">
      <div className="mx-auto h-32 max-w-sm rounded-[2rem] bg-secondary/70" />
      <div className="mt-7 grid grid-cols-3 items-end gap-2">
        <div className="h-48 rounded-[1.75rem] bg-secondary/70" />
        <div className="h-60 rounded-[1.75rem] bg-secondary/70" />
        <div className="h-44 rounded-[1.75rem] bg-secondary/70" />
      </div>
      <div className="mt-8 space-y-3">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="h-20 rounded-[1.4rem] bg-secondary/70" />
        ))}
      </div>
    </div>
  );
}

function PodiumPlayer({ row, position }: { row: RankingRow; position: 1 | 2 | 3 }) {
  const style = podiumStyles[position];
  const isLeader = position === 1;

  return (
    <article className={`relative flex min-w-0 flex-col items-center ${isLeader ? "-mt-6" : ""}`}>
      {isLeader ? <Crown className="mb-2 size-6 text-primary drop-shadow-md" aria-hidden="true" /> : <div className="h-8" />}
      <div className="relative">
        <PlayerAvatar
          name={row.full_name}
          nickname={row.nickname}
          photoUrl={row.avatar_url}
          size={isLeader ? "xl" : "lg"}
          className={`border-2 ${style.ring}`}
        />
        <span className={`absolute -right-1 -bottom-1 grid size-7 place-items-center rounded-full border-2 border-background text-xs font-black ${style.badge}`}>
          {position}
        </span>
      </div>
      <p className="mt-3 w-full truncate text-center text-sm font-bold text-foreground">{displayName(row)}</p>
      <div className={`mt-1 flex items-center justify-center gap-1 ${style.tone}`}>
        <Star className="size-3.5 fill-current" />
        <span className="text-display text-lg font-bold tabular-nums">{row.avg_score.toFixed(2)}</span>
      </div>
      <p className="mt-0.5 text-[10px] text-muted-foreground tabular-nums">{row.matches_played} jogos</p>
      <div className={`mt-3 flex w-full items-start justify-center rounded-t-[1.35rem] border border-b-0 border-border/60 bg-card/80 pt-3 backdrop-blur-xl ${style.height}`}>
        <span className={`text-display text-4xl font-black ${style.tone}`}>{position}º</span>
      </div>
    </article>
  );
}

function RankingCard({ row, position, isMe }: { row: RankingRow; position: number; isMe: boolean }) {
  return (
    <li className={`flex min-h-20 items-center gap-3 rounded-[1.4rem] border p-3.5 shadow-[var(--shadow-soft)] transition-transform duration-200 hover:-translate-y-0.5 ${isMe ? "border-primary/60 bg-primary/10" : "border-border/60 bg-card/85"}`}>
      <span className="text-display w-8 shrink-0 text-center text-lg font-bold text-muted-foreground tabular-nums">{position}</span>
      <PlayerAvatar name={row.full_name} nickname={row.nickname} photoUrl={row.avatar_url} size="md" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-bold text-foreground">{displayName(row)}</p>
          {isMe ? <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[9px] font-bold text-primary uppercase">Você</span> : null}
        </div>
        <p className="mt-1 truncate text-xs text-muted-foreground">{row.matches_played} partidas{row.city ? ` • ${row.city}` : ""}</p>
      </div>
      <div className="shrink-0 text-right">
        <div className="flex items-center justify-end gap-1 text-primary">
          <Star className="size-3.5 fill-current" />
          <span className="text-display text-lg font-bold tabular-nums">{row.avg_score.toFixed(2)}</span>
        </div>
        <p className="text-[10px] text-muted-foreground tabular-nums">{row.ratings_count} avaliações</p>
      </div>
    </li>
  );
}

function RankingPage() {
  const { profile, user } = useAuth();
  const [mode, setMode] = useState<RankingMode>("players");
  const [scope, setScope] = useState<RankingScope>("global");

  const rankingQuery = useQuery({
    queryKey: ["ranking", scope, profile?.city ?? "", profile?.state ?? ""],
    queryFn: () => fetchRanking({ scope, city: profile?.city ?? null, state: profile?.state ?? null }),
    enabled: mode === "players",
  });

  const myStatsQuery = useQuery({
    queryKey: ["player-stats", user?.id],
    queryFn: () => fetchPlayerStats(user?.id ?? ""),
    enabled: mode === "players" && Boolean(user?.id),
  });

  const rankingRows = rankingQuery.data ?? [];
  const hasOwnRankingRow = user?.id
    ? rankingRows.some((row) => row.user_id === user.id)
    : false;
  const fallbackOwnRow: RankingRow | null =
    user?.id && profile && !hasOwnRankingRow && (myStatsQuery.data?.ratings_count ?? 0) > 0
      ? {
          user_id: user.id,
          full_name: profile.full_name,
          nickname: profile.nickname,
          avatar_url: profile.avatar_url,
          city: profile.city,
          state: profile.state,
          avg_score: myStatsQuery.data?.avg_score ?? 0,
          ratings_count: myStatsQuery.data?.ratings_count ?? 0,
          matches_played: myStatsQuery.data?.matches_played ?? 0,
        }
      : null;
  const rows = [...rankingRows, ...(fallbackOwnRow ? [fallbackOwnRow] : [])].sort(
    (a, b) => b.avg_score - a.avg_score || b.ratings_count - a.ratings_count,
  );
  const topThree = rows.slice(0, 3);
  const remainingRows = rows.slice(3, 10);
  const myIndex = user?.id ? rows.findIndex((row) => row.user_id === user.id) : -1;
  const myRow = myIndex >= 10 ? rows[myIndex] : null;
  const scopeContext = scope === "local" ? profile?.city : scope === "state" ? profile?.state : null;

  return (
    <AppShell title="Ranking" bare>
      <div className="radar-immersive -mb-32 min-h-dvh overflow-x-hidden pb-40">
        <div className="mx-auto max-w-2xl">
          <header className="px-4 pt-safe">
            <div className="flex items-center justify-between pt-4">
              <div className="flex min-w-0 items-center gap-3">
                <PlayerAvatar
                  name={profile?.full_name ?? "Jogador"}
                  nickname={profile?.nickname ?? ""}
                  photoUrl={profile?.avatar_url ?? null}
                  size="md"
                  className="border-primary/60"
                />
                <div className="min-w-0">
                  <p className="text-xs font-semibold tracking-wider text-primary uppercase">The Match</p>
                  <h1 className="text-display truncate text-3xl leading-none font-bold text-foreground">Ranking</h1>
                </div>
              </div>
<NotificationsBell />
            </div>
            <p className="mt-5 text-base text-muted-foreground">Os melhores da partida.</p>
          </header>

          <main className="pt-6">
            <div className="px-4">
              <div className="grid grid-cols-2 rounded-full border border-border/70 bg-secondary/70 p-1.5 backdrop-blur-xl" role="tablist" aria-label="Tipo de ranking">
                <Button type="button" role="tab" aria-selected={mode === "players"} variant={mode === "players" ? "default" : "ghost"} onClick={() => setMode("players")} className="h-11 rounded-full text-sm font-bold">
                  <Users className="size-4" /> Jogadores
                </Button>
                <Button type="button" role="tab" aria-selected={mode === "teams"} variant={mode === "teams" ? "default" : "ghost"} onClick={() => setMode("teams")} className="h-11 rounded-full text-sm font-bold">
                  <Shield className="size-4" /> Times
                </Button>
              </div>
            </div>

            {mode === "teams" ? (
              <section className="px-4 pt-7">
                <div className="rounded-[2rem] border border-border/70 bg-card/90 p-7 text-center shadow-[var(--shadow-raised)] backdrop-blur-xl">
                  <div className="mx-auto grid size-16 place-items-center rounded-full bg-primary/15 text-primary">
                    <Shield className="size-8" />
                  </div>
                  <h2 className="text-display mt-5 text-2xl font-bold text-foreground">Ranking de times em preparação</h2>
                  <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
                    A classificação aparecerá quando o The Match tiver uma pontuação oficial de equipes. Nenhum resultado será estimado.
                  </p>
                  <Button type="button" variant="secondary" className="mt-6 h-11 rounded-full px-5" onClick={() => setMode("players")}>
                    Ver jogadores <ChevronRight className="size-4" />
                  </Button>
                </div>
              </section>
            ) : (
              <>
                <div className="px-4 pt-5">
                  <div className="grid grid-cols-3 gap-1 rounded-full border border-border/60 bg-card/60 p-1 backdrop-blur-xl" aria-label="Abrangência do ranking">
                    {scopes.map((item) => (
                      <Button key={item.value} type="button" size="sm" variant={scope === item.value ? "secondary" : "ghost"} onClick={() => setScope(item.value)} className="h-9 rounded-full text-xs font-bold">
                        {item.label}
                      </Button>
                    ))}
                  </div>
                  <div className="mt-3 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
                    <MapPin className="size-3.5 text-primary" />
                    <span>{scopeContext ? `Classificação de ${scopeContext}` : scope === "global" ? "Classificação geral" : "Complete sua localização para filtrar"}</span>
                  </div>
                </div>

                {rankingQuery.isPending ? (
                  <RankingSkeleton />
                ) : rankingQuery.isError ? (
                  <div className="px-4 pt-7">
                    <ErrorState message={friendlyError(rankingQuery.error)} onRetry={() => void rankingQuery.refetch()} />
                  </div>
                ) : rows.length === 0 ? (
                  <section className="px-4 pt-7">
                    <div className="rounded-[2rem] border border-border/70 bg-card p-7 text-center shadow-[var(--shadow-raised)]">
                      <Trophy className="mx-auto size-10 text-primary" />
                      <h2 className="text-display mt-4 text-2xl font-bold text-foreground">O pódio está esperando</h2>
                      <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">Assim que partidas forem encerradas e os jogadores avaliados, a classificação real aparecerá aqui.</p>
                    </div>
                  </section>
                ) : (
                  <>
                    <section className="px-4 pt-12" aria-labelledby="podium-title">
                      <div className="mb-9 flex items-end justify-between gap-3">
                        <div>
                          <p className="text-xs font-semibold tracking-wider text-primary uppercase">Destaques</p>
                          <h2 id="podium-title" className="text-display text-2xl font-bold text-foreground">Pódio da rodada</h2>
                        </div>
                        <span className="text-xs text-muted-foreground">Por nota média</span>
                      </div>
                      <div className="grid grid-cols-3 items-end gap-2">
                        {topThree[1] ? <PodiumPlayer row={topThree[1]} position={2} /> : <div />}
                        {topThree[0] ? <PodiumPlayer row={topThree[0]} position={1} /> : <div />}
                        {topThree[2] ? <PodiumPlayer row={topThree[2]} position={3} /> : <div />}
                      </div>
                    </section>

                    {remainingRows.length > 0 ? (
                      <section className="px-4 pt-8" aria-labelledby="ranking-list-title">
                        <div className="mb-4 flex items-end justify-between gap-3">
                          <div>
                            <p className="text-xs font-semibold tracking-wider text-primary uppercase">Classificação</p>
                            <h2 id="ranking-list-title" className="text-display text-2xl font-bold text-foreground">Na disputa</h2>
                          </div>
                          <span className="text-xs text-muted-foreground">Top 10</span>
                        </div>
                        <ol className="space-y-3">
                          {remainingRows.map((row, index) => <RankingCard key={row.user_id} row={row} position={index + 4} isMe={row.user_id === profile?.id} />)}
                        </ol>
                      </section>
                    ) : null}

                    <section className="px-4 pt-8" aria-labelledby="my-position-title">
                      <p className="mb-3 text-xs font-semibold tracking-wider text-primary uppercase">Minha posição</p>
                      {myRow ? (
                        <div className="rounded-[1.7rem] border border-primary/60 bg-primary/10 p-4 shadow-[var(--shadow-float)]">
                          <div className="flex items-center gap-3">
                            <div className="grid size-12 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground">
                              <span className="text-display text-lg font-black">#{myIndex + 1}</span>
                            </div>
                            <PlayerAvatar name={myRow.full_name} nickname={myRow.nickname} photoUrl={myRow.avatar_url} size="md" />
                            <div className="min-w-0 flex-1">
                              <h2 id="my-position-title" className="truncate text-sm font-bold text-foreground">{displayName(myRow)}</h2>
                              <p className="mt-1 text-xs text-muted-foreground">{myRow.matches_played} partidas • {myRow.ratings_count} avaliações</p>
                            </div>
                            <div className="flex shrink-0 items-center gap-1 text-primary">
                              <Star className="size-4 fill-current" />
                              <span className="text-display text-xl font-bold tabular-nums">{myRow.avg_score.toFixed(2)}</span>
                            </div>
                          </div>
                        </div>
                      ) : myIndex >= 0 ? (
                        <div className="rounded-[1.5rem] border border-primary/40 bg-primary/10 px-5 py-4">
                          <p id="my-position-title" className="text-sm font-bold text-foreground">Você está no top 10</p>
                          <p className="mt-1 text-xs text-muted-foreground">Sua posição atual é #{myIndex + 1} nesta classificação.</p>
                        </div>
                      ) : (
                        <div className="rounded-[1.5rem] border border-border/60 bg-card/80 px-5 py-4">
                          <p id="my-position-title" className="text-sm font-bold text-foreground">Você ainda não tem posição</p>
                          <p className="mt-1 text-xs text-muted-foreground">Participe de partidas e receba avaliações para entrar na classificação.</p>
                        </div>
                      )}
                    </section>
                  </>
                )}
              </>
            )}
          </main>
        </div>
      </div>
    </AppShell>
  );
}