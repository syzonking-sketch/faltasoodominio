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
import { distanceMeters, formatDistance, GPS_CHECKIN_RADIUS, useGeolocation, type Coords } from "@/lib/geo";
import { friendlyError } from "@/lib/supabase";
import type { MatchType, ParticipantRole, TeamSide } from "@/lib/types";

const MapRadar = lazy(() => import("@/components/app/map-radar"));

export const Route = createFileRoute("/_authenticated/matches/new")({
  head: () => ({
    meta: [
      { title: "Criar Partida — The Match" },
      {
        name: "description",
        content: "Abra uma pelada ou campeonato na sua quadra, escolha o local no mapa e chame a galera.",
      },
      { property: "og:title", content: "Criar Partida — The Match" },
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
    mutationFn: async () => {
      if (!venueId) throw new Error("Selecione uma quadra no mapa");
      const venue = venues.find((v) => v.id === venueId)!;
      const withinRadius =
        coords !== null &&
        distanceMeters(coords, { lat: Number(venue.latitude), lng: Number(venue.longitude) }) <=
          GPS_CHECKIN_RADIUS;
      return createMatch({
        venue_id: venueId,
        created_by: user?.id || "",
        match_type: matchType,
        role,
        team_side: side,
        checked_in_gps: withinRadius,
        scheduled_at: scheduledAt ? new Date(scheduledAt).toISOString() : null,
        finished_at: null,
      });
    },
    onSuccess: () => {
      toast.success("Bola rolando! Sua partida está no radar.");
      void queryClient.invalidateQueries({ queryKey: ["matches"] });
      void navigate({ to: "/" });
    },
    onError: (err) => {
      setError(friendlyError(err));
      toast.error(friendlyError(err));
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

        <div className="card-glow space-y-2 rounded-2xl border border-border bg-card/50 p-4 transition-colors focus-within:border-primary/50">
          <Label htmlFor="start-time" className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
            <Calendar className="size-3 text-primary" /> Data e Horário da Partida
          </Label>
          <div className="relative flex items-center">
            <input 
              id="start-time"
              type="datetime-local" 
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
              className="w-full border-none bg-transparent p-0 text-[16px] font-medium text-foreground outline-none focus:ring-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-0"
              aria-label="Data e hora do jogo"
            />
            <Clock className="pointer-events-none absolute right-0 size-4 text-muted-foreground/50" />
          </div>
        </div>

        <FieldError message={error} />

        <Button
          className="w-full"
          size="lg"
          disabled={!venueId || create.isPending || !user?.id}
          onClick={() => {
            if (!user?.id) {
              toast.error("Você precisa estar logado para criar uma partida.");
              return;
            }
            create.mutate();
          }}
        >
          {create.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
          Colocar a bola pra rolar
        </Button>
      </div>
    </AppShell>
  );
}