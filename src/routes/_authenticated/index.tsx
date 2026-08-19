import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Crosshair, Plus, Radar, Search, Sun, Moon, Loader2, MapPin } from "lucide-react";
import { lazy, useMemo, useState, useEffect, useCallback } from "react";

import { AppShell } from "@/components/app/app-shell";
import { ClientOnly } from "@/components/app/client-only";
import { MatchDrawer } from "@/components/app/match-drawer";
import type { RadarPin } from "@/components/app/map-radar";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/app/states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchMatches, fetchVenues } from "@/lib/api";
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
  const { coords, center, status, request, setCenter, searchLocation, isSearching, searchResults } = useGeolocation();
  const [selected, setSelected] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [lightMap, setLightMap] = useState(false);

  useEffect(() => {
    const isLight = localStorage.getItem("light-map") === "true";
    setLightMap(isLight);
  }, []);

  useEffect(() => {
    if (lightMap) {
      document.body.classList.add("light-map");
    } else {
      document.body.classList.remove("light-map");
    }
    localStorage.setItem("light-map", String(lightMap));
  }, [lightMap]);

  const matchesQuery = useQuery({
    queryKey: ["matches", "active"],
    queryFn: () => fetchMatches("active"),
    refetchInterval: 20000,
  });

  const venuesQuery = useQuery({
    queryKey: ["venues", search],
    queryFn: () => fetchVenues(search),
    enabled: search.length > 2,
  });

  const matches = useMemo(() => {
    const list = matchesQuery.data ?? [];
    const term = search.trim().toLowerCase();
    
    if (!term) return list;

    const filtered = list.filter((m) => {
      const venueName = m.venue?.name?.toLowerCase() ?? "";
      const venueAddress = m.venue?.address?.toLowerCase() ?? "";
      const creatorNickname = m.creator?.nickname?.toLowerCase() ?? "";
      
      return (
        venueName.includes(term) ||
        venueAddress.includes(term) ||
        creatorNickname.includes(term)
      );
    });

    // If there's a match and we have coordinates for the first result, move the map
    const firstMatch = filtered[0];
    if (firstMatch?.venue) {
      setCenter({ 
        lat: Number(firstMatch.venue.latitude), 
        lng: Number(firstMatch.venue.longitude) 
      });
    }

    return filtered;
  }, [matchesQuery.data, search]); // Removed setCenter from dependencies to avoid loop

  const handleSearchSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!search.trim()) return;

    // First, try to find in local matches (venues)
    const localMatch = matches.find(m => 
      m.venue?.name.toLowerCase().includes(search.toLowerCase()) ||
      m.venue?.address?.toLowerCase().includes(search.toLowerCase())
    );

    if (localMatch?.venue) {
      setCenter({
        lat: Number(localMatch.venue.latitude),
        lng: Number(localMatch.venue.longitude)
      });
      return;
    }

    // If not found in active matches, use global geocoding
    await searchLocation(search);
  }, [search, matches, searchLocation, setCenter]);

  const pins: RadarPin[] = useMemo(() => {
    // Collect unique venues from matches
    const venuePins: Record<string, RadarPin> = {};
    
    // Add venues from active matches
    matches.forEach(m => {
      if (m.venue && !venuePins[m.venue.id]) {
        venuePins[m.venue.id] = {
          id: m.venue.id,
          lat: Number(m.venue.latitude),
          lng: Number(m.venue.longitude),
          label: m.venue.name,
          players: m.participants.filter((p) => p.role === "player").length,
          live: true,
          matchId: m.id
        };
      }
    });

    // Add venues from search results if not already there
    if (venuesQuery.data) {
      venuesQuery.data.forEach(v => {
        if (!venuePins[v.id]) {
          venuePins[v.id] = {
            id: v.id,
            lat: Number(v.latitude),
            lng: Number(v.longitude),
            label: v.name,
            players: 0,
            live: false
          };
        }
      });
    }

    return Object.values(venuePins);
  }, [matches, venuesQuery.data]);

  return (
    <AppShell title="Radar" bare>
      <div className="relative h-[65dvh] w-full border-b border-border/10">
        <ClientOnly fallback={<Skeleton className="h-full w-full rounded-none" />}>
          <MapRadar 
            center={center} 
            me={coords} 
            pins={pins} 
            onSelect={(id) => {
              const pin = pins.find(p => p.id === id);
              if (pin?.matchId) {
                setSelected(pin.matchId);
              } else {
                // If it's a venue without an active match, maybe show a hint
                toast.info(`Quadra: ${pin?.label}. Nenhuma partida ao vivo no momento.`);
              }
            }} 
          />
        </ClientOnly>

        <div className="pt-safe pointer-events-none absolute inset-x-0 top-0 z-400 px-4">
          <form 
            onSubmit={handleSearchSubmit}
            className="pointer-events-auto mx-auto flex max-w-2xl items-center gap-2"
          >
            <div className="relative flex-1">
              {isSearching ? (
                <Loader2 className="absolute top-1/2 left-3 size-4 -translate-y-1/2 animate-spin text-primary" />
              ) : (
                <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              )}
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar bairro, quadra ou rua"
                aria-label="Buscar partidas"
                className="card-glow border-border bg-surface/95 pl-9 backdrop-blur"
              />
            </div>
            {search.length > 2 && (isSearching || (searchResults && searchResults.length > 0) || (venuesQuery.data && venuesQuery.data.length > 0)) && (
              <div className="card-glow pointer-events-auto absolute inset-x-0 top-full z-500 mt-2 max-h-60 overflow-y-auto rounded-2xl border border-border bg-surface/95 p-2 backdrop-blur">
                {isSearching && (
                  <div className="flex items-center justify-center p-4">
                    <Loader2 className="size-5 animate-spin text-primary" />
                  </div>
                )}
                
                {/* Local Venues */}
                {venuesQuery.data?.map(v => (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => {
                      setCenter({ lat: Number(v.latitude), lng: Number(v.longitude) });
                      setSearch(v.name);
                    }}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition-colors hover:bg-white/5"
                  >
                    <MapPin className="size-4 shrink-0 text-primary" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold text-foreground">{v.name}</p>
                      <p className="truncate text-[10px] text-muted-foreground">{v.address}</p>
                    </div>
                    <Badge variant="outline" className="text-[9px] uppercase">Quadra</Badge>
                  </button>
                ))}

                {/* Global Locations (Nominatim) */}
                {searchResults?.map((res, i) => (
                  <button
                    key={`global-${i}`}
                    type="button"
                    onClick={() => {
                      setCenter({ lat: parseFloat(res.lat), lng: parseFloat(res.lon) });
                      setSearch(res.display_name);
                    }}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition-colors hover:bg-white/5"
                  >
                    <Radar className="size-4 shrink-0 text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-foreground">{res.display_name}</p>
                    </div>
                  </button>
                ))}

                {!isSearching && !venuesQuery.data?.length && !searchResults?.length && (
                  <p className="p-4 text-center text-xs text-muted-foreground">Nenhum local encontrado</p>
                )}
              </div>
            )}
            <Button
              type="submit"
              size="icon"
              className="card-glow border-primary bg-primary text-primary-foreground shadow-lg"
            >
              <Search className="size-4" />
            </Button>
            <Button
              type="button"
              size="icon"
              variant="secondary"
              aria-label="Centralizar no meu GPS"
              onClick={() => {
                request();
              }}
              className="card-glow border-border bg-surface/95 backdrop-blur"
            >
              <Crosshair className="size-4" />
            </Button>
          </form>
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

        <div className="absolute right-4 bottom-24 z-400 flex flex-col gap-2">
          <Button
            size="icon"
            variant="secondary"
            aria-label={lightMap ? "Mudar para mapa escuro" : "Mudar para mapa claro"}
            onClick={() => setLightMap(!lightMap)}
            className="card-glow size-12 rounded-full border-border bg-surface/95 shadow-lg backdrop-blur"
          >
            {lightMap ? <Moon className="size-5" /> : <Sun className="size-5" />}
          </Button>
        </div>

        <div className="absolute right-4 bottom-6 z-400 flex flex-col gap-2">
          <Link
            to="/matches/new"
            className="card-glow inline-flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg active:scale-95 transition-transform"
            aria-label="Criar nova partida"
          >
            <Plus className="size-6" />
          </Link>
        </div>
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
                          {match.venue?.address}
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