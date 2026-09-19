import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, CalendarCheck, ChevronDown, Loader2, LocateFixed, MapPin, Radio } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import heroImage from "@/assets/matches-hero.jpg";
import { AppShell } from "@/components/app/app-shell";
import { MatchCard } from "@/components/app/match-card";
import { MatchDrawer } from "@/components/app/match-drawer";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/app/states";
import { Button } from "@/components/ui/button";
import { createMatch, fetchMatches, fetchVenues } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { distanceMeters, formatDistance, GPS_CHECKIN_RADIUS, useGeolocation } from "@/lib/geo";
import { effectiveStatus, matchStart } from "@/lib/match-utils";
import { friendlyError } from "@/lib/supabase";
import type { MatchWithRelations } from "@/lib/types";

export const Route = createFileRoute("/_authenticated/matches/")({
  head: () => ({
    meta: [
      { title: "Partidas — The Match" },
      {
        name: "description",
        content: "Veja peladas ao vivo, próximas partidas, histórico com placar e marque sua partida na quadra.",
      },
      { property: "og:title", content: "Partidas — The Match" },
      {
        property: "og:description",
        content: "Marque sua pelada: escolha quadra, dia e horário e coloque a bola pra rolar.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: MatchesPage,
});

const SLOT_HOURS = [7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22];
const WEEKDAYS = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SÁB"];

function dayKey(d: Date) {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function MatchList({
  matches,
  onSelect,
  myCoords,
}: {
  matches: MatchWithRelations[];
  onSelect: (id: string) => void;
  myCoords: { lat: number; lng: number } | null;
}) {
  return (
    <ul className="space-y-3">
      {matches.map((match, i) => {
        const venue = match.venue;
        const distance =
          myCoords && venue
            ? distanceMeters(myCoords, { lat: Number(venue.latitude), lng: Number(venue.longitude) })
            : null;
        return (
          <li key={match.id}>
            <MatchCard match={match} index={i} distance={distance} onSelect={onSelect} />
          </li>
        );
      })}
    </ul>
  );
}

function SectionTitle({
  label,
  count,
  live,
}: {
  label: string;
  count: number;
  live?: boolean;
}) {
  return (
    <div className="mb-3 flex items-center gap-2">
      {live ? <Radio className="size-4 text-primary" /> : null}
      <h2 className="text-display text-sm font-bold tracking-wide text-foreground uppercase">{label}</h2>
      <span className="grid size-6 place-items-center rounded-full bg-accent text-[11px] font-bold text-accent-foreground tabular-nums">
        {count}
      </span>
    </div>
  );
}

function MatchesPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { coords, status: geoStatus, request: requestLocation } = useGeolocation();
  const [selected, setSelected] = useState<string | null>(null);

  const activeQuery = useQuery({
    queryKey: ["matches", "active"],
    queryFn: () => fetchMatches("active"),
    refetchInterval: 30000,
  });
  const finishedQuery = useQuery({
    queryKey: ["matches", "finished"],
    queryFn: () => fetchMatches("finished"),
    refetchInterval: 60000,
  });
  const venuesQuery = useQuery({ queryKey: ["venues", ""], queryFn: () => fetchVenues() });

  const venues = venuesQuery.data ?? [];
  const [venueId, setVenueId] = useState<string | null>(null);
  const [venuePickerOpen, setVenuePickerOpen] = useState(false);
  const selectedVenue = venues.find((v) => v.id === venueId) ?? venues[0] ?? null;

  const [dayOffset, setDayOffset] = useState(0);
  const [slotHour, setSlotHour] = useState<number | null>(null);

  const days = useMemo(() => {
    const base = new Date();
    base.setHours(0, 0, 0, 0);
    return Array.from({ length: 14 }, (_, i) => new Date(base.getTime() + i * 86_400_000));
  }, []);
  const selectedDay = days[dayOffset] ?? days[0]!;

  const all = useMemo(
    () => [...(activeQuery.data ?? []), ...(finishedQuery.data ?? [])],
    [activeQuery.data, finishedQuery.data],
  );

  // Horários já ocupados na quadra escolhida, no dia escolhido (dados reais).
  const takenHours = useMemo(() => {
    const set = new Set<number>();
    if (!selectedVenue) return set;
    for (const m of all) {
      if (m.venue_id !== selectedVenue.id) continue;
      const start = matchStart(m);
      if (dayKey(start) !== dayKey(selectedDay)) continue;
      set.add(start.getHours());
    }
    return set;
  }, [all, selectedVenue, selectedDay]);

  const slotIsPast = (hour: number) => {
    const d = new Date(selectedDay);
    d.setHours(hour, 0, 0, 0);
    return d.getTime() <= Date.now();
  };

  const live = useMemo(
    () =>
      (activeQuery.data ?? []).filter(
        (m) => effectiveStatus(m) === "active" && matchStart(m).getTime() <= Date.now(),
      ),
    [activeQuery.data],
  );
  const upcoming = useMemo(
    () =>
      (activeQuery.data ?? []).filter(
        (m) => effectiveStatus(m) === "active" && matchStart(m).getTime() > Date.now(),
      ),
    [activeQuery.data],
  );
  const finished = useMemo(
    () => [
      ...(finishedQuery.data ?? []),
      ...(activeQuery.data ?? []).filter((m) => effectiveStatus(m) !== "active"),
    ],
    [activeQuery.data, finishedQuery.data],
  );

  const distanceToVenue =
    coords && selectedVenue
      ? distanceMeters(coords, {
          lat: Number(selectedVenue.latitude),
          lng: Number(selectedVenue.longitude),
        })
      : null;

  const book = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error("Entre na sua conta para marcar uma partida.");
      if (!selectedVenue) throw new Error("Cadastre ou selecione uma quadra para marcar a partida.");
      if (slotHour == null) throw new Error("Escolha um horário disponível.");
      const start = new Date(selectedDay);
      start.setHours(slotHour, 0, 0, 0);
      const end = new Date(start.getTime() + 60 * 60_000);
      return createMatch({
        venue_id: selectedVenue.id,
        created_by: user.id,
        match_type: "pelada",
        name: null,
        role: "player",
        team_side: "A",
        checked_in_gps: distanceToVenue != null && distanceToVenue <= GPS_CHECKIN_RADIUS,
        scheduled_at: start.toISOString(),
        finished_at: end.toISOString(),
        max_players: 10,
        creator_is_scorekeeper: true,
      });
    },
    onSuccess: () => {
      toast.success("Partida marcada! Ela já aparece no radar.");
      setSlotHour(null);
      void queryClient.invalidateQueries({ queryKey: ["matches"] });
    },
    onError: (err) => toast.error(friendlyError(err)),
  });

  const listsPending = activeQuery.isPending || finishedQuery.isPending;

  return (
    <AppShell title="Partidas" bare>
      {/* IMAGEM PRINCIPAL */}
      <section className="relative h-[46vh] min-h-[320px] w-full overflow-hidden">
        <img
          src={heroImage}
          alt="Jogador de futebol em ação numa quadra society"
          width={1024}
          height={1280}
          className="size-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/55 via-black/10 to-background" />

        <div className="pt-safe absolute inset-x-0 top-0 flex items-center justify-between px-4 pt-3">
          <button
            type="button"
            aria-label="Voltar"
            onClick={() => void navigate({ to: "/" })}
            className="press grid size-11 place-items-center rounded-full border border-white/25 bg-black/35 text-white backdrop-blur-md"
          >
            <ArrowLeft className="size-5" />
          </button>
          <button
            type="button"
            aria-label="Usar minha localização"
            onClick={() => requestLocation?.()}
            className="press grid size-11 place-items-center rounded-full border border-white/25 bg-black/35 text-white backdrop-blur-md"
          >
            <LocateFixed className="size-5" />
          </button>
        </div>
      </section>

      {/* PAINEL SOBREPOSTO */}
      <section className="relative z-10 -mt-16 px-3">
        <div className="mx-auto max-w-2xl rounded-[2rem] border border-border/60 bg-card p-5 shadow-[var(--shadow-raised)]">
          <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            Futebol society
          </p>

          <div className="mt-1 flex items-start justify-between gap-3">
            <h1 className="text-display min-w-0 truncate text-2xl leading-tight font-bold text-foreground">
              {selectedVenue?.name ?? "Nenhuma quadra cadastrada"}
            </h1>
            <button
              type="button"
              onClick={() => setVenuePickerOpen((v) => !v)}
              disabled={venues.length === 0}
              className="press flex shrink-0 items-center gap-1 rounded-full bg-secondary px-3 py-2 text-xs font-semibold text-muted-foreground disabled:opacity-50"
            >
              Campo <ChevronDown className="size-3.5" />
            </button>
          </div>

          <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
            <MapPin className="size-3.5 shrink-0" />
            <span className="truncate">
              {selectedVenue?.address ?? "Cadastre uma quadra no mapa do radar"}
              {distanceToVenue != null ? ` • ${formatDistance(distanceToVenue)}` : ""}
            </span>
          </p>

          {venuePickerOpen && venues.length > 0 ? (
            <ul className="mt-3 max-h-56 space-y-1 overflow-y-auto rounded-2xl border border-border/60 bg-surface-2 p-1">
              {venues.map((v) => (
                <li key={v.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setVenueId(v.id);
                      setSlotHour(null);
                      setVenuePickerOpen(false);
                    }}
                    className={`w-full truncate rounded-xl px-3 py-2 text-left text-sm ${
                      v.id === selectedVenue?.id
                        ? "bg-accent font-semibold text-accent-foreground"
                        : "text-foreground"
                    }`}
                  >
                    {v.name}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}

          {/* CALENDÁRIO HORIZONTAL */}
          <p className="text-display mt-5 text-sm font-bold text-foreground">Data da partida</p>
          <div className="-mx-1 mt-2 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {days.map((d, i) => {
              const active = i === dayOffset;
              return (
                <button
                  key={d.toISOString()}
                  type="button"
                  onClick={() => {
                    setDayOffset(i);
                    setSlotHour(null);
                  }}
                  className={`press grid h-[68px] w-[60px] shrink-0 place-items-center rounded-2xl border text-center ${
                    active
                      ? "border-transparent bg-primary text-primary-foreground"
                      : "border-border/60 bg-secondary text-foreground"
                  }`}
                >
                  <span className="text-lg leading-none font-bold tabular-nums">{d.getDate()}</span>
                  <span
                    className={`text-[10px] font-semibold ${active ? "opacity-90" : "text-muted-foreground"}`}
                  >
                    {WEEKDAYS[d.getDay()]}
                  </span>
                </button>
              );
            })}
          </div>

          {/* HORÁRIOS */}
          <p className="text-display mt-5 text-sm font-bold text-foreground">Horário</p>
          <div className="-mx-1 mt-2 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {SLOT_HOURS.map((h) => {
              const disabled = slotIsPast(h) || takenHours.has(h) || !selectedVenue;
              const active = slotHour === h;
              return (
                <button
                  key={h}
                  type="button"
                  disabled={disabled}
                  onClick={() => setSlotHour(h)}
                  className={`press shrink-0 rounded-full border px-4 py-2.5 text-sm font-semibold tabular-nums ${
                    active
                      ? "border-transparent bg-primary text-primary-foreground"
                      : "border-border/60 bg-secondary text-foreground"
                  } ${disabled ? "cursor-not-allowed opacity-40" : ""}`}
                >
                  {String(h).padStart(2, "0")}:00 - {String(h + 1).padStart(2, "0")}:00
                </button>
              );
            })}
          </div>
          {selectedVenue && SLOT_HOURS.every((h) => slotIsPast(h) || takenHours.has(h)) ? (
            <p className="mt-2 text-xs text-muted-foreground">
              Sem horários livres nesta quadra neste dia. Escolha outra data.
            </p>
          ) : null}

          {/* RESUMO */}
          <div className="mt-5 rounded-2xl bg-surface-2 p-4">
            <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Resumo</p>
            <p className="text-display mt-1 text-lg font-bold text-foreground">Futebol Society</p>
            <p className="text-sm text-muted-foreground">
              {selectedVenue?.name ?? "Selecione uma quadra"}
            </p>
            <p className="mt-1 text-sm font-semibold text-primary">
              {selectedDay.toLocaleDateString("pt-BR", {
                weekday: "long",
                day: "2-digit",
                month: "long",
              })}
              {slotHour != null
                ? ` • ${String(slotHour).padStart(2, "0")}:00 — ${String(slotHour + 1).padStart(2, "0")}:00`
                : " • escolha um horário"}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">1/10 jogadores ao criar</p>
          </div>

          <Button
            size="lg"
            className="press mt-4 h-14 w-full rounded-full text-base font-bold"
            disabled={book.isPending || slotHour == null || !selectedVenue}
            onClick={() => book.mutate()}
          >
            {book.isPending ? (
              <Loader2 className="size-5 animate-spin" />
            ) : (
              <CalendarCheck className="size-5" />
            )}
            MARCAR PARTIDA
          </Button>

          {!selectedVenue && !venuesQuery.isPending ? (
            <Button
              variant="outline"
              className="press mt-2 h-12 w-full rounded-full"
              onClick={() => void navigate({ to: "/matches/new" })}
            >
              Cadastrar quadra no mapa
            </Button>
          ) : null}

          {geoStatus === "denied" ? (
            <p className="mt-2 text-center text-xs text-muted-foreground">
              Localização desativada — as distâncias ficam ocultas.
            </p>
          ) : null}
        </div>
      </section>

      {/* LISTAS REAIS */}
      <section className="mx-auto mt-6 max-w-2xl space-y-8 px-4">
        {activeQuery.isError || finishedQuery.isError ? (
          <ErrorState
            message={friendlyError(activeQuery.error ?? finishedQuery.error)}
            onRetry={() => {
              void activeQuery.refetch();
              void finishedQuery.refetch();
            }}
          />
        ) : listsPending ? (
          <ListSkeleton />
        ) : (
          <>
            <div>
              <SectionTitle label="Ao vivo agora" count={live.length} live />
              {live.length === 0 ? (
                <EmptyState
                  icon={<Radio className="size-7" />}
                  title="Nenhuma bola rolando"
                  description="Quando uma pelada começar perto de você ela aparece aqui na hora."
                />
              ) : (
                <MatchList matches={live} onSelect={setSelected} myCoords={coords} />
              )}
            </div>

            <div>
              <SectionTitle label="Próximas partidas" count={upcoming.length} />
              {upcoming.length === 0 ? (
                <EmptyState
                  icon={<CalendarCheck className="size-7" />}
                  title="Nada marcado ainda"
                  description="Escolha a quadra, o dia e o horário aí em cima para marcar a próxima."
                />
              ) : (
                <MatchList matches={upcoming} onSelect={setSelected} myCoords={coords} />
              )}
            </div>

            <div>
              <SectionTitle label="Encerradas" count={finished.length} />
              {finished.length === 0 ? (
                <EmptyState
                  icon={<CalendarCheck className="size-7" />}
                  title="Sem histórico ainda"
                  description="Assim que uma partida terminar, o placar e a súmula ficam guardados aqui."
                />
              ) : (
                <MatchList matches={finished} onSelect={setSelected} myCoords={coords} />
              )}
            </div>
          </>
        )}
      </section>

      <MatchDrawer
        matchId={selected}
        myCoords={coords}
        onOpenChange={(open) => setSelected(open ? selected : null)}
      />
    </AppShell>
  );
}
