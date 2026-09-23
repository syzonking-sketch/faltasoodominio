import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowLeft,
  CalendarClock,
  Copy,
  Flag,
  Goal,
  Link2,
  Loader2,
  MapPin,
  Plus,
  Repeat2,
  Shield,
  Swords,
  Trash2,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import campoConfronto from "@/assets/confronto-campo.png.asset.json";
import { AppShell } from "@/components/app/app-shell";
import { LineupBoard } from "@/components/app/lineup-board";
import { PlayerAvatar } from "@/components/app/player-avatar";
import { FieldError } from "@/components/app/states";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  addMatchEvent,
  autoFinishIfExpired,
  confrontoRefereeLink,
  createConfronto,
  fetchConfrontos,
  fetchMatch,
  fetchMatchEvents,
  fetchTeams,
  fetchVenues,
  finishRefereedMatch,
  removeMatchEvent,
} from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { DEFAULT_DURATION_MINUTES } from "@/lib/match-utils";
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
          "Agende confrontos entre times e acompanhe placar, gols e cartões com súmula validada pelo juiz.",
      },
      { property: "og:title", content: "Contras entre Times — The Match" },
      {
        property: "og:description",
        content: "Confrontos entre times com súmula oficial, gols e cartões registrados pelo juiz.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ConfrontosPage,
});

const statusStyle: Record<Confronto["status"], { text: string; className: string }> = {
  pending: {
    text: "MARCADO",
    className: "border-primary/40 bg-primary/15 text-primary",
  },
  confirmed: {
    text: "ENCERRADO",
    className: "border-emerald-400/30 bg-emerald-400/10 text-emerald-300",
  },
  conflict_nullified: {
    text: "ANULADO",
    className: "border-destructive/40 bg-destructive/15 text-destructive",
  },
};

