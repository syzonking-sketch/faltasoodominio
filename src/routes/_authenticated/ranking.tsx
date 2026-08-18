import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Crown, Trophy } from "lucide-react";
import { useState } from "react";

import { AppShell } from "@/components/app/app-shell";
import { PlayerAvatar } from "@/components/app/player-avatar";
import { StarRating } from "@/components/app/star-rating";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/app/states";
import { Button } from "@/components/ui/button";
import { fetchRanking } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { friendlyError } from "@/lib/supabase";
type RankingScope = "local" | "state" | "global";

export const Route = createFileRoute("/_authenticated/ranking")({
  head: () => ({
    meta: [
      { title: "Ranking dos Boleiros — The Match" },
      {
        name: "description",
        content:
          "Leaderboards locais, estaduais e globais dos melhores jogadores da várzea, por nota média e partidas disputadas.",
      },
      { property: "og:title", content: "Ranking dos Boleiros — The Match" },
      {
        property: "og:description",
        content: "Suba no pódio do seu bairro, do seu estado e do Brasil inteiro.",
      },
    ],
  }),
  component: RankingPage,
});

const scopes: { value: RankingScope; label: string }[] = [
  { value: "local", label: "Bairro" },
  { value: "state", label: "Estado" },
  { value: "global", label: "Global" },
];

const podium = ["text-gold", "text-silver", "text-bronze"];

function RankingPage() {
  const { profile } = useAuth();
  const [scope, setScope] = useState<RankingScope>("local");

  const rankingQuery = useQuery({
    queryKey: ["ranking", scope, profile?.city ?? "", profile?.state ?? ""],
    queryFn: () =>
      fetchRanking({
        scope,
        city: profile?.city ?? null,
        state: profile?.state ?? null,
      }),
  });

  const rows = rankingQuery.data ?? [];

  return (
    <AppShell title="Ranking" subtitle="Os craques mais bem avaliados">
      <div className="mb-4 grid grid-cols-3 gap-2">
        {scopes.map((s) => (
          <Button
            key={s.value}
            size="sm"
            variant={scope === s.value ? "default" : "secondary"}
            onClick={() => setScope(s.value)}
          >
            {s.label}
          </Button>
        ))}
      </div>

      {rankingQuery.isPending ? (
        <ListSkeleton />
      ) : rankingQuery.isError ? (
        <ErrorState
          message={friendlyError(rankingQuery.error)}
          onRetry={() => void rankingQuery.refetch()}
        />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={<Trophy className="size-7" />}
          title="Ranking ainda vazio"
          description="Assim que as primeiras partidas forem encerradas e avaliadas, o pódio aparece aqui."
        />
      ) : (
        <ol className="space-y-2">
          {rows.map((row, index) => {
            const isMe = row.user_id === profile?.id;
            return (
              <li
                key={row.user_id}
                className={`flex items-center gap-3 rounded-2xl border p-3 ${
                  isMe ? "border-primary/60 bg-primary/10" : "border-border bg-card"
                }`}
              >
                <span
                  className={`text-display w-8 shrink-0 text-center text-xl font-extrabold ${
                    podium[index] ?? "text-muted-foreground"
                  }`}
                >
                  {index + 1}
                </span>
                <PlayerAvatar
                  name={row.full_name}
                  nickname={row.nickname}
                  photoUrl={row.avatar_url}
                  size="md"
                />
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1 truncate text-sm font-bold text-foreground">
                    {row.nickname || row.full_name}
                    {index === 0 ? <Crown className="size-4 text-gold" /> : null}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {row.city} · {row.matches_played} partidas
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-display text-lg font-bold text-primary">
                    {row.avg_score.toFixed(2)}
                  </p>
                  <StarRating value={Math.round(row.avg_score)} size={12} />
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </AppShell>
  );
}