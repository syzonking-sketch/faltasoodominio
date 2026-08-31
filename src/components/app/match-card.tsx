import { Clock, MapPin, Navigation, Users, Eye } from "lucide-react";

import { formatDistance } from "@/lib/geo";
import type { MatchWithRelations } from "@/lib/types";

function Chip({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-2.5 py-1 text-[11px] font-medium text-secondary-foreground">
      <span className="text-muted-foreground [&>svg]:size-3.5">{icon}</span>
      {children}
    </span>
  );
}

export function MatchCard({
  match,
  distance,
  index = 0,
  onSelect,
}: {
  match: MatchWithRelations;
  distance?: number | null;
  index?: number;
  onSelect: (id: string) => void;
}) {
  const players = match.participants.filter((p) => p.role === "player").length;
  const spectators = match.participants.filter((p) => p.role === "spectator").length;
  const live = match.status === "active";
  const when = match.scheduled_at ?? match.created_at;

  return (
    <button
      type="button"
      onClick={() => onSelect(match.id)}
      style={{ animationDelay: `${Math.min(index, 6) * 45}ms` }}
      className="press rise-in elevate-soft w-full rounded-2xl border border-border bg-card p-4 text-left hover:border-primary/40 hover:shadow-[var(--shadow-raised)]"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            {live ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-accent px-2 py-0.5 text-[10px] font-bold tracking-wide text-accent-foreground uppercase">
                <span className="size-1.5 rounded-full bg-live" />
                Ao vivo
              </span>
            ) : (
              <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-bold tracking-wide text-muted-foreground uppercase">
                Encerrada
              </span>
            )}
            <span className="text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
              {match.match_type}
            </span>
          </div>
          <p className="mt-1.5 truncate text-[15px] font-bold text-foreground">
            {match.name ?? match.venue?.name ?? "Pelada"}
          </p>
          {match.venue ? (
            <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-muted-foreground">
              <MapPin className="size-3.5 shrink-0" />
              <span className="truncate">{match.venue.address ?? match.venue.name}</span>
            </p>
          ) : null}
        </div>

        <div className="shrink-0 text-right">
          <p className="text-display text-2xl leading-none font-extrabold text-foreground tabular-nums">
            {match.score_team_a}–{match.score_team_b}
          </p>
          {distance != null ? (
            <p className="mt-1.5 inline-flex items-center gap-1 text-xs font-semibold text-primary">
              <Navigation className="size-3.5" />
              {formatDistance(distance)}
            </p>
          ) : null}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        <Chip icon={<Clock />}>
          {new Date(when).toLocaleString("pt-BR", {
            day: "2-digit",
            month: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </Chip>
        <Chip icon={<Users />}>{players} jogadores</Chip>
        {spectators > 0 ? <Chip icon={<Eye />}>{spectators} torcida</Chip> : null}
      </div>
    </button>
  );
}