function formatConfrontoDate(value: string) {
  const date = new Date(value);
  return date.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Horário real de término do contra: usa `finished_at` da partida vinculada
 * quando existir, senão a data marcada + duração padrão. Instantes absolutos,
 * comparados com o relógio local (fuso respeitado automaticamente).
 */
function confrontoEnd(confronto: Confronto): Date | null {
  const match = confronto.match as { finished_at?: string | null } | null | undefined;
  if (match?.finished_at) return new Date(match.finished_at);
  const base = confronto.scheduled_at ?? null;
  if (!base) return null;
  const start = new Date(base);
  if (Number.isNaN(start.getTime())) return null;
  return new Date(start.getTime() + DEFAULT_DURATION_MINUTES * 60_000);
}

/** True quando o horário do contra já passou e ele ainda consta como marcado. */
function isConfrontoOver(confronto: Confronto): boolean {
  if (confronto.status !== "pending") return false;
  const end = confrontoEnd(confronto);
  return end !== null && end.getTime() <= Date.now();
}

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
  const [relatedPlayerId, setRelatedPlayerId] = useState("");
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
      if (eventType === "substitution" && !relatedPlayerId) throw new Error("Selecione quem entra.");
      return addMatchEvent({
        match_id: confronto.match_id,
        player_id: playerId,
        team_side: teamSide,
        event_type: eventType,
        minute: minute ? Number(minute) : null,
        related_player_id: eventType === "substitution" ? relatedPlayerId : null,
      });
    },
    onSuccess: () => {
      toast.success("Evento registrado na súmula.");
      setPlayerId("");
      setRelatedPlayerId("");
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
    substitution: "Substituição",
  };

  const refereeLabel =
    confronto.referee?.nickname ??
    confronto.referee?.full_name ??
    confronto.referee_name ??
    (confronto.referee_token ? "Convite enviado — aguardando o juiz" : "Não definido");

  const copyLink = useMutation({
    mutationFn: () => confrontoRefereeLink(confronto.id),
    onSuccess: async (token) => {
      const url = `${window.location.origin}/juiz/${token}`;
      try {
        await navigator.clipboard.writeText(url);
        toast.success("Link do juiz copiado!");
      } catch {
        toast.success(url);
      }
    },
    onError: (error) => toast.error(friendlyError(error)),
  });

  return (
    <div className="space-y-4">
      <div className="relative isolate aspect-[2.08/1] w-full overflow-hidden rounded-3xl border border-primary/30 bg-surface-2 shadow-raised">
        <img src={campoConfronto.url} alt="Campo de futebol" className="absolute inset-0 size-full object-cover" />
        <div className="absolute inset-0 bg-background/15" />
        <div className="relative grid size-full grid-cols-[1fr_auto_1fr] items-center gap-2 px-3 sm:gap-4 sm:px-6">
          <div className="flex min-w-0 flex-col items-center gap-1.5 text-center">
            <span className="grid size-14 place-items-center overflow-hidden rounded-full border-2 border-primary-foreground/60 bg-background/80 shadow-raised backdrop-blur-sm sm:size-16">
              <PlayerAvatar name={confronto.team_a?.name ?? "A"} photoUrl={confronto.team_a?.shield_url ?? null} size="md" className="size-full border-0" />
            </span>
            <p className="line-clamp-2 w-full text-[10px] leading-tight font-extrabold text-primary-foreground drop-shadow-md sm:text-xs">
              {confronto.team_a?.name ?? "Time A"}
            </p>
          </div>

          <div className="flex shrink-0 items-center rounded-2xl border border-primary-foreground/35 bg-background/85 px-3 py-2 shadow-raised backdrop-blur-md sm:px-5">
            <span className="text-display min-w-5 text-center text-3xl leading-none font-extrabold text-foreground sm:text-4xl">
              {match?.score_team_a ?? 0}
            </span>
            <span className="px-1.5 text-sm font-bold text-primary sm:px-2">×</span>
            <span className="text-display min-w-5 text-center text-3xl leading-none font-extrabold text-foreground sm:text-4xl">
              {match?.score_team_b ?? 0}
            </span>
          </div>

          <div className="flex min-w-0 flex-col items-center gap-1.5 text-center">
            <span className="grid size-14 place-items-center overflow-hidden rounded-full border-2 border-primary-foreground/60 bg-background/80 shadow-raised backdrop-blur-sm sm:size-16">
              <PlayerAvatar name={confronto.team_b?.name ?? "B"} photoUrl={confronto.team_b?.shield_url ?? null} size="md" className="size-full border-0" />
            </span>
            <p className="line-clamp-2 w-full text-[10px] leading-tight font-extrabold text-primary-foreground drop-shadow-md sm:text-xs">
              {confronto.team_b?.name ?? "Time B"}
            </p>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-border/50 bg-surface-2/60 p-3">
        <div className="min-w-0">
          <p className="text-[10px] font-bold tracking-[0.14em] text-primary uppercase">
            Jogo {confronto.match_number != null ? `#${confronto.match_number}` : "—"}
          </p>
          <p className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
            <Shield className="size-4 shrink-0 text-primary" />
            <span className="truncate">Juiz: {refereeLabel}</span>
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          className="h-9 shrink-0 rounded-xl"
          disabled={copyLink.isPending}
          onClick={() => copyLink.mutate()}
        >
          {copyLink.isPending ? <Loader2 className="size-4 animate-spin" /> : <Link2 className="size-4" />}
          Link do juiz
        </Button>
      </div>

      <LineupBoard confronto={confronto} />

      <div>
        <h4 className="mb-2 text-[11px] font-bold tracking-[0.14em] text-muted-foreground uppercase">Súmula</h4>
        {(eventsQuery.data ?? []).length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
            Nenhum gol ou cartão registrado.
          </p>
        ) : (
          <ul className="space-y-2">
            {(eventsQuery.data ?? []).map((event) => (
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
                    {event.player?.nickname ?? event.player?.full_name ?? "Jogador"}
                    {event.event_type === "substitution" && event.related_player
                      ? ` → ${event.related_player.nickname ?? event.related_player.full_name ?? "Jogador"}`
                      : ""}
                  </p>
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
        <div className="space-y-3 rounded-3xl border border-primary/25 bg-surface-2/70 p-4">
          <p className="flex items-center gap-2 text-sm font-bold"><Shield className="size-4 text-primary" /> Registrar evento</p>
          <div className="grid grid-cols-2 gap-2">
            <select className="h-11 rounded-xl border border-input bg-surface px-3 text-sm" value={eventType} onChange={(e) => { setEventType(e.target.value as MatchEventType); setRelatedPlayerId(""); }}>
              <option value="goal">Gol</option><option value="yellow_card">Cartão amarelo</option><option value="red_card">Cartão vermelho</option><option value="substitution">Substituição</option>
            </select>
            <select className="h-11 rounded-xl border border-input bg-surface px-3 text-sm" value={teamSide} onChange={(e) => { setTeamSide(e.target.value as TeamSide); setPlayerId(""); setRelatedPlayerId(""); }}>
              <option value="A">Time A</option><option value="B">Time B</option>
            </select>
          </div>
          <div className="grid grid-cols-[1fr_5rem] gap-2">
            <select className="h-11 min-w-0 rounded-xl border border-input bg-surface px-3 text-sm" value={playerId} onChange={(e) => setPlayerId(e.target.value)}>
              <option value="">{eventType === "substitution" ? "Quem sai" : "Jogador"}</option>
              {visiblePlayers.map((participant) => <option key={participant.id} value={participant.user_id}>{participant.profile?.nickname ?? participant.profile?.full_name ?? "Jogador"}</option>)}
            </select>
            <Input inputMode="numeric" placeholder="Min." value={minute} onChange={(e) => setMinute(e.target.value)} className="h-11 rounded-xl bg-surface" />
          </div>
          {eventType === "substitution" ? (
            <select className="h-11 w-full min-w-0 rounded-xl border border-input bg-surface px-3 text-sm" value={relatedPlayerId} onChange={(e) => setRelatedPlayerId(e.target.value)}>
              <option value="">Quem entra</option>
              {visiblePlayers
                .filter((participant) => participant.user_id !== playerId)
                .map((participant) => <option key={participant.id} value={participant.user_id}>{participant.profile?.nickname ?? participant.profile?.full_name ?? "Jogador"}</option>)}
            </select>
          ) : null}
          <div className="flex gap-2">
            <Button className="h-11 flex-1 rounded-xl" disabled={addEvent.isPending || !playerId} onClick={() => addEvent.mutate()}>{addEvent.isPending ? <Loader2 className="size-4 animate-spin" /> : null} Registrar</Button>
            <Button variant="outline" className="h-11 rounded-xl" disabled={finish.isPending} onClick={() => finish.mutate()}><Flag className="size-4" /> Fim de jogo</Button>
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
  const [refereeMode, setRefereeMode] = useState<"player" | "link">("player");
  const [inviteLink, setInviteLink] = useState<string | null>(null);

  const confrontosQuery = useQuery({
    queryKey: ["confrontos"],
    queryFn: fetchConfrontos,
    refetchInterval: 60_000,
  });

  // Encerramento automático: ao carregar a lista, contras cujo horário já passou
  // têm a partida vinculada finalizada no banco.
  const confrontos = confrontosQuery.data;
  useEffect(() => {
    const expired = (confrontos ?? []).filter(
      (item) => isConfrontoOver(item) && item.match,
    );
    if (expired.length === 0) return;
    void Promise.allSettled(
      expired.map((item) =>
        autoFinishIfExpired({
          ...(item.match as unknown as Record<string, unknown>),
          status: "active",
        } as never),
      ),
    );
  }, [confrontos]);
  const teamsQuery = useQuery({ queryKey: ["teams"], queryFn: fetchTeams });
  const venuesQuery = useQuery({ queryKey: ["venues", ""], queryFn: () => fetchVenues() });

  const teams = teamsQuery.data ?? [];
  const venues = venuesQuery.data ?? [];
  const myTeams = teams.filter((t) => t.captain_id === user?.id);

  const form = useForm<ConfrontoValues>({
    resolver: zodResolver(confrontoSchema),
    defaultValues: { team_a_id: "", team_b_id: "", venue_id: "", referee_id: "", scheduled_at: "" },
  });

  const teamAId = form.watch("team_a_id");
  const teamBId = form.watch("team_b_id");
  const refereeCandidates = (() => {
    const selected = teams.filter((team) => team.id === teamAId || team.id === teamBId);
    const seen = new Set<string>();
    const list: { id: string; name: string; team: string }[] = [];
    for (const team of selected) {
      for (const member of team.members ?? []) {
        const id = member.user_id;
        if (!id || seen.has(id)) continue;
        seen.add(id);
        list.push({
          id,
          name: member.profile?.nickname || member.profile?.full_name || "Jogador",
          team: team.name,
        });
      }
    }
    return list;
  })();

  const create = useMutation({
    mutationFn: (values: ConfrontoValues) =>
      createConfronto({
        team_a_id: values.team_a_id,
        team_b_id: values.team_b_id,
        venue_id: values.venue_id,
        scheduled_at: new Date(values.scheduled_at).toISOString(),
        referee_id: refereeMode === "player" ? values.referee_id || null : null,
        invite_link: refereeMode === "link",
      }),
    onSuccess: async (created) => {
      toast.success("Contra marcado! Agora é só aparecer.");
      setOpen(false);
      form.reset();
      if (refereeMode === "link" && created.referee_token) {
        const url = `${window.location.origin}/juiz/${created.referee_token}`;
        setInviteLink(url);
        try {
          await navigator.clipboard.writeText(url);
          toast.success("Link do juiz copiado!");
        } catch {
          /* o link continua visível na tela */
        }
      }
      void queryClient.invalidateQueries({ queryKey: ["confrontos"] });
      void queryClient.invalidateQueries({ queryKey: ["matches"] });
    },
    onError: (error) => toast.error(friendlyError(error)),
  });

  const refresh = () => void queryClient.invalidateQueries({ queryKey: ["confrontos"] });
  const selectedConfronto = (confrontosQuery.data ?? []).find((item) => item.id === selectedId) ?? null;

  const selectClass = "h-11 w-full rounded-xl border border-border/60 bg-surface-2/70 px-3 text-sm text-foreground";

  return (
    <AppShell title="Contras" bare>
      <div className="radar-immersive -mb-32 min-h-dvh overflow-x-clip pb-44">
        <div className="mx-auto w-full max-w-2xl px-4">
          <header className="pt-safe flex items-center justify-between gap-3 pb-5">
            <div className="flex min-w-0 items-center gap-2.5">
              <Button asChild size="icon" variant="secondary" className="press size-11 shrink-0 rounded-full border border-border/60 bg-surface/90 backdrop-blur-xl" aria-label="Voltar para Times">
                <Link to="/teams"><ArrowLeft className="size-5" /></Link>
              </Button>
              <div className="min-w-0">
                <p className="text-[10px] font-semibold tracking-[0.18em] text-primary uppercase">The Match</p>
                <h1 className="text-display truncate text-2xl leading-none font-extrabold text-foreground">Contras</h1>
              </div>
            </div>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button size="icon" className="press elevate-float size-11 rounded-full" aria-label="Marcar contra" disabled={myTeams.length === 0}>
                  <Plus className="size-5" />
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-[92vw] rounded-3xl sm:max-w-md">
                <DialogHeader>
                  <DialogTitle className="text-display text-2xl">Marcar contra</DialogTitle>
                  <DialogDescription>Time contra time, com juiz e súmula oficial.</DialogDescription>
                </DialogHeader>
                <form
                  className="space-y-4 py-2"
                  onSubmit={form.handleSubmit((v) => {
                    if (refereeMode === "player" && !v.referee_id) {
                      toast.error("Selecione o juiz ou convide por link.");
                      return;
                    }
                    create.mutate(v);
                  })}
                >
                  <div className="space-y-1.5">
                    <Label htmlFor="team-a" className="text-sm font-semibold">Seu time</Label>
                    <select id="team-a" className={selectClass} {...form.register("team_a_id")}>
                      <option value="">Selecione</option>
                      {myTeams.map((t) => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                      ))}
                    </select>
                    <FieldError message={form.formState.errors.team_a_id?.message} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="team-b" className="text-sm font-semibold">Adversário</Label>
                    <select id="team-b" className={selectClass} {...form.register("team_b_id")}>
                      <option value="">Selecione</option>
                      {teams
                        .filter((t) => t.captain_id !== user?.id)
                        .map((t) => (
                          <option key={t.id} value={t.id}>{t.name}</option>
                        ))}
                    </select>
                    <FieldError message={form.formState.errors.team_b_id?.message} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="venue" className="text-sm font-semibold">Quadra</Label>
                    <select id="venue" className={selectClass} {...form.register("venue_id")}>
                      <option value="">Selecione</option>
                      {venues.map((v) => (
                        <option key={v.id} value={v.id}>{v.name}</option>
                      ))}
                    </select>
                    <FieldError message={form.formState.errors.venue_id?.message} />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold">Juiz</Label>
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        type="button"
                        variant={refereeMode === "player" ? "default" : "outline"}
                        className="h-11 rounded-xl text-xs font-bold"
                        onClick={() => setRefereeMode("player")}
                      >
                        Jogador dos times
                      </Button>
                      <Button
                        type="button"
                        variant={refereeMode === "link" ? "default" : "outline"}
                        className="h-11 rounded-xl text-xs font-bold"
                        onClick={() => setRefereeMode("link")}
                      >
                        <Link2 className="size-4" /> Convidar por link
                      </Button>
                    </div>
                    {refereeMode === "player" ? (
                      <>
                        <select id="referee" className={selectClass} {...form.register("referee_id")}>
                          <option value="">
                            {refereeCandidates.length === 0 ? "Escolha os dois times primeiro" : "Selecione o jogador"}
                          </option>
                          {refereeCandidates.map((candidate) => (
                            <option key={candidate.id} value={candidate.id}>
                              {candidate.name} · {candidate.team}
                            </option>
                          ))}
                        </select>
                        <FieldError message={form.formState.errors.referee_id?.message} />
                      </>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        Você recebe um link para enviar ao juiz. Ele não precisa ter conta: entra, coloca o nome e apita o jogo.
                      </p>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="date" className="text-sm font-semibold">Data e hora</Label>
                    <Input id="date" type="datetime-local" className="h-11 rounded-xl bg-surface-2" {...form.register("scheduled_at")} />
                    <FieldError message={form.formState.errors.scheduled_at?.message} />
                  </div>
                  <DialogFooter>
                    <Button type="submit" className="h-12 w-full rounded-xl text-base font-bold" disabled={create.isPending}>
                      {create.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
                      Marcar contra
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </header>

          <Dialog open={Boolean(inviteLink)} onOpenChange={(value) => !value && setInviteLink(null)}>
            <DialogContent className="max-w-[92vw] rounded-3xl sm:max-w-md">
              <DialogHeader>
                <DialogTitle className="text-display text-2xl">Link do juiz</DialogTitle>
                <DialogDescription>Envie para quem vai apitar. Não precisa de conta.</DialogDescription>
              </DialogHeader>
              <p className="rounded-2xl border border-border/60 bg-surface-2/70 p-3 text-xs break-all text-muted-foreground">
                {inviteLink}
              </p>
              <DialogFooter>
                <Button
                  className="h-12 w-full rounded-xl text-base font-bold"
                  onClick={() => {
                    if (inviteLink) void navigator.clipboard.writeText(inviteLink).then(() => toast.success("Link copiado!"));
                  }}
                >
                  <Copy className="size-4" /> Copiar link
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>


          {confrontosQuery.isPending ? (
            <ul className="space-y-3">
              {[0, 1, 2].map((item) => (
                <li key={item} className="h-36 animate-pulse rounded-3xl border border-border/50 bg-surface-2/50" />
              ))}
            </ul>
          ) : confrontosQuery.isError ? (
            <div className="rounded-3xl border border-destructive/30 bg-surface-2/60 p-6 text-center">
              <p className="text-sm text-muted-foreground">{friendlyError(confrontosQuery.error)}</p>
              <Button className="mt-4 rounded-xl" variant="outline" onClick={() => void confrontosQuery.refetch()}>Tentar novamente</Button>
            </div>
          ) : (confrontosQuery.data ?? []).length === 0 ? (
            <div className="flex flex-col items-center rounded-3xl border border-border/50 bg-surface-2/50 px-6 py-14 text-center">
              <span className="grid size-16 place-items-center rounded-full bg-primary/10 text-primary">
                <Swords className="size-8" />
              </span>
              <h2 className="text-display mt-4 text-xl font-extrabold text-foreground">Nenhum contra marcado</h2>
              <p className="mt-1 max-w-xs text-sm text-muted-foreground">
                Capitães podem marcar confrontos entre times, com juiz e súmula de gols e cartões.
              </p>
            </div>
          ) : (
            <ul className="space-y-3">
              {(confrontosQuery.data ?? []).map((confronto) => {
                const over = isConfrontoOver(confronto);
                const status = over
                  ? {
                      text: "ENCERRADO",
                      className: "border-emerald-400/30 bg-emerald-400/10 text-emerald-300",
                    }
                  : statusStyle[confronto.status];
                const finished = confronto.status === "confirmed" || over;
                const scoreA = confronto.match?.score_team_a ?? confronto.reported_score_a_by_a ?? 0;
                const scoreB = confronto.match?.score_team_b ?? confronto.reported_score_b_by_a ?? 0;

                return (
                  <li key={confronto.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(confronto.id)}
                      className="press block w-full rounded-3xl border border-border/50 bg-surface-2/60 p-4 text-left backdrop-blur-xl transition-colors outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="flex min-w-0 items-center gap-2">
                          <span className={`rounded-full border px-2.5 py-1 text-[10px] font-bold tracking-[0.12em] ${status.className}`}>
                            {status.text}
                          </span>
                          {confronto.match_number != null ? (
                            <span className="text-[10px] font-bold tracking-[0.12em] text-primary uppercase">
                              Jogo #{confronto.match_number}
                            </span>
                          ) : null}
                        </span>
                        {confronto.scheduled_at ? (
                          <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                            <CalendarClock className="size-3.5" />
                            {formatConfrontoDate(confronto.scheduled_at)}
                          </span>
                        ) : null}
                      </div>

                      <div className="mt-4 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
                        <div className="flex min-w-0 flex-col items-center gap-2 text-center">
                          <div className="grid size-14 place-items-center overflow-hidden rounded-2xl border border-border/50 bg-surface p-1.5">
                            <PlayerAvatar name={confronto.team_a?.name ?? "A"} photoUrl={confronto.team_a?.shield_url ?? null} size="sm" />
                          </div>
                          <p className="w-full truncate text-xs font-bold text-foreground">{confronto.team_a?.name ?? "Time A"}</p>
                        </div>
                        <p className={`text-display px-2 text-center font-extrabold ${finished ? "text-3xl text-primary" : "text-xl text-muted-foreground"}`}>
                          {finished ? `${scoreA} × ${scoreB}` : "VS"}
                        </p>
                        <div className="flex min-w-0 flex-col items-center gap-2 text-center">
                          <div className="grid size-14 place-items-center overflow-hidden rounded-2xl border border-border/50 bg-surface p-1.5">
                            <PlayerAvatar name={confronto.team_b?.name ?? "B"} photoUrl={confronto.team_b?.shield_url ?? null} size="sm" />
                          </div>
                          <p className="w-full truncate text-xs font-bold text-foreground">{confronto.team_b?.name ?? "Time B"}</p>
                        </div>
                      </div>

                      <div className="mt-4 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                        {confronto.venue?.name ? (
                          <span className="flex min-w-0 items-center gap-1">
                            <MapPin className="size-3.5 shrink-0" />
                            <span className="truncate">{confronto.venue.name}</span>
                          </span>
                        ) : null}
                        <span className="flex min-w-0 items-center gap-1">
                          <Shield className="size-3.5 shrink-0" />
                          <span className="truncate">
                            Juiz:{" "}
                            {confronto.referee?.nickname ??
                              confronto.referee?.full_name ??
                              confronto.referee_name ??
                              (confronto.referee_token ? "Convite por link" : "Não definido")}
                          </span>
                        </span>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      <Dialog open={Boolean(selectedConfronto)} onOpenChange={(value) => { if (!value) setSelectedId(null); }}>
        <DialogContent className="max-h-[88dvh] max-w-[92vw] overflow-y-auto rounded-3xl sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-display text-xl">{selectedConfronto?.team_a?.name ?? "Time A"} × {selectedConfronto?.team_b?.name ?? "Time B"}</DialogTitle>
          </DialogHeader>
          {selectedConfronto ? <MatchEvents confronto={selectedConfronto} onDone={() => { refresh(); void queryClient.invalidateQueries({ queryKey: ["matches"] }); }} /> : null}
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
