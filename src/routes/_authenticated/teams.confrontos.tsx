import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Flag, Goal, Loader2, Shield, Swords, Trash2 } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { AppShell } from "@/components/app/app-shell";
import { PlayerAvatar } from "@/components/app/player-avatar";
import { EmptyState, ErrorState, FieldError, ListSkeleton } from "@/components/app/states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  addMatchEvent,
  createConfronto,
  fetchConfrontos,
  fetchMatch,
  fetchMatchEvents,
  fetchProfiles,
  fetchTeams,
  fetchVenues,
  finishRefereedMatch,
  removeMatchEvent,
} from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { confrontoSchema, type ConfrontoValues } from "@/lib/schemas";
import { friendlyError } from "@/lib/supabase";
import type { Confronto, MatchEventType, TeamSide } from "@/lib/types";

export const Route = createFileRoute("/_authenticated/teams/confrontos")({
  head: () => ({
    meta: [
      { title: "Contras entre Times — The Match" },
      {
        name: "description",
        content:
          "Agende confrontos entre times e valide o placar em dupla checagem entre capitães. Divergência anula a partida.",
      },
      { property: "og:title", content: "Contras entre Times — The Match" },
      {
        property: "og:description",
        content: "Validação cruzada de placar entre capitães, com anulação automática em caso de conflito.",
      },
    ],
  }),
  component: ConfrontosPage,
});

const statusLabel: Record<Confronto["status"], { text: string; className: string }> = {
  pending: { text: "PARTIDA MARCADA", className: "bg-accent/20 text-accent-foreground" },
  confirmed: { text: "PARTIDA ENCERRADA", className: "bg-primary/20 text-primary" },
  conflict_nullified: { text: "PARTIDA ANULADA", className: "bg-destructive/20 text-destructive" },
};

