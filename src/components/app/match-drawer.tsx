import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Flag, Loader2, MapPin, Users, Eye, Ban, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";

import { PlayerAvatar } from "@/components/app/player-avatar";
import { PlayerProfileDialog } from "@/components/app/player-profile-dialog";
import { StarRating } from "@/components/app/star-rating";
import { ErrorState, ListSkeleton } from "@/components/app/states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  cancelMatch,
  assignMatchScorekeeper,
  fetchMatch,
  autoFinishIfExpired,
  fetchRatingsByEvaluator,
  finishMatch,
  joinMatch,
  submitRating,
  updateMatchScore,
} from "@/lib/api";
import { effectiveStatus, isFull, maxPlayers, playerCount, sideCount } from "@/lib/match-utils";
import { useAuth } from "@/lib/auth";
import { distanceMeters, GPS_CHECKIN_RADIUS, type Coords } from "@/lib/geo";
import { friendlyError } from "@/lib/supabase";
import type { MatchParticipant, Profile, TeamSide } from "@/lib/types";

export function MatchDrawer({
  matchId,
  onOpenChange,
  myCoords,
}: {
  matchId: string | null;
  onOpenChange: (open: boolean) => void;
  myCoords: Coords | null;
}) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedPlayer, setSelectedPlayer] = useState<Profile | null>(null);

  const matchQuery = useQuery({
    queryKey: ["match", matchId],
    enabled: Boolean(matchId),
    queryFn: async () => {
      const data = await fetchMatch(matchId!);
      // Encerramento automático quando o horário de término já passou.
      if (data) await autoFinishIfExpired(data);
      return data;
    },
    refetchInterval: 15000,
  });

  const ratingsQuery = useQuery({
    queryKey: ["my-ratings", user?.id],
    enabled: Boolean(user?.id),
    queryFn: () => fetchRatingsByEvaluator(user!.id),
  });

  const match = matchQuery.data ?? null;
  const status = match ? effectiveStatus(match) : null;
  const total = match ? playerCount(match) : 0;
  const capacity = match ? maxPlayers(match) : 0;
  const full = match ? isFull(match) : false;
  const participants = match?.participants ?? [];
  const players = participants.filter((p) => p.role === "player");
  const spectators = participants.filter((p) => p.role === "spectator");
  const mine = participants.find((p) => p.user_id === user?.id) ?? null;
  const isOwner = Boolean(match && user && match.created_by === user.id);
  const canEditScore = Boolean(match && user && match.scorekeeper_id === user.id && status === "active");
  const scorekeeper = participants.find((participant) => participant.user_id === match?.scorekeeper_id) ?? null;

  const venueCoords: Coords | null = match?.venue
    ? { lat: Number(match.venue.latitude), lng: Number(match.venue.longitude) }
    : null;
  const distance = myCoords && venueCoords ? distanceMeters(myCoords, venueCoords) : null;
  const withinRadius = distance !== null && distance <= GPS_CHECKIN_RADIUS;

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["match", matchId] });
    void queryClient.invalidateQueries({ queryKey: ["matches"] });
    void queryClient.invalidateQueries({ queryKey: ["ranking"] });
  };

  const join = useMutation({
    mutationFn: (input: { role: "player" | "spectator"; team_side: TeamSide | null }) =>
      joinMatch({
        match_id: match?.id ?? matchId,
        user_id: user?.id,
        role: input.role,
        team_side: input.team_side,
        checked_in_gps: withinRadius,
      }),
    onSuccess: () => {
      toast.success(withinRadius ? "Check-in por GPS confirmado!" : "Entrou na súmula (sem GPS).");
      invalidate();
    },
    onError: (error) => toast.error(friendlyError(error)),
  });

  const saveScore = useMutation({
    mutationFn: (input: { score_team_a: number; score_team_b: number }) => {
      if (!match?.id) throw new Error("Partida não carregada.");
      return updateMatchScore({ match_id: match.id, ...input });
    },
    onSuccess: () => {
      toast.success("Placar atualizado!");
      invalidate();
    },
    onError: (error) => toast.error(friendlyError(error)),
  });

  const assignScorekeeper = useMutation({
    mutationFn: (scorekeeperId: string | null) => {
      if (!match?.id) throw new Error("Partida não carregada.");
      return assignMatchScorekeeper({ match_id: match.id, scorekeeper_id: scorekeeperId });
    },
    onSuccess: () => {
      toast.success("Responsável pelo placar atualizado!");
      invalidate();
    },
    onError: (error) => toast.error(friendlyError(error)),
  });

  const finish = useMutation({
    mutationFn: () =>
      finishMatch({
        match_id: matchId!,
      }),
    onSuccess: () => {
      toast.success("Partida encerrada. Hora de avaliar!");
      invalidate();
    },
    onError: (error) => toast.error(friendlyError(error)),
  });

  const cancel = useMutation({
    mutationFn: () => cancelMatch(matchId!),
    onSuccess: () => {
      toast.success("Partida cancelada.");
      invalidate();
      onOpenChange(false);
    },
    onError: (error) => toast.error(friendlyError(error)),
  });

  const rate = useMutation({
    mutationFn: (input: { target: MatchParticipant; score: number }) =>
      submitRating({
        match_id: matchId!,
        evaluator_id: user!.id,
        evaluated_user_id: input.target.user_id,
        score: input.score,
        is_opponent: Boolean(
          mine?.team_side && input.target.team_side && mine.team_side !== input.target.team_side,
        ),
      }),
    onSuccess: () => {
      toast.success("Nota registrada!");
      void queryClient.invalidateQueries({ queryKey: ["my-ratings", user?.id] });
      void queryClient.invalidateQueries({ queryKey: ["ranking"] });
    },
    onError: (error) => toast.error(friendlyError(error)),
  });

  // Qualquer participante da súmula pode avaliar depois que a partida encerra.
  const canRate = Boolean(match && effectiveStatus(match) === "finished" && mine);
  const alreadyRated = (targetId: string) =>
    (ratingsQuery.data ?? []).find((r) => r.match_id === matchId && r.evaluated_user_id === targetId);

  function renderParticipant(participant: MatchParticipant) {
    const isMe = participant.user_id === user?.id;
    const existing = alreadyRated(participant.user_id);
    return (
      <div key={participant.id} className="flex items-center gap-3 rounded-2xl bg-surface-2 p-3">
        <Button
          type="button"
          variant="ghost"
          className="h-auto min-w-0 flex-1 justify-start gap-3 p-0 text-left hover:bg-transparent"
          disabled={!participant.profile}
          onClick={() => setSelectedPlayer(participant.profile ?? null)}
        >
          <PlayerAvatar
            name={participant.profile?.full_name ?? "Boleiro"}
            nickname={participant.profile?.nickname ?? null}
            photoUrl={participant.profile?.avatar_url ?? null}
          />
          <div className="min-w-0 flex-1">
          <p className="text-display truncate text-base font-bold text-foreground">
            {participant.profile?.nickname ?? "Boleiro"}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {participant.profile?.full_name ?? ""}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            {participant.team_side ? (
              <Badge variant="secondary" className="text-[10px]">
                Time {participant.team_side}
              </Badge>
            ) : null}
            {participant.checked_in_gps ? (
              <Badge className="bg-primary/20 text-[10px] text-primary">GPS ✓</Badge>
            ) : (
              <Badge variant="outline" className="text-[10px]">
                Sem GPS
              </Badge>
            )}
          </div>
          </div>
        </Button>
        {!isMe && participant.role === "player" ? (
          <div className="text-right">
            {existing ? (
              <StarRating value={existing.score} size={16} />
            ) : (
              <StarRating
                value={0}
                size={18}
                disabled={!canRate || rate.isPending}
                onChange={(score) => rate.mutate({ target: participant, score })}
              />
            )}
            {!canRate ? (
              <p className="mt-1 text-[10px] text-muted-foreground">
                Avalie quando a partida encerrar
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <Drawer open={Boolean(matchId)} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[calc(100dvh-env(safe-area-inset-top,0px)-0.75rem)]">
        <div className="mx-auto min-h-0 w-full max-w-2xl flex-1 touch-pan-y overflow-y-auto overscroll-contain px-4 pb-[calc(2rem+env(safe-area-inset-bottom,0px))]">
          <DrawerHeader className="px-0">
            <DrawerTitle className="text-display text-2xl">
              {match?.venue?.name ?? "Súmula digital"}
            </DrawerTitle>
            <DrawerDescription className="flex items-center gap-1.5 text-xs">
              <MapPin className="size-3.5" />
              {match?.venue?.address ?? "Carregando dados da partida…"}
            </DrawerDescription>
          </DrawerHeader>

          {matchQuery.isPending ? (
            <ListSkeleton rows={3} />
          ) : matchQuery.isError ? (
            <ErrorState
              message={friendlyError(matchQuery.error)}
              onRetry={() => void matchQuery.refetch()}
            />
          ) : !match ? (
            <ErrorState message="Partida não encontrada." />
          ) : (
            <div className="space-y-5">
              <div className="flex items-center justify-between rounded-2xl border border-border bg-card p-4">
                <div className="text-center">
                  <p className="text-xs text-muted-foreground">Time A</p>
                  <p className="text-display text-4xl font-extrabold text-foreground">
                    {match.score_team_a}
                  </p>
                </div>
                <div className="text-center">
                  <Badge
                    className={
                      status === "active"
                        ? "bg-primary/20 text-primary"
                        : status === "finished"
                          ? "bg-surface-2 text-muted-foreground"
                          : "bg-destructive/20 text-destructive"
                    }
                  >
                    {status === "active"
                      ? "AO VIVO"
                      : status === "finished"
                        ? "ENCERRADA"
                        : "CANCELADA"}
                  </Badge>
                  <div className="mt-2 flex flex-col items-center gap-1">
                    <Badge variant="outline" className="text-[9px] font-bold uppercase tracking-widest text-primary/80 border-primary/20">
                      {match.match_type}
                    </Badge>
                    <div className="flex items-center gap-3 text-[10px] text-muted-foreground font-medium">
                      {match.scheduled_at && (
                        <span className="flex items-center gap-1">
                          <span className="h-1.5 w-1.5 rounded-full bg-primary/40" />
                          {new Date(match.scheduled_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" })}
                          {" às "}
                          {new Date(match.scheduled_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="text-center">
                  <p className="text-xs text-muted-foreground">Time B</p>
                  <p className="text-display text-4xl font-extrabold text-foreground">
                    {match.score_team_b}
                  </p>
                </div>
              </div>

              <div className="space-y-3 rounded-2xl border border-border bg-card p-4">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="size-4 text-primary" />
                  <div>
                    <p className="text-xs font-semibold text-foreground">Responsável pelo placar</p>
                    <p className="text-xs text-muted-foreground">
                      {scorekeeper?.profile?.nickname ?? scorekeeper?.profile?.full_name ?? (match.scorekeeper_id ? "Participante" : "Ainda não definido")}
                    </p>
                  </div>
                </div>
                {isOwner && status === "active" ? (
                  <Select
                    value={match.scorekeeper_id ?? "none"}
                    disabled={assignScorekeeper.isPending}
                    onValueChange={(value) => assignScorekeeper.mutate(value === "none" ? null : value)}
                  >
                    <SelectTrigger aria-label="Escolher responsável pelo placar">
                      <SelectValue placeholder="Escolher participante" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Escolher depois</SelectItem>
                      {participants.map((participant) => (
                        <SelectItem key={participant.id} value={participant.user_id}>
                          {participant.profile?.nickname ?? participant.profile?.full_name ?? "Boleiro"}
                          {participant.user_id === user?.id ? " (você)" : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : null}
              </div>

              {canEditScore ? (
                <div className="space-y-3 rounded-2xl border border-border bg-card p-4">
                  <p className="text-xs font-semibold text-foreground">Placar da partida</p>
                  <div className="grid grid-cols-2 gap-3">
                    {(["A", "B"] as const).map((side) => {
                      const current = side === "A" ? match.score_team_a : match.score_team_b;
                      const apply = (delta: number) =>
                        saveScore.mutate({
                          score_team_a: side === "A" ? Math.max(0, match.score_team_a + delta) : match.score_team_a,
                          score_team_b: side === "B" ? Math.max(0, match.score_team_b + delta) : match.score_team_b,
                        });
                      return (
                        <div key={side} className="rounded-2xl bg-surface-2 p-3 text-center">
                          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                            Time {side}
                          </p>
                          <div className="mt-2 flex items-center justify-center gap-3">
                            <Button
                              type="button"
                              size="icon"
                              variant="outline"
                              aria-label={`Remover gol do time ${side}`}
                              disabled={saveScore.isPending || current <= 0}
                              onClick={() => apply(-1)}
                            >
                              −
                            </Button>
                            <span className="text-display min-w-8 text-3xl font-extrabold tabular-nums text-foreground">
                              {current}
                            </span>
                            <Button
                              type="button"
                              size="icon"
                              aria-label={`Adicionar gol do time ${side}`}
                              disabled={saveScore.isPending}
                              onClick={() => apply(1)}
                            >
                              +
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : status === "active" && !match.scorekeeper_id ? (
                <p className="rounded-2xl border border-dashed border-border p-3 text-center text-xs text-muted-foreground">
                  O criador ainda não escolheu o responsável pelo placar.
                </p>
              ) : null}

              {status === "active" ? (
                <div className="space-y-3 rounded-2xl border border-border bg-card p-4">
                  {mine ? (
                    <p className="flex items-center gap-2 text-sm text-primary">
                      <CheckCircle2 className="size-4" /> Você está na súmula como{" "}
                      {mine.role === "player" ? "jogador" : "telespectador"}.
                    </p>
                  ) : (
                    <>
                      <p className="text-xs text-muted-foreground">
                        {distance !== null
                          ? withinRadius
                            ? "Você está na quadra — check-in por GPS liberado."
                            : "Você está longe da quadra: entra sem check-in de GPS e não poderá avaliar."
                          : "Ative o GPS para validar sua presença."}
                      </p>
                      <p className="text-xs font-semibold text-foreground tabular-nums">
                        Jogadores: {total}/{capacity}
                        {full ? " — partida cheia" : ""}
                      </p>
                      <div className="grid grid-cols-3 gap-2">
                        <Button
                          size="sm"
                          disabled={full || join.isPending || !match.id}
                          onClick={() => join.mutate({ role: "player", team_side: "A" })}
                        >
                          Time A ({sideCount(match, "A")})
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          disabled={full || join.isPending || !match.id}
                          onClick={() => join.mutate({ role: "player", team_side: "B" })}
                        >
                          Time B ({sideCount(match, "B")})
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={join.isPending || !match.id}
                          onClick={() => join.mutate({ role: "spectator", team_side: null })}
                        >
                          Assistir
                        </Button>
                      </div>
                    </>
                  )}

                  {isOwner ? (
                    <>
                      <Separator />
                      <p className="text-xs font-semibold text-foreground">Encerrar partida (só o criador pode)</p>
                      <div>
                        <Button onClick={() => finish.mutate()} disabled={finish.isPending}>
                          {finish.isPending ? (
                            <Loader2 className="size-4 animate-spin" />
                          ) : (
                            <Flag className="size-4" />
                          )}
                          Encerrar
                        </Button>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive"
                        onClick={() => cancel.mutate()}
                      >
                        <Ban className="size-4" /> Cancelar partida
                      </Button>
                    </>
                  ) : null}
                </div>
              ) : null}

              <section>
                <h3 className="text-display mb-2 flex items-center gap-2 text-lg text-foreground">
                  <Users className="size-4 text-primary" /> Jogadores ({players.length})
                </h3>
                {players.length === 0 ? (
                  <p className="rounded-2xl border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
                    Ninguém em campo ainda.
                  </p>
                ) : (
                  <div className="space-y-2">{players.map(renderParticipant)}</div>
                )}
              </section>

              <section>
                <h3 className="text-display mb-2 flex items-center gap-2 text-lg text-foreground">
                  <Eye className="size-4 text-accent" /> Telespectadores ({spectators.length})
                </h3>
                {spectators.length === 0 ? (
                  <p className="rounded-2xl border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
                    Sem torcida registrada.
                  </p>
                ) : (
                  <div className="space-y-2">{spectators.map(renderParticipant)}</div>
                )}
              </section>
            </div>
          )}
        </div>
      </DrawerContent>
      <PlayerProfileDialog player={selectedPlayer} onOpenChange={(open) => !open && setSelectedPlayer(null)} />
    </Drawer>
  );
}