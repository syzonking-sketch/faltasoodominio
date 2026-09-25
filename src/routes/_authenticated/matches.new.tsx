import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Calendar, Clock, Loader2, MapPin, Plus } from "lucide-react";
import { lazy, useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/app/app-shell";
import { ClientOnly } from "@/components/app/client-only";
import type { RadarPin } from "@/components/app/map-radar";
import { ErrorState, FieldError, ListSkeleton } from "@/components/app/states";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { createMatch, createVenue, fetchVenues } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { distanceMeters, formatDistance, GPS_CHECKIN_RADIUS, useGeolocation, type Coords } from "@/lib/geo";
import { friendlyError } from "@/lib/supabase";
import type { MatchType, ParticipantRole, TeamSide } from "@/lib/types";

const MapRadar = lazy(() => import("@/components/app/map-radar"));

export const Route = createFileRoute("/_authenticated/matches/new")({
  head: () => ({
    meta: [
      { title: "Criar Partida — The Matches" },
      {
        name: "description",
        content: "Abra uma pelada ou campeonato na sua quadra, escolha o local no mapa e chame a galera.",
      },
      { property: "og:title", content: "Criar Partida — The Matches" },
      {
        property: "og:description",
        content: "Escolha a quadra no mapa e coloque a bola pra rolar em segundos.",
      },
    ],
  }),
  component: NewMatchPage,
});

function NewMatchPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { coords, center } = useGeolocation();

  const [venueId, setVenueId] = useState<string | null>(null);
  const [matchType, setMatchType] = useState<MatchType>("pelada");
  const [role, setRole] = useState<ParticipantRole>("player");
  const [side, setSide] = useState<TeamSide>("A");
  const [newVenue, setNewVenue] = useState<{ name: string; address: string; coords: Coords } | null>(null);
  const [scheduledAt, setScheduledAt] = useState("");
  const [finishedAt, setFinishedAt] = useState("");
  const [duration, setDuration] = useState<number>(60);
  const [maxPlayers, setMaxPlayers] = useState<number>(10);
  const [matchName, setMatchName] = useState("");
  const [creatorIsScorekeeper, setCreatorIsScorekeeper] = useState(true);
  const [error, setError] = useState<string | undefined>(undefined);

  const venuesQuery = useQuery({ queryKey: ["venues", ""], queryFn: () => fetchVenues() });
  const venues = venuesQuery.data ?? [];
  const selectedVenue = venues.find((v) => v.id === venueId) ?? null;

  const pins: RadarPin[] = venues.map((v) => ({
    id: v.id,
    lat: Number(v.latitude),
    lng: Number(v.longitude),
    label: v.name,
    players: 0,
    live: v.id === venueId,
  }));

  const addVenue = useMutation({
    mutationFn: () =>
      createVenue({
        name: newVenue!.name,
        address: newVenue!.address,
        latitude: newVenue!.coords.lat,
        longitude: newVenue!.coords.lng,
      }),
    onSuccess: (venue) => {
      toast.success("Quadra cadastrada no mapa!");
      setNewVenue(null);
      setVenueId(venue.id);
      void queryClient.invalidateQueries({ queryKey: ["venues"] });
    },
    onError: (err) => {
      console.error("Erro ao salvar quadra:", err);
      toast.error(friendlyError(err));
    },
  });

  const create = useMutation({
    mutationFn: async (currentUserId: string) => {
      if (!venueId) throw new Error("Selecione uma quadra no mapa");
      const venue = venues.find((v) => v.id === venueId);
      if (!venue) throw new Error("A quadra selecionada não foi encontrada. Selecione-a novamente no mapa.");
      const withinRadius =
        coords !== null &&
        distanceMeters(coords, { lat: Number(venue.latitude), lng: Number(venue.longitude) }) <=
          GPS_CHECKIN_RADIUS;
      
      // Use current date if scheduledAt is not set, to ensure ball starts rolling immediately
      const start = scheduledAt ? new Date(scheduledAt).toISOString() : new Date().toISOString();
      // Ensure finished_at is after start, even if not explicitly set by user yet
      const end = finishedAt
        ? new Date(finishedAt).toISOString()
        : new Date(new Date(start).getTime() + duration * 60000).toISOString();

      return createMatch({
        venue_id: venueId,
        created_by: currentUserId,
        match_type: matchType,
        name: matchName || null,
        role,
        team_side: side,
        checked_in_gps: withinRadius,
        scheduled_at: start,
        finished_at: end,
        max_players: maxPlayers,
        creator_is_scorekeeper: creatorIsScorekeeper,
      });
    },
    onSuccess: () => {
      toast.success("Bola rolando! Sua partida está no radar.");
      void queryClient.invalidateQueries({ queryKey: ["matches"] });
      void navigate({ to: "/" });
    },
    onError: (err: any) => {
      const msg = friendlyError(err);
      const isRLS = msg.includes("RLS") || (err?.message && err.message.includes("row-level security"));
      const finalMsg = isRLS 
        ? "Erro de permissão no banco de dados. Você precisa executar o script SQL de atualização no painel do seu projeto Supabase."
        : msg;
      setError(finalMsg);
      toast.error(finalMsg, { duration: 6000 });
    },
  });

  const distance =
    coords && selectedVenue
      ? distanceMeters(coords, {
          lat: Number(selectedVenue.latitude),
          lng: Number(selectedVenue.longitude),
        })
      : null;

  return (
    <AppShell
      title="Nova partida"
      subtitle="Toque no mapa para cadastrar uma quadra nova"
      action={
        <Button variant="ghost" size="sm" onClick={() => void navigate({ to: "/" })}>
          <ArrowLeft className="size-4" /> Voltar
        </Button>
      }
    >
      <div className="card-glow h-64 overflow-hidden rounded-2xl border border-border">
        <ClientOnly fallback={<Skeleton className="h-full w-full" />}>
          <MapRadar
            center={center}
            me={coords}
            pins={pins}
            onSelect={(id) => {
              setVenueId(id);
              setNewVenue(null);
            }}
            onMapClick={async (c) => {
              const { reverseGeocode } = await import("@/lib/geo");
              const addressInfo = await reverseGeocode(c.lat, c.lng);
              setNewVenue({
                name: "",
                address: addressInfo.address,
                coords: c
              });
            }}
          />
        </ClientOnly>
      </div>

      <div className="mt-4 space-y-4">
        {venuesQuery.isPending ? (
          <ListSkeleton rows={2} />
        ) : venuesQuery.isError ? (
          <ErrorState
            message={friendlyError(venuesQuery.error)}
            onRetry={() => void venuesQuery.refetch()}
          />
        ) : null}

        {newVenue ? (
          <div className="rounded-2xl border border-accent/40 bg-accent/10 p-4">
            <p className="text-display mb-3 text-lg text-foreground">Cadastrar quadra aqui</p>
            <div className="space-y-3">
              <div>
                <Label htmlFor="venue-name">Nome da quadra</Label>
                <Input
                  id="venue-name"
                  value={newVenue.name}
                  onChange={(e) => setNewVenue({ ...newVenue, name: e.target.value })}
                  placeholder="Quadra do Zé"
                />
              </div>
              <div>
                <Label htmlFor="venue-address">Endereço / referência</Label>
                <Input
                  id="venue-address"
                  value={newVenue.address}
                  onChange={(e) => setNewVenue({ ...newVenue, address: e.target.value })}
                  placeholder="Rua das Palmeiras, 120"
                />
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  disabled={newVenue.name.length < 3 || addVenue.isPending}
                  onClick={() => addVenue.mutate()}
                >
                  {addVenue.isPending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
                  Salvar quadra
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setNewVenue(null)}>
                  Cancelar
                </Button>
              </div>
            </div>
          </div>
        ) : null}

        <div>
          <Label className="mb-2 block">Quadra selecionada</Label>
          {selectedVenue ? (
            <div className="flex items-center gap-2 rounded-2xl border border-primary/40 bg-primary/10 p-3 text-sm">
              <MapPin className="size-4 text-primary" />
              <div>
                <p className="font-semibold text-foreground">{selectedVenue.name}</p>
                <p className="text-xs text-muted-foreground">
                  {selectedVenue.address}
                  {distance !== null ? ` · ${formatDistance(distance)} de você` : ""}
                </p>
              </div>
            </div>
          ) : (
            <p className="rounded-2xl border border-dashed border-border p-3 text-xs text-muted-foreground">
              Toque em um pino verde para escolher uma quadra existente, ou em qualquer ponto do mapa
              para cadastrar uma nova.
            </p>
          )}
        </div>

        <div>
          <Label htmlFor="match-name" className="mb-2 block">Nome da partida (opcional)</Label>
          <Input
            id="match-name"
            value={matchName}
            onChange={(e) => setMatchName(e.target.value)}
            placeholder="Ex: Pelada dos Amigos, Final da Champions..."
            className="rounded-2xl"
          />
        </div>

        <div>
          <Label className="mb-2 block">Tipo de evento</Label>
          <div className="grid grid-cols-2 gap-2">
            {(["pelada", "campeonato"] as const).map((type) => (
              <Button
                key={type}
                type="button"
                variant={matchType === type ? "default" : "secondary"}
                onClick={() => setMatchType(type)}
                className="capitalize"
              >
                {type}
              </Button>
            ))}
          </div>
        </div>

        <div>
          <Label className="mb-2 block">Você entra como</Label>
          <div className="grid grid-cols-2 gap-2">
            <Button
              type="button"
              variant={role === "player" ? "default" : "secondary"}
              onClick={() => setRole("player")}
            >
              Jogador
            </Button>
            <Button
              type="button"
              variant={role === "spectator" ? "default" : "secondary"}
              onClick={() => setRole("spectator")}
            >
              Telespectador
            </Button>
          </div>
        </div>

        <div className="space-y-3 rounded-2xl border border-border bg-card p-4">
          <div>
            <Label className="text-sm font-semibold text-foreground">Você será o responsável pelo placar?</Label>
            <p className="mt-1 text-xs text-muted-foreground">
              O responsável poderá adicionar e remover gols durante a partida.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Button
              type="button"
              variant={creatorIsScorekeeper ? "default" : "secondary"}
              onClick={() => setCreatorIsScorekeeper(true)}
            >
              Sim, eu serei
            </Button>
            <Button
              type="button"
              variant={!creatorIsScorekeeper ? "default" : "secondary"}
              onClick={() => setCreatorIsScorekeeper(false)}
            >
              Não, escolher depois
            </Button>
          </div>
        </div>

        {role === "player" ? (
          <div>
            <Label className="mb-2 block">Seu lado</Label>
            <div className="grid grid-cols-2 gap-2">
              {(["A", "B"] as const).map((s) => (
                <Button
                  key={s}
                  type="button"
                  variant={side === s ? "default" : "secondary"}
                  onClick={() => setSide(s)}
                >
                  Time {s}
                </Button>
              ))}
            </div>
          </div>
        ) : null}

        <div className="card-glow space-y-2 rounded-2xl border border-border bg-card/50 p-3 transition-colors focus-within:border-primary/50">
          <Label htmlFor="start-time" className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
            <Calendar className="size-3 text-primary" /> Início
          </Label>
          <div className="relative flex items-center">
            <input 
              id="start-time"
              type="datetime-local" 
              value={scheduledAt}
              onChange={(e) => {
                const newStart = e.target.value;
                setScheduledAt(newStart);
                if (newStart) {
                  const baseDate = new Date(newStart);
                  const end = new Date(baseDate.getTime() + duration * 60000);
                  const offset = end.getTimezoneOffset() * 60000;
                  const localEnd = new Date(end.getTime() - offset).toISOString().slice(0, 16);
                  setFinishedAt(localEnd);
                }
              }}
              className="w-full border-none bg-transparent p-0 text-[16px] font-medium text-foreground outline-none focus:ring-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-0"
              aria-label="Data e hora de início"
            />
            <Clock className="pointer-events-none absolute right-0 size-4 text-muted-foreground/50" />
          </div>
        </div>

        <div className="flex flex-wrap justify-center gap-2">
          {[60, 90, 120, 180].map((mins) => (
            <button
              key={mins}
              type="button"
              onClick={() => {
                setDuration(mins);
                const baseDate = scheduledAt ? new Date(scheduledAt) : new Date();
                
                // If starting from "now", set start time too
                if (!scheduledAt) {
                  const offset = baseDate.getTimezoneOffset() * 60000;
                  const localStart = new Date(baseDate.getTime() - offset).toISOString().slice(0, 16);
                  setScheduledAt(localStart);
                }

                const end = new Date((scheduledAt ? new Date(scheduledAt) : baseDate).getTime() + mins * 60000);
                const offset = end.getTimezoneOffset() * 60000;
                const localEnd = new Date(end.getTime() - offset).toISOString().slice(0, 16);
                setFinishedAt(localEnd);
              }}
              className={`rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-wider transition-colors ${
                duration === mins
                  ? "border-primary bg-primary/20 text-primary"
                  : "border-border bg-card text-muted-foreground hover:border-primary/50 hover:text-primary"
              }`}
            >
              {mins}m
            </button>
          ))}
        </div>

        <div className="space-y-2">
          <Label className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Capacidade (jogadores)
          </Label>
          <div className="flex flex-wrap gap-2">
            {[10, 12, 14, 16, 22].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setMaxPlayers(n)}
                className={`rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-wider transition-colors ${
                  maxPlayers === n
                    ? "border-primary bg-primary/20 text-primary"
                    : "border-border bg-card text-muted-foreground hover:border-primary/50 hover:text-primary"
                }`}
              >
                {n} jogadores
              </button>
            ))}
          </div>
        </div>

        {scheduledAt && finishedAt && (
          <div className="flex justify-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-primary">
              <Clock className="size-3" />
              Duração: {Math.max(0, Math.floor((new Date(finishedAt).getTime() - new Date(scheduledAt).getTime()) / (1000 * 60)))} minutos
            </div>
          </div>
        )}

        <FieldError message={error} />

        <Button
          className="w-full"
          size="lg"
          disabled={create.isPending}
          onClick={async () => {
            if (!venueId) {
              toast.error("Selecione uma quadra no mapa primeiro!");
              return;
            }

            let currentUserId = user?.id;
            
            if (!currentUserId) {
              const { data } = await supabase.auth.getUser();
              currentUserId = data.user?.id;
            }

            if (!currentUserId) {
              toast.error("Erro de autenticação: ID de usuário não encontrado.");
              return;
            }
            
            create.mutate(currentUserId);
          }}
        >
          {create.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
          Colocar a bola pra rolar
        </Button>
      </div>
    </AppShell>
  );
}