function MatchEvents({
  confronto,
  onDone,
}: {
  confronto: Confronto;
  onDone: () => void;
}) {
  const { user } = useAuth();
  const [eventType, setEventType] = useState<MatchEventType>("goal");
  const [teamSide, setTeamSide] = useState<TeamSide>("A");
  const [playerId, setPlayerId] = useState("");
  const [minute, setMinute] = useState("");
  const matchQuery = useQuery({
    queryKey: ["match", confronto.match_id],
    queryFn: () => fetchMatch(confronto.match_id ?? ""),
    enabled: Boolean(confronto.match_id),
  });
  const match = matchQuery.data;
  const eventsQuery = useQuery({
    queryKey: ["match-events", confronto.match_id],
    queryFn: () => fetchMatchEvents(confronto.match_id ?? ""),
    enabled: Boolean(confronto.match_id),
  });
  const isReferee = confronto.referee_id === user?.id;
  const players = (match?.participants ?? []).filter((participant) => participant.role === "player");
  const visiblePlayers = players.filter((participant) => participant.team_side === teamSide);

  const addEvent = useMutation({
    mutationFn: () => {
      if (!confronto.match_id || !playerId) throw new Error("Selecione o jogador.");
      return addMatchEvent({
        match_id: confronto.match_id,
        player_id: playerId,
        team_side: teamSide,
        event_type: eventType,
        minute: minute ? Number(minute) : null,
      });
    },
    onSuccess: () => {
      toast.success("Evento registrado na súmula.");
      setPlayerId("");
      setMinute("");
      void matchQuery.refetch();
      void eventsQuery.refetch();
      onDone();
    },
    onError: (error) => toast.error(friendlyError(error)),
  });
  const removeEvent = useMutation({
    mutationFn: removeMatchEvent,
    onSuccess: () => {
      toast.success("Evento removido.");
      void matchQuery.refetch();
      void eventsQuery.refetch();
      onDone();
    },
    onError: (error) => toast.error(friendlyError(error)),
  });
  const finish = useMutation({
    mutationFn: () => {
      if (!confronto.match_id) throw new Error("Partida não vinculada.");
      return finishRefereedMatch(confronto.match_id);
    },
    onSuccess: () => {
      toast.success("Fim de jogo. Súmula encerrada!");
      onDone();
    },
    onError: (error) => toast.error(friendlyError(error)),
  });

  const eventLabel: Record<MatchEventType, string> = {
    goal: "Gol",
    yellow_card: "Cartão amarelo",
    red_card: "Cartão vermelho",
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 items-center rounded-2xl bg-surface-2 p-4 text-center">
        <p className="truncate text-sm font-bold">{confronto.team_a?.name ?? "Time A"}</p>
        <p className="text-display text-3xl font-extrabold text-primary">
          {match?.score_team_a ?? 0} × {match?.score_team_b ?? 0}
        </p>
        <p className="truncate text-sm font-bold">{confronto.team_b?.name ?? "Time B"}</p>
      </div>

      <div>
        <h4 className="mb-2 text-sm font-bold text-foreground">Súmula</h4>
        {(eventsQuery.data ?? []).length === 0 ? (
          <p className="rounded-xl border border-dashed border-border p-3 text-center text-xs text-muted-foreground">
            Nenhum gol ou cartão registrado.
          </p>
        ) : (
          <ul className="space-y-2">
            {(eventsQuery.data ?? []).map((event) => (
              <li key={event.id} className="flex items-center gap-3 rounded-xl bg-surface-2 p-3">
                <span className={event.event_type === "yellow_card" ? "size-4 rounded-sm bg-warning" : event.event_type === "red_card" ? "size-4 rounded-sm bg-destructive" : "text-primary"}>
                  {event.event_type === "goal" ? <Goal className="size-4" /> : null}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{event.player?.nickname ?? event.player?.full_name ?? "Jogador"}</p>
                  <p className="text-xs text-muted-foreground">{eventLabel[event.event_type]} · Time {event.team_side}{event.minute != null ? ` · ${event.minute}'` : ""}</p>
                </div>
                {isReferee && confronto.status === "pending" ? (
                  <Button size="icon" variant="ghost" aria-label="Remover evento" disabled={removeEvent.isPending} onClick={() => removeEvent.mutate(event.id)}>
                    <Trash2 className="size-4" />
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>

      {isReferee && confronto.status === "pending" ? (
        <div className="space-y-3 rounded-2xl border border-border p-3">
          <p className="flex items-center gap-2 text-sm font-bold"><Shield className="size-4 text-primary" /> Registrar evento</p>
          <div className="grid grid-cols-2 gap-2">
            <select className="h-10 rounded-md border border-input bg-surface-2 px-3 text-sm" value={eventType} onChange={(e) => setEventType(e.target.value as MatchEventType)}>
              <option value="goal">Gol</option><option value="yellow_card">Cartão amarelo</option><option value="red_card">Cartão vermelho</option>
            </select>
            <select className="h-10 rounded-md border border-input bg-surface-2 px-3 text-sm" value={teamSide} onChange={(e) => { setTeamSide(e.target.value as TeamSide); setPlayerId(""); }}>
              <option value="A">Time A</option><option value="B">Time B</option>
            </select>
          </div>
          <div className="grid grid-cols-[1fr_5rem] gap-2">
            <select className="h-10 min-w-0 rounded-md border border-input bg-surface-2 px-3 text-sm" value={playerId} onChange={(e) => setPlayerId(e.target.value)}>
              <option value="">Jogador</option>
              {visiblePlayers.map((participant) => <option key={participant.id} value={participant.user_id}>{participant.profile?.nickname ?? participant.profile?.full_name ?? "Jogador"}</option>)}
            </select>
            <Input inputMode="numeric" placeholder="Min." value={minute} onChange={(e) => setMinute(e.target.value)} />
          </div>
          <div className="flex gap-2">
            <Button className="flex-1" disabled={addEvent.isPending || !playerId} onClick={() => addEvent.mutate()}>{addEvent.isPending ? <Loader2 className="size-4 animate-spin" /> : null} Registrar</Button>
            <Button variant="outline" disabled={finish.isPending} onClick={() => finish.mutate()}><Flag className="size-4" /> Fim de jogo</Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ConfrontosPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const confrontosQuery = useQuery({ queryKey: ["confrontos"], queryFn: fetchConfrontos });
  const teamsQuery = useQuery({ queryKey: ["teams"], queryFn: fetchTeams });
  const venuesQuery = useQuery({ queryKey: ["venues", ""], queryFn: () => fetchVenues() });
  const profilesQuery = useQuery({ queryKey: ["profiles"], queryFn: fetchProfiles });

  const teams = teamsQuery.data ?? [];
  const venues = venuesQuery.data ?? [];
  const myTeams = teams.filter((t) => t.captain_id === user?.id);

  const form = useForm<ConfrontoValues>({
    resolver: zodResolver(confrontoSchema),
    defaultValues: { team_a_id: "", team_b_id: "", venue_id: "", referee_id: "", scheduled_at: "" },
  });

  const create = useMutation({
    mutationFn: (values: ConfrontoValues) =>
      createConfronto({
        team_a_id: values.team_a_id,
        team_b_id: values.team_b_id,
        venue_id: values.venue_id,
        scheduled_at: new Date(values.scheduled_at).toISOString(),
        referee_id: values.referee_id,
      }),
    onSuccess: () => {
      toast.success("Contra marcado! Agora é só aparecer.");
      setOpen(false);
      form.reset();
      void queryClient.invalidateQueries({ queryKey: ["confrontos"] });
      void queryClient.invalidateQueries({ queryKey: ["matches"] });
    },
    onError: (error) => toast.error(friendlyError(error)),
  });

  const refresh = () => void queryClient.invalidateQueries({ queryKey: ["confrontos"] });
  const selectedConfronto = (confrontosQuery.data ?? []).find((item) => item.id === selectedId) ?? null;

  return (
    <AppShell
      title="Contras"
      subtitle="Confrontos entre times com validação cruzada"
      action={
        <div className="flex gap-2">
          <Button asChild size="sm" variant="ghost">
            <Link to="/teams">
              <ArrowLeft className="size-4" /> Times
            </Link>
          </Button>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" disabled={myTeams.length === 0}>
                Marcar
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="text-display text-2xl">Marcar contra</DialogTitle>
              </DialogHeader>
              <form className="space-y-3" onSubmit={form.handleSubmit((v) => create.mutate(v))}>
                <div>
                  <Label htmlFor="team-a">Seu time</Label>
                  <select
                    id="team-a"
                    className="h-10 w-full rounded-md border border-input bg-surface-2 px-3 text-sm text-foreground"
                    {...form.register("team_a_id")}
                  >
                    <option value="">Selecione</option>
                    {myTeams.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                  <FieldError message={form.formState.errors.team_a_id?.message} />
                </div>
                <div>
                  <Label htmlFor="team-b">Adversário</Label>
                  <select
                    id="team-b"
                    className="h-10 w-full rounded-md border border-input bg-surface-2 px-3 text-sm text-foreground"
                    {...form.register("team_b_id")}
                  >
                    <option value="">Selecione</option>
                    {teams
                      .filter((t) => t.captain_id !== user?.id)
                      .map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                  </select>
                  <FieldError message={form.formState.errors.team_b_id?.message} />
                </div>
                <div>
                  <Label htmlFor="venue">Quadra</Label>
                  <select
                    id="venue"
                    className="h-10 w-full rounded-md border border-input bg-surface-2 px-3 text-sm text-foreground"
                    {...form.register("venue_id")}
                  >
                    <option value="">Selecione</option>
                    {venues.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.name}
                      </option>
                    ))}
                  </select>
                  <FieldError message={form.formState.errors.venue_id?.message} />
                </div>
                <div>
                  <Label htmlFor="referee">Juiz</Label>
                  <select id="referee" className="h-10 w-full rounded-md border border-input bg-surface-2 px-3 text-sm text-foreground" {...form.register("referee_id")}>
                    <option value="">Buscar e selecionar usuário</option>
                    {(profilesQuery.data ?? []).map((profile) => <option key={profile.id} value={profile.id}>{profile.nickname || profile.full_name}</option>)}
                  </select>
                  <FieldError message={form.formState.errors.referee_id?.message} />
                </div>
                <div>
                  <Label htmlFor="date">Data e hora</Label>
                  <Input id="date" type="datetime-local" {...form.register("scheduled_at")} />
                  <FieldError message={form.formState.errors.scheduled_at?.message} />
                </div>
                <DialogFooter>
                  <Button type="submit" className="w-full" disabled={create.isPending}>
                    {create.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
                    Marcar contra
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      }
    >
      {confrontosQuery.isPending ? (
        <ListSkeleton />
      ) : confrontosQuery.isError ? (
        <ErrorState
          message={friendlyError(confrontosQuery.error)}
          onRetry={() => void confrontosQuery.refetch()}
        />
      ) : (confrontosQuery.data ?? []).length === 0 ? (
        <EmptyState
          icon={<Swords className="size-7" />}
          title="Nenhum contra marcado"
          description="Capitães podem marcar confrontos entre times e validar o placar em dupla checagem."
        />
      ) : (
        <ul className="space-y-3">
          {(confrontosQuery.data ?? []).map((confronto) => {
            const status = statusLabel[confronto.status];

            return (
              <li key={confronto.id} role="button" tabIndex={0} onClick={() => setSelectedId(confronto.id)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") setSelectedId(confronto.id); }} className="card-glow cursor-pointer rounded-2xl border border-border bg-card p-4 outline-none focus-visible:ring-2 focus-visible:ring-primary">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 flex-1 items-center gap-2">
                    <PlayerAvatar name={confronto.team_a?.name ?? "A"} photoUrl={confronto.team_a?.shield_url ?? null} size="sm" />
                    <span className="truncate text-sm font-semibold text-foreground">
                      {confronto.team_a?.name ?? "Time A"}
                    </span>
                  </div>
                  <span className="text-display text-lg text-muted-foreground">x</span>
                  <div className="flex min-w-0 flex-1 items-center justify-end gap-2">
                    <span className="truncate text-sm font-semibold text-foreground">
                      {confronto.team_b?.name ?? "Time B"}
                    </span>
                    <PlayerAvatar name={confronto.team_b?.name ?? "B"} photoUrl={confronto.team_b?.shield_url ?? null} size="sm" />
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Badge className={status.className}>{status.text}</Badge>
                  {confronto.scheduled_at ? (
                    <span className="text-xs text-muted-foreground">
                      {new Date(confronto.scheduled_at).toLocaleString("pt-BR", {
                        day: "2-digit",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  ) : null}
                  {confronto.venue?.name ? (
                    <span className="text-xs text-muted-foreground">· {confronto.venue.name}</span>
                  ) : null}
                  <span className="text-xs text-muted-foreground">· Juiz: {confronto.referee?.nickname ?? confronto.referee?.full_name ?? "Não definido"}</span>
                </div>

                {confronto.status === "confirmed" ? (
                  <p className="text-display mt-3 text-center text-3xl font-extrabold text-primary">
                    {confronto.match?.score_team_a ?? confronto.reported_score_a_by_a ?? 0}–{confronto.match?.score_team_b ?? confronto.reported_score_b_by_a ?? 0}
                  </p>
                ) : null}

                <p className="mt-3 text-xs text-muted-foreground">Toque para abrir a súmula, ver gols e cartões.</p>
              </li>
            );
          })}
        </ul>
      )}
      <Dialog open={Boolean(selectedConfronto)} onOpenChange={(value) => { if (!value) setSelectedId(null); }}>
        <DialogContent className="max-h-[88dvh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-display text-xl">{selectedConfronto?.team_a?.name ?? "Time A"} × {selectedConfronto?.team_b?.name ?? "Time B"}</DialogTitle>
          </DialogHeader>
          {selectedConfronto ? <MatchEvents confronto={selectedConfronto} onDone={() => { refresh(); void queryClient.invalidateQueries({ queryKey: ["matches"] }); }} /> : null}
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}