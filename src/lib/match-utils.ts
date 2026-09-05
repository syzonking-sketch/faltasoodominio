import type { Match, MatchStatus, MatchWithRelations } from "./types";

/** Capacidade padrão quando a partida não define `max_players` no banco. */
export const DEFAULT_MAX_PLAYERS = 10;

/** Duração padrão (minutos) quando a partida não tem `finished_at` salvo. */
export const DEFAULT_DURATION_MINUTES = 60;

export function matchStart(match: Pick<Match, "scheduled_at" | "created_at">): Date {
  return new Date(match.scheduled_at ?? match.created_at);
}

/**
 * Horário de término real. Usa `finished_at` quando existe; caso contrário
 * assume início + duração padrão, para que partidas antigas também encerrem.
 * Todos os valores são instantes absolutos (UTC no banco), comparados com o
 * relógio local do usuário — o fuso é respeitado automaticamente.
 */
export function matchEnd(
  match: Pick<Match, "finished_at" | "scheduled_at" | "created_at">,
): Date | null {
  if (match.finished_at) return new Date(match.finished_at);
  const start = matchStart(match);
  if (Number.isNaN(start.getTime())) return null;
  return new Date(start.getTime() + DEFAULT_DURATION_MINUTES * 60_000);
}

/** True quando o horário de término já passou. */
export function isExpired(
  match: Pick<Match, "finished_at" | "status" | "scheduled_at" | "created_at">,
): boolean {
  if (match.status !== "active") return false;
  const end = matchEnd(match);
  return end !== null && end.getTime() <= Date.now();
}


/** Status considerando o encerramento automático por horário. */
export function effectiveStatus(
  match: Pick<Match, "finished_at" | "status" | "scheduled_at" | "created_at">,
): MatchStatus {
  return isExpired(match) ? "finished" : match.status;
}

export function maxPlayers(match: Pick<Match, "max_players">): number {
  return match.max_players && match.max_players > 0 ? match.max_players : DEFAULT_MAX_PLAYERS;
}

export function playerCount(match: Pick<MatchWithRelations, "participants">): number {
  return match.participants.filter((p) => p.role === "player").length;
}

export function isFull(match: MatchWithRelations): boolean {
  return playerCount(match) >= maxPlayers(match);
}

export function sideCount(match: MatchWithRelations, side: "A" | "B"): number {
  return match.participants.filter((p) => p.role === "player" && p.team_side === side).length;
}
