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
  const title = match.name ?? match.venue?.name ?? "Partida de futebol";

  return (
    <Button
      type="button"
      variant="ghost"
      onClick={() => onSelect(match.id)}
      className={`group relative block w-full overflow-hidden border border-primary-foreground/10 p-0 text-left shadow-[var(--shadow-float)] ${
        compact ? "h-[20rem] rounded-[2.25rem]" : "h-52 rounded-[1.75rem]"
      }`}
    >
      <img
        src={footballImage}
        alt="Partida de futebol de bairro"
        loading="lazy"
        width={1280}
        height={960}
        className="absolute inset-0 size-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
      />
      <span className="absolute inset-0 bg-gradient-to-t from-foreground via-foreground/45 to-transparent" />

      {distance != null ? (
        <span className="absolute top-4 right-4 flex items-center gap-1.5 rounded-full bg-background/90 px-3.5 py-2 text-[11px] font-extrabold text-foreground backdrop-blur-md">
          <Navigation className="size-3.5 text-primary" />
          {formatDistance(distance)}
        </span>
      ) : null}

      <span className={`absolute inset-x-0 bottom-0 block text-primary-foreground ${compact ? "p-5" : "p-4"}`}>
        <span className="mb-2 flex items-center gap-2">
          <span className="rounded-full bg-primary px-3 py-1 text-[10px] font-extrabold tracking-wide uppercase text-primary-foreground">
            {isFull(match) ? "Cheia" : "Vagas"}
          </span>
          <span className="flex items-center gap-1 rounded-full bg-background/20 px-3 py-1 text-[10px] font-bold backdrop-blur-md">
            <Users className="size-3" />
            {players}/{capacity}
          </span>
        </span>

        <span className={`block min-w-0 truncate font-extrabold tracking-tight ${compact ? "text-2xl" : "text-lg"}`}>
          {title}
        </span>

        <span className="mt-1.5 flex min-w-0 items-center gap-1.5 text-xs font-medium text-primary-foreground/85">
          <MapPin className="size-3.5 shrink-0" />
          <span className="truncate">{match.venue?.name ?? "Local a confirmar"}</span>
        </span>

        <span className="mt-4 flex items-center justify-between gap-3">
          <span className="flex items-center gap-1.5 text-[11px] font-semibold text-primary-foreground/90">
            <Clock3 className="size-3.5" />
            {today ? "Hoje" : date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })} •{" "}
            {date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
          </span>
          {compact ? (
            <span className="inline-flex items-center rounded-full bg-primary px-5 py-2.5 text-[11px] font-extrabold tracking-wide uppercase text-primary-foreground">
              Ver partida
            </span>
          ) : null}
        </span>
      </span>
    </Button>
  );
}
