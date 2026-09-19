import { Clock3, MapPin, Navigation, Star, Users } from "lucide-react";

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
  const full = isFull(match);

  return (
    <Button
      type="button"
      variant="ghost"
      onClick={() => onSelect(match.id)}
      className={`group relative block w-full overflow-hidden border border-primary-foreground/10 p-0 text-left shadow-[var(--shadow-float)] ${
        compact ? "h-[23rem] rounded-[2.5rem]" : "h-56 rounded-[2rem]"
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
      {/* palavra gigante ao fundo, como na referência */}
      <span
        aria-hidden
        className={`pointer-events-none absolute inset-x-0 select-none text-center font-extrabold uppercase leading-none tracking-tight text-primary-foreground/15 ${
          compact ? "top-10 text-[4.75rem]" : "top-6 text-[3.25rem]"
        }`}
      >
        Futebol
      </span>
      <span className="absolute inset-0 bg-gradient-to-t from-foreground via-foreground/45 to-transparent" />

      {/* chip superior direito: jogadores */}
      <span className="absolute top-4 right-4 flex items-center gap-1.5 rounded-full bg-foreground/55 px-3.5 py-2 text-[11px] font-extrabold text-primary-foreground backdrop-blur-md">
        <Users className="size-3.5 text-primary" />
        {players}/{capacity}
      </span>

      {full ? (
        <span className="absolute top-4 left-4 flex items-center gap-1.5 rounded-full bg-foreground/55 px-3.5 py-2 text-[11px] font-extrabold uppercase tracking-wide text-primary-foreground backdrop-blur-md">
          <Star className="size-3.5 text-primary" />
          Cheia
        </span>
      ) : null}

      <span className={`absolute inset-x-0 bottom-0 block text-primary-foreground ${compact ? "p-6" : "p-4"}`}>
        <span className="flex items-end justify-between gap-3">
          <span className="min-w-0">
            <span className={`block truncate font-extrabold tracking-tight ${compact ? "text-[1.65rem] leading-tight" : "text-lg"}`}>
              {title}
            </span>
            <span className="mt-1.5 flex min-w-0 items-center gap-1.5 text-xs font-medium text-primary-foreground/85">
              <MapPin className="size-3.5 shrink-0 text-primary" />
              <span className="truncate">{match.venue?.name ?? "Local a confirmar"}</span>
            </span>
          </span>
          {compact ? (
            <span className="inline-flex shrink-0 items-center rounded-full bg-primary px-5 py-2.5 text-[11px] font-extrabold uppercase tracking-wide text-primary-foreground">
              Ver partida
            </span>
          ) : null}
        </span>

        <span className="mt-3 flex items-center justify-between gap-3">
          <span className="flex items-center gap-1.5 text-[11px] font-semibold text-primary-foreground/90">
            <Clock3 className="size-3.5" />
            {today ? "Hoje" : date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })} •{" "}
            {date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
          </span>
          {distance != null ? (
            <span className="flex items-center gap-1.5 text-[11px] font-bold text-primary-foreground/90">
              <Navigation className="size-3.5 text-primary" />
              {formatDistance(distance)}
            </span>
          ) : null}
        </span>
      </span>
    </Button>
  );
}
