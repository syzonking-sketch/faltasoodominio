import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Flag, Goal, Loader2, Repeat2, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  fetchRefereeBoard,
  refereeAddEvent,
  refereeFinish,
  refereeRemoveEvent,
  setRefereeName,
} from "@/lib/api";
import { friendlyError } from "@/lib/supabase";
import type { MatchEventType, TeamSide } from "@/lib/types";

export const Route = createFileRoute("/juiz/$token")({
  head: () => ({
    meta: [
      { title: "Súmula do juiz — The Match" },
      { name: "description", content: "Registre gols, cartões e substituições do contra em tempo real." },
      { property: "og:title", content: "Súmula do juiz — The Match" },
      { property: "og:description", content: "Registre gols, cartões e substituições do contra em tempo real." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: RefereePage,
});

const eventLabel: Record<MatchEventType, string> = {
  goal: "Gol",
  yellow_card: "Cartão amarelo",
  red_card: "Cartão vermelho",
  substitution: "Substituição",
};

function RefereePage() {
  const { token } = Route.useParams();
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [eventType, setEventType] = useState<MatchEventType>("goal");
  const [teamSide, setTeamSide] = useState<TeamSide>("A");
  const [playerId, setPlayerId] = useState("");
  const [relatedPlayerId, setRelatedPlayerId] = useState("");
  const [minute, setMinute] = useState("");

  const boardQuery = useQuery({
    queryKey: ["referee-board", token],
    queryFn: () => fetchRefereeBoard(token),
    refetchInterval: 20000,
  });

  const refresh = () => void queryClient.invalidateQueries({ queryKey: ["referee-board", token] });

  const saveName = useMutation({
    mutationFn: () => setRefereeName(token, name.trim()),
    onSuccess: () => {
      toast.success("Bem-vindo, juiz!");
      refresh();
    },
    onError: (error) => toast.error(friendlyError(error)),
  });

  const addEvent = useMutation({
    mutationFn: () => {
      if (!playerId) throw new Error("Selecione o jogador.");
      if (eventType === "substitution" && !relatedPlayerId) throw new Error("Selecione quem entra.");
      return refereeAddEvent({
        token,
        player_id: playerId,
        team_side: teamSide,
        event_type: eventType,
        minute: minute ? Number(minute) : null,
        related_player_id: eventType === "substitution" ? relatedPlayerId : null,
      });
    },
    onSuccess: () => {
      toast.success("Registrado na súmula.");
      setPlayerId("");
      setRelatedPlayerId("");
      setMinute("");
      refresh();
    },
    onError: (error) => toast.error(friendlyError(error)),
  });

  const removeEvent = useMutation({
    mutationFn: (eventId: string) => refereeRemoveEvent(token, eventId),
    onSuccess: () => {
      toast.success("Evento removido.");
      refresh();
    },
    onError: (error) => toast.error(friendlyError(error)),
  });

  const finish = useMutation({
    mutationFn: () => refereeFinish(token),
    onSuccess: () => {
      toast.success("Fim de jogo. Súmula encerrada!");
      refresh();
    },
    onError: (error) => toast.error(friendlyError(error)),
  });

  if (boardQuery.isPending) {
    return (
      <main className="grid min-h-dvh place-items-center bg-background">
        <Loader2 className="size-6 animate-spin text-primary" />
      </main>
    );
  }

  if (boardQuery.isError || !boardQuery.data) {
    return (
      <main className="grid min-h-dvh place-items-center bg-background p-6 text-center">
        <div className="max-w-sm space-y-2">
          <h1 className="text-display text-2xl font-extrabold">Link inválido</h1>
          <p className="text-sm text-muted-foreground">
            Este convite de juiz não existe mais. Peça um novo link para o capitão.
          </p>
        </div>
      </main>
    );
  }

  const board = boardQuery.data;
  const confronto = board.confronto;
  const finished = confronto.status === "confirmed" || board.match?.status === "finished";
  const players = board.players;
  const sidePlayers = players.filter((player) => player.team_side === teamSide);
  const selectClass = "h-11 w-full min-w-0 rounded-xl border border-border/60 bg-surface-2/70 px-3 text-sm";

  if (!confronto.referee_name) {
    return (
      <main className="grid min-h-dvh place-items-center bg-background p-6">
        <div className="w-full max-w-sm space-y-4 rounded-3xl border border-border/50 bg-surface-2/60 p-6">
          <div>
            <p className="text-[10px] font-bold tracking-[0.18em] text-primary uppercase">
              Jogo {confronto.match_number != null ? `#${confronto.match_number}` : ""}
            </p>
            <h1 className="text-display text-2xl font-extrabold">
              {confronto.team_a?.name ?? "Time A"} × {confronto.team_b?.name ?? "Time B"}
            </h1>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="referee-name" className="text-sm font-semibold">Seu nome</Label>
            <Input
              id="referee-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Como quer ser chamado?"
              className="h-11 rounded-xl bg-surface"
            />
          </div>
          <Button
            className="h-12 w-full rounded-xl text-base font-bold"
            disabled={saveName.isPending || name.trim().length < 2}
            onClick={() => saveName.mutate()}
          >
            {saveName.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
            Começar a apitar
          </Button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-dvh bg-background pb-12">
      <div className="mx-auto w-full max-w-lg space-y-4 px-4 pt-8">
        <header>
          <p className="text-[10px] font-bold tracking-[0.18em] text-primary uppercase">
            Jogo {confronto.match_number != null ? `#${confronto.match_number}` : ""} · Juiz {confronto.referee_name}
          </p>
          <h1 className="text-display text-2xl leading-tight font-extrabold break-words">
            {confronto.team_a?.name ?? "Time A"} × {confronto.team_b?.name ?? "Time B"}
          </h1>
          {confronto.venue?.name ? (
            <p className="text-sm text-muted-foreground">{confronto.venue.name}</p>
          ) : null}
        </header>

        <div className="flex items-center justify-center gap-4 rounded-3xl border border-primary/25 bg-surface-2/60 p-6">
          <span className="text-display text-4xl font-extrabold">{board.match?.score_team_a ?? 0}</span>
          <span className="text-lg font-bold text-primary">×</span>
          <span className="text-display text-4xl font-extrabold">{board.match?.score_team_b ?? 0}</span>
        </div>

        {finished ? (
          <p className="rounded-2xl border border-border/60 bg-surface-2/60 p-4 text-center text-sm text-muted-foreground">
            Jogo encerrado. Obrigado por apitar!
          </p>
        ) : (
          <div className="space-y-3 rounded-3xl border border-primary/25 bg-surface-2/70 p-4">
            <p className="text-sm font-bold">Registrar evento</p>
            <div className="grid grid-cols-2 gap-2">
              <select
                className={selectClass}
                value={eventType}
                onChange={(event) => { setEventType(event.target.value as MatchEventType); setRelatedPlayerId(""); }}
              >
                <option value="goal">Gol</option>
                <option value="yellow_card">Cartão amarelo</option>
                <option value="red_card">Cartão vermelho</option>
                <option value="substitution">Substituição</option>
              </select>
              <select
                className={selectClass}
                value={teamSide}
                onChange={(event) => { setTeamSide(event.target.value as TeamSide); setPlayerId(""); setRelatedPlayerId(""); }}
              >
                <option value="A">{confronto.team_a?.name ?? "Time A"}</option>
                <option value="B">{confronto.team_b?.name ?? "Time B"}</option>
              </select>
            </div>
            <div className="grid grid-cols-[1fr_5rem] gap-2">
              <select className={selectClass} value={playerId} onChange={(event) => setPlayerId(event.target.value)}>
                <option value="">{eventType === "substitution" ? "Quem sai" : "Jogador"}</option>
                {sidePlayers.map((player) => (
                  <option key={player.id} value={player.id}>{player.name ?? "Jogador"}</option>
                ))}
              </select>
              <Input
                inputMode="numeric"
                placeholder="Min."
                value={minute}
                onChange={(event) => setMinute(event.target.value)}
                className="h-11 rounded-xl bg-surface"
              />
            </div>
            {eventType === "substitution" ? (
              <select className={selectClass} value={relatedPlayerId} onChange={(event) => setRelatedPlayerId(event.target.value)}>
                <option value="">Quem entra</option>
                {sidePlayers.filter((player) => player.id !== playerId).map((player) => (
                  <option key={player.id} value={player.id}>{player.name ?? "Jogador"}</option>
                ))}
              </select>
            ) : null}
            <div className="flex gap-2">
              <Button className="h-11 flex-1 rounded-xl" disabled={addEvent.isPending || !playerId} onClick={() => addEvent.mutate()}>
                {addEvent.isPending ? <Loader2 className="size-4 animate-spin" /> : null} Registrar
              </Button>
              <Button variant="outline" className="h-11 rounded-xl" disabled={finish.isPending} onClick={() => finish.mutate()}>
                <Flag className="size-4" /> Fim de jogo
              </Button>
            </div>
          </div>
        )}

        <section>
          <h2 className="mb-2 text-[11px] font-bold tracking-[0.14em] text-muted-foreground uppercase">Súmula</h2>
          {board.events.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
              Nada registrado ainda.
            </p>
          ) : (
            <ul className="space-y-2">
              {board.events.map((event) => (
                <li key={event.id} className="flex items-center gap-3 rounded-2xl border border-border/50 bg-surface-2/70 p-3">
                  <span className="grid size-8 shrink-0 place-items-center rounded-full bg-surface">
                    {event.event_type === "yellow_card" ? (
                      <span className="size-3.5 rounded-[3px] bg-warning" />
                    ) : event.event_type === "red_card" ? (
                      <span className="size-3.5 rounded-[3px] bg-destructive" />
                    ) : event.event_type === "substitution" ? (
                      <Repeat2 className="size-4 text-accent" />
                    ) : (
                      <Goal className="size-4 text-primary" />
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">
                      {event.player_name ?? "Jogador"}
                      {event.event_type === "substitution" && event.related_player_name
                        ? ` → ${event.related_player_name}`
                        : ""}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {eventLabel[event.event_type]} · Time {event.team_side}
                      {event.minute != null ? ` · ${event.minute}'` : ""}
                    </p>
                  </div>
                  {finished ? null : (
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label="Remover evento"
                      disabled={removeEvent.isPending}
                      onClick={() => removeEvent.mutate(event.id)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}
