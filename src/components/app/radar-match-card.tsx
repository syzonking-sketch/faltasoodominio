import { Clock3, MapPin, Navigation, Users } from "lucide-react";

import footballImage from "@/assets/radar-football.jpg";
import { Button } from "@/components/ui/button";
import { formatDistance } from "@/lib/geo";
import { isFull, maxPlayers, playerCount } from "@/lib/match-utils";
import type { MatchWithRelations } from "@/lib/types";

export function RadarMatchCard({
  match,
  distance,
  compact = false,
  onSelect,
}: {
  match: MatchWithRelations;
  distance?: number | null;
  compact?: boolean;
  onSelect: (id: string) => void;
}) {
  const date = new Date(match.scheduled_at ?? match.created_at);
  const today = date.toDateString() === new Date().toDateString();
  const players = playerCount(match);
  const capacity = maxPlayers(match);

  return (
    <Button
      type="button"
      variant="ghost"
      onClick={() => onSelect(match.id)}
      className={`group relative block w-full overflow-hidden rounded-[1.75rem] border border-primary-foreground/15 p-0 text-left shadow-[var(--shadow-float)] ${
        compact ? "h-56" : "h-52"
      }`}
    >
      <img
        src={footballImage}
        alt="Partida de futebol de bairro"
        loading="lazy"
        width={1280}
        height={960}
        className="absolute inset-0 size-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
      />
      <span className="absolute inset-0 bg-gradient-to-t from-foreground via-foreground/35 to-transparent" />

      <span className="absolute inset-x-0 bottom-0 block p-4 text-primary-foreground">
        <span className="mb-2 flex items-center justify-between gap-3">
          <span className="min-w-0 truncate text-lg font-extrabold">
            {match.name ?? match.venue?.name ?? "Partida de futebol"}
          </span>
          <span className="shrink-0 rounded-full bg-primary px-3 py-1 text-[10px] font-extrabold uppercase text-primary-foreground">
            {isFull(match) ? "Cheia" : "Vagas"}
          </span>
        </span>
        <span className="flex min-w-0 items-center gap-1.5 text-xs font-medium text-primary-foreground/85">
          <MapPin className="size-3.5 shrink-0" />
          <span className="truncate">{match.venue?.name ?? "Local a confirmar"}</span>
        </span>
        <span className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-semibold text-primary-foreground/90">
          <span className="flex items-center gap-1"><Clock3 className="size-3.5" />{today ? "Hoje" : date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })} • {date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span>
          <span className="flex items-center gap-1"><Users className="size-3.5" />{players}/{capacity} jogadores</span>
          {distance != null ? <span className="flex items-center gap-1"><Navigation className="size-3.5" />{formatDistance(distance)}</span> : null}
        </span>
      </span>
    </Button>
  );
}