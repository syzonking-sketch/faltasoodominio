import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Crosshair, Plus, Radar, Search } from "lucide-react";
import { lazy, useMemo, useState } from "react";

import { AppShell } from "@/components/app/app-shell";
import { ClientOnly } from "@/components/app/client-only";
import { MatchDrawer } from "@/components/app/match-drawer";
import type { RadarPin } from "@/components/app/map-radar";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/app/states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchMatches } from "@/lib/api";
import { distanceMeters, formatDistance, useGeolocation } from "@/lib/geo";
import { friendlyError } from "@/lib/supabase";

const MapRadar = lazy(() => import("@/components/app/map-radar"));

export const Route = createFileRoute("/_authenticated/")({
  head: () => ({
    meta: [
      { title: "Radar de Peladas — The Match" },
      {
        name: "description",
        content:
          "Mapa ao vivo das quadras e campos com partidas acontecendo agora perto de você. Entre como jogador ou telespectador.",
      },
      { property: "og:title", content: "Radar de Peladas — The Match" },
      {
        property: "og:description",
        content: "Veja partidas ao vivo no mapa e entre na súmula digital em segundos.",
      },
    ],
  }),
  component: MapPage,
});

function MapPage() {
  const { coords, center, status, request } = useGeolocation();
  const [selected, setSelected] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const matchesQuery = useQuery({
    queryKey: ["matches", "active"],
    queryFn: () => fetchMatches("active"),
    refetchInterval: 20000,
  });

  const matches = useMemo(() => {
    const list = matchesQuery.data ?? [];
    const term = search.trim().toLowerCase();
    if (!term) return list;
    return list.filter(
      (m) =>
        m.venue?.name.toLowerCase().includes(term) ||
        m.venue?.address?.toLowerCase().includes(term) ||
        m.creator?.nickname.toLowerCase().includes(term),
    );
  }, [matchesQuery.data, search]);

  const pins: RadarPin[] = matches
    .filter((m) => m.venue)
    .map((m) => ({
      id: m.id,
      lat: Number(m.venue!.latitude),
      lng: Number(m.venue!.longitude),
      label: m.venue!.name,
      players: m.participants.filter((p) => p.role === "player").length,
      live: m.status === "active",
    }));

  return (
    <AppShell title="Radar" bare>
      <div className="relative h-[65dvh] w-full border-b border-border/10">
        <ClientOnly fallback={<Skeleton className="h-full w-full rounded-none" />}>
          <MapRadar center={center} me={coords} pins={pins} onSelect={setSelected} />
        </ClientOnly>

        <div className="pt-safe pointer-events-none absolute inset-x-0 top-0 z-400 px-4">
          <div className="pointer-events-auto mx-auto flex max-w-2xl items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar quadra, campo ou boleiro"
                aria-label="Buscar partidas"
                className="card-glow border-border bg-surface/95 pl-9 backdrop-blur"
              />
            </div>
            <Button
              size="icon"
              variant="secondary"
              aria-label="Centralizar no meu GPS"
              onClick={request}
            >
              <Crosshair className="size-4" />
            </Button>
          </div>
          {status === "denied" ? (
            <div className="pointer-events-auto mx-auto mt-2 max-w-2xl rounded-xl bg-accent/15 px-3 py-2 text-[11px] text-accent">
              <p className="font-bold">GPS bloqueado — mostrando região padrão.</p>
              <p className="mt-1 opacity-90">
                Para entrar nas partidas e validar placares, o app precisa saber que você está na quadra. 
                Clique no cadeado ao lado da URL do seu navegador e mude "Localização" para "Permitir", depois recarregue a página.
              </p>
            </div>
          ) : null}
        </div>

        <Link
          to="/matches/new"
          className="card-glow absolute right-4 bottom-4 z-400 inline-flex items-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-bold text-primary-foreground"
        >
          <Plus className="size-4" /> Criar partida
        </Link>
      </div>

      <div className="mx-auto max-w-2xl px-4 py-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-display text-xl text-foreground">Partidas ao vivo</h2>
          <Badge className="bg-primary/20 text-primary">{matches.length}</Badge>
        </div>

        {matchesQuery.isPending ? (
          <ListSkeleton />
        ) : matchesQuery.isError ? (
          <ErrorState
            message={friendlyError(matchesQuery.error)}
            onRetry={() => void matchesQuery.refetch()}
          />
        ) : matches.length === 0 ? (
          <EmptyState
            icon={<Radar className="size-7" />}
            title="Radar silencioso"
            description="Nenhuma bola rolando por aqui agora. Seja o primeiro a abrir uma pelada na sua quadra."
            action={
              <Button asChild>
                <Link to="/matches/new">
                  <Plus className="size-4" /> Criar partida
                </Link>
              </Button>
            }
          />
        ) : (
          <ul className="space-y-3">
            {matches.map((match) => {
              const venueCoords = match.venue
                ? { lat: Number(match.venue.latitude), lng: Number(match.venue.longitude) }
                : null;
              const dist = coords && venueCoords ? distanceMeters(coords, venueCoords) : null;
              return (
                <li key={match.id}>
                  <button
                    type="button"
                    onClick={() => setSelected(match.id)}
                    className="card-glow w-full rounded-2xl border border-border bg-card p-4 text-left transition-colors hover:border-primary/50"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-display truncate text-lg font-bold text-foreground">
                          {match.venue?.name ?? "Quadra"}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {match.venue?.address ?? "Sem endereço"}
                          {dist !== null ? ` · ${formatDistance(dist)}` : ""}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-display text-2xl font-extrabold text-primary">
                          {match.score_team_a}–{match.score_team_b}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          {match.participants.filter((p) => p.role === "player").length} jogadores ·{" "}
                          {match.participants.filter((p) => p.role === "spectator").length} torcida
                        </p>
                      </div>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <MatchDrawer
        matchId={selected}
        myCoords={coords}
        onOpenChange={(open) => setSelected(open ? selected : null)}
      />
    </AppShell>
  );
}