import { MapPin, Navigation } from "lucide-react";

import { formatDistance } from "@/lib/geo";
import type { MatchWithRelations } from "@/lib/types";

function BallGlyph({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9.2" />
      <path d="M12 7.1 8.6 9.6l1.3 4h4.2l1.3-4Z" />
      <path d="M12 2.8v4.3M4.2 9.4l4.4.2M19.8 9.4l-4.4.2M7 20.3l2.9-6.7M17 20.3l-2.9-6.7" />
    </svg>
  );
}

function statusPill(match: MatchWithRelations) {
  if (match.status !== "active") {
    return { label: "Encerrada", tone: "muted" as const };
  }
  const start = match.scheduled_at ? new Date(match.scheduled_at).getTime() : null;
  if (start && start > Date.now()) return { label: "Vagas", tone: "green" as const };
  return { label: "Agora", tone: "green" as const };
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
  const players = match.participants.filter((p) => p.role === "player");
  const when = match.scheduled_at ?? match.created_at;
  const date = new Date(when);
  const isToday = date.toDateString() === new Date().toDateString();
  const pill = statusPill(match);
  const avatars = players.slice(0, 3);
  const extra = players.length - avatars.length;

  return (
    <button
      type="button"
      onClick={() => onSelect(match.id)}
      style={{ animationDelay: `${Math.min(index, 6) * 45}ms` }}
      className="press rise-in elevate-soft w-full rounded-[1.6rem] border border-border/60 bg-card p-4 text-left hover:shadow-[var(--shadow-raised)]"
    >
      <div className="flex items-start gap-4">
        <div className="relative shrink-0">
          <div className="grid size-16 place-items-center rounded-2xl bg-accent text-primary">
            <BallGlyph className="size-8" />
          </div>
          <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold text-primary-foreground tabular-nums">
            {players.length}
          </span>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className="min-w-0 truncate text-[17px] leading-tight font-bold text-foreground">
              {match.name ?? match.venue?.name ?? "Pelada"}
            </h3>
            <span
              className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold tracking-wide uppercase ${
                pill.tone === "green"
                  ? "bg-accent text-accent-foreground"
                  : "bg-secondary text-muted-foreground"
              }`}
            >
              {pill.label}
            </span>
          </div>

          <p className="mt-1 text-sm font-semibold text-primary">
            {isToday ? "Hoje" : date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}
            <span className="text-muted-foreground">
              {" • "}
              {date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
            </span>
          </p>

          {match.venue ? (
            <p className="mt-1.5 flex items-center gap-1.5 truncate text-xs text-muted-foreground">
              <MapPin className="size-3.5 shrink-0" />
              <span className="truncate">{match.venue.name}</span>
            </p>
          ) : null}
          {distance != null ? (
            <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
              <Navigation className="size-3.5 shrink-0" />
              {formatDistance(distance)} de você
            </p>
          ) : null}

          <div className="mt-3 flex items-center justify-between gap-3">
            <div className="flex items-center">
              {avatars.map((p) => (
                <span
                  key={p.id}
                  className="-mr-2 size-8 overflow-hidden rounded-full border-2 border-card bg-surface-2"
                >
                  {p.profile?.avatar_url ? (
                    <img
                      src={p.profile.avatar_url}
                      alt=""
                      loading="lazy"
                      className="size-full object-cover"
                    />
                  ) : null}
                </span>
              ))}
              {extra > 0 ? (
                <span className="ml-3 grid size-8 place-items-center rounded-full bg-secondary text-[10px] font-bold text-muted-foreground">
                  +{extra}
                </span>
              ) : null}
            </div>
            {match.status === "active" ? (
              <span className="rounded-2xl bg-accent px-4 py-2 text-sm font-bold text-accent-foreground">
                Entrar
              </span>
            ) : null}
          </div>
        </div>
      </div>
    </button>
  );
}
