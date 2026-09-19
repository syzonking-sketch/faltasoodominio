import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Bell, Crosshair, Plus, Radar, Search, Sun, Moon, Loader2, MapPin, SlidersHorizontal, X } from "lucide-react";
import { lazy, useMemo, useState, useEffect, useCallback } from "react";

import { AppShell } from "@/components/app/app-shell";
import { ClientOnly } from "@/components/app/client-only";
import { MatchDrawer } from "@/components/app/match-drawer";
import { RadarMatchCard } from "@/components/app/radar-match-card";
import logoAsset from "@/assets/logo.jpg.asset.json";


import type { RadarPin } from "@/components/app/map-radar";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/app/states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchMatches, fetchVenues } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { distanceMeters, formatDistance, useGeolocation } from "@/lib/geo";
import { friendlyError } from "@/lib/supabase";
import { isFull } from "@/lib/match-utils";

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
      { property: "og:type", content: "website" },
      {
        property: "og:description",
        content: "Veja partidas ao vivo no mapa e entre na súmula digital em segundos.",
      },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: MapPage,
});

function MapPage() {
  const { user, profile } = useAuth();
  const { coords, center, status, error, requestLocation, retry, setCenter, searchLocation, isSearching, searchResults } = useGeolocation();
  const [selected, setSelected] = useState<string | null>(null);
  const [detailMatch, setDetailMatch] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [lightMap, setLightMap] = useState(false);
  const [onlyAvailable, setOnlyAvailable] = useState(false);

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
    queryKey: ["matches", "active", "radar"],
    queryFn: () => fetchMatches("active"),
    refetchInterval: 20000,
  });

  const venuesQuery = useQuery({
    queryKey: ["venues", "radar"],
    queryFn: () => fetchVenues(),
    staleTime: 5 * 60_000,
  });

  const activeMatches = matchesQuery.data ?? [];

  const nearbyMatches = useMemo(() => {
    const normalized = (value?: string | null) =>
      (value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
    const stateAliases: Record<string, string> = {
      "sao paulo": "sp", "rio de janeiro": "rj", "minas gerais": "mg",
      parana: "pr", "santa catarina": "sc", "rio grande do sul": "rs",
      bahia: "ba", pernambuco: "pe", ceara: "ce", goias: "go",
      maranhao: "ma", para: "pa", amazonas: "am", espirito_santo: "es",
    };
    const stateKey = (value?: string | null) => {
      const key = normalized(value).replace(/\s+/g, "_");
      return stateAliases[key.replaceAll("_", " ")] ?? key;
    };
    const withValidVenue = activeMatches.filter((match) => {
      const lat = Number(match.venue?.latitude);
      const lng = Number(match.venue?.longitude);
      return match.venue && Number.isFinite(lat) && Number.isFinite(lng);
    });

    if (coords) {
      return [...withValidVenue].sort((a, b) => {
        const distanceA = distanceMeters(coords, { lat: Number(a.venue?.latitude), lng: Number(a.venue?.longitude) });
        const distanceB = distanceMeters(coords, { lat: Number(b.venue?.latitude), lng: Number(b.venue?.longitude) });
        return distanceA - distanceB;
      });
    }

    const profileState = stateKey(profile?.state);
    const profileCity = normalized(profile?.city);
    const sameState = profileState
      ? withValidVenue.filter((match) => stateKey(match.venue?.state) === profileState)
      : withValidVenue;
    const sameArea = profileCity
      ? sameState.filter((match) => {
          const venueCity = normalized(match.venue?.city);
          const venueAddress = normalized(match.venue?.address);
          return venueCity === profileCity || venueAddress.includes(profileCity);
        })
      : sameState;

    return sameArea.length > 0 ? sameArea : sameState.length > 0 ? sameState : withValidVenue;
  }, [activeMatches, coords, profile?.city, profile?.state]);

  const matches = useMemo(() => {
    const list = matchesQuery.data ?? [];
    const term = search.trim().toLowerCase();
    
    if (!term) return list;

    return list.filter((m) => {
      const venueName = m.venue?.name?.toLowerCase() ?? "";
      const venueAddress = m.venue?.address?.toLowerCase() ?? "";
      const venueCity = m.venue?.city?.toLowerCase() ?? "";
      const creatorNickname = m.creator?.nickname?.toLowerCase() ?? "";
      
      return (
        venueName.includes(term) ||
        venueAddress.includes(term) ||
        venueCity.includes(term) ||
        creatorNickname.includes(term)
      );
    });
  }, [matchesQuery.data, search]);

  const visibleMatches = (search.trim() ? matches : nearbyMatches).filter((match) => !onlyAvailable || !isFull(match));
  const selectedMatch = activeMatches.find((match) => match.id === selected) ?? null;

  const handleSearchSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!search.trim()) return;

    // First, try to find in local matches (venues)
    const localMatch = activeMatches.find(m => 
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
  }, [search, activeMatches, searchLocation, setCenter]);

  const pins: RadarPin[] = useMemo(() => {
    // Collect unique venues from matches
    const venuePins: Record<string, RadarPin> = {};

    // Add venues from active matches
    activeMatches.forEach(m => {
      if (m.venue && !venuePins[m.venue.id]) {
        const venueCoords = { lat: Number(m.venue.latitude), lng: Number(m.venue.longitude) };
        if (!Number.isFinite(venueCoords.lat) || !Number.isFinite(venueCoords.lng)) return;
        const d = coords ? distanceMeters(coords, venueCoords) : null;
        venuePins[m.venue.id] = {
          id: m.venue.id,
          lat: venueCoords.lat,
          lng: venueCoords.lng,
          label: m.venue.name,
          players: m.participants.filter((p) => p.role === "player").length,
          live: true,
          matchId: m.id,
          ...(d != null ? { distanceLabel: formatDistance(d) } : {}),
        };
      }
    });

    // Add venues from search results if not already there
    if (venuesQuery.data) {
      venuesQuery.data.forEach(v => {
        if (!venuePins[v.id]) {
          const lat = Number(v.latitude);
          const lng = Number(v.longitude);
          if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
          venuePins[v.id] = {
            id: v.id,
            lat,
            lng,
            label: v.name,
            players: 0,
            live: false
          };
        }
      });
    }

    return Object.values(venuePins);
  }, [activeMatches, venuesQuery.data, coords]);

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return "Bom dia,";
    if (h < 18) return "Boa tarde,";
    return "Boa noite,";
  })();
  const displayName = profile?.nickname || profile?.full_name?.split(" ")[0] || "Jogador";

  return (
    <AppShell title="Radar" bare>
      <div className="mx-auto w-full max-w-2xl overflow-x-clip px-4">
        <header className="pt-safe pb-6">
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
            <div className="flex min-w-0 items-center gap-2">
              <img src={logoAsset.url} alt="The Match" className="size-7 shrink-0 rounded-lg object-cover" />
              <span className="text-display truncate text-sm font-bold tracking-tight text-foreground">The Match</span>
            </div>
            <Link to="/matches" aria-label="Notificações" className="press elevate-soft grid size-11 shrink-0 place-items-center rounded-full border border-border/50 bg-surface/90 backdrop-blur-xl">
              <Bell className="size-5 text-foreground" />
            </Link>
          </div>
          <h1 className="text-display mt-7 text-[2.1rem] leading-[1.06] font-extrabold tracking-tight text-foreground">
            {greeting}
            <br />
            <span className="text-primary">{displayName}</span>
          </h1>
        </header>


        <form onSubmit={handleSearchSubmit} className="relative flex items-center gap-2 pb-4">
          <div className="relative flex-1">
            {isSearching ? (
              <Loader2 className="absolute top-1/2 left-4 size-5 -translate-y-1/2 animate-spin text-primary" />
            ) : (
              <Search className="absolute top-1/2 left-4 size-5 -translate-y-1/2 text-muted-foreground" />
            )}
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar partidas ou locais..."
              aria-label="Buscar partidas"
              className="elevate-soft h-14 rounded-full border-border/60 bg-surface pl-12 text-base"
            />
          </div>
          <Button
            type="button"
            size="icon"
             aria-label={onlyAvailable ? "Mostrar todas as partidas" : "Mostrar apenas partidas com vagas"}
             onClick={() => setOnlyAvailable((current) => !current)}
             className={`press elevate-float size-14 shrink-0 rounded-full bg-primary text-primary-foreground ${onlyAvailable ? "ring-2 ring-primary/40 ring-offset-2 ring-offset-background" : ""}`}
          >
             <SlidersHorizontal className="size-5" />
          </Button>


          {search.length > 2 && (isSearching || (searchResults && searchResults.length > 0) || (venuesQuery.data && venuesQuery.data.length > 0)) && (
            <div className="elevate-float absolute inset-x-0 top-full z-500 mt-2 max-h-60 overflow-y-auto rounded-3xl border border-border/60 bg-surface p-2">
              {isSearching && (
                <div className="flex items-center justify-center p-4">
                  <Loader2 className="size-5 animate-spin text-primary" />
                </div>
              )}

              {/* Local Venues */}
              {venuesQuery.data?.filter((v) => {
                const term = search.trim().toLowerCase();
                return term.length > 2 && (`${v.name} ${v.address ?? ""} ${v.city ?? ""}`).toLowerCase().includes(term);
              }).map(v => (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => {
                    setCenter({ lat: Number(v.latitude), lng: Number(v.longitude) });
                    setSearch(v.name);
                  }}
                  className="flex w-full items-center gap-3 rounded-2xl px-3 py-2 text-left transition-colors hover:bg-secondary"
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
                  className="flex w-full items-center gap-3 rounded-2xl px-3 py-2 text-left transition-colors hover:bg-secondary"
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
        </form>

        <div className="elevate-soft relative h-[64dvh] min-h-[470px] max-h-[650px] w-full overflow-hidden rounded-[2rem] border border-border/50">
          <ClientOnly fallback={<Skeleton className="h-full w-full rounded-none" />}>
            <MapRadar
              center={center}
              me={coords}
              pins={pins}
              selectedMatchId={selected}
              onSelect={(id) => {
                const pin = pins.find(p => p.id === id);
                if (pin?.matchId) {
                  setSelected(pin.matchId);
                } else {
                  toast.info(`Quadra: ${pin?.label}. Nenhuma partida ao vivo no momento.`);
                }
              }}
            />
          </ClientOnly>

          <div className={`pointer-events-none absolute inset-x-4 z-400 flex items-end justify-between gap-3 transition-all duration-300 ${selectedMatch ? "bottom-[13.75rem]" : "bottom-4"}`}>
            <div className="flex flex-col gap-2">
              <Button
                type="button"
                size="icon"
                variant="secondary"
                aria-label={lightMap ? "Mudar para mapa escuro" : "Mudar para mapa claro"}
                onClick={() => setLightMap(!lightMap)}
                className="press elevate-float pointer-events-auto size-12 rounded-full border border-border/60 bg-surface"
              >
                {lightMap ? <Moon className="size-5" /> : <Sun className="size-5" />}
              </Button>
              <Button
                type="button"
                size="icon"
                variant="secondary"
                aria-label="Centralizar no meu GPS"
                onClick={() => void requestLocation()}
                className="press elevate-float pointer-events-auto size-12 rounded-full border border-border/60 bg-surface"
              >
                <Crosshair className="size-5 text-primary" />
              </Button>
            </div>
            {!selectedMatch ? <Link to="/matches/new" className="press elevate-float pointer-events-auto inline-flex h-14 items-center justify-center gap-2 rounded-full bg-primary px-6 text-base font-bold text-primary-foreground" aria-label="Criar nova partida"><Plus className="size-5" /> Criar partida</Link> : null}
          </div>
          {selectedMatch ? (
            <div className="absolute inset-x-3 bottom-3 z-410">
              <Button type="button" size="icon" variant="secondary" onClick={() => setSelected(null)} aria-label="Fechar partida selecionada" className="elevate-float absolute top-3 right-3 z-10 size-9 rounded-full bg-surface/90 backdrop-blur"><X className="size-4" /></Button>
              <RadarMatchCard
                match={selectedMatch}
                distance={coords && selectedMatch.venue ? distanceMeters(coords, { lat: Number(selectedMatch.venue.latitude), lng: Number(selectedMatch.venue.longitude) }) : null}
                onSelect={setDetailMatch}
              />
            </div>
          ) : null}
        </div>

        {status === "checking" || status === "prompt" || status === "requesting" ? (
          <div className="elevate-soft rise-in mt-3 rounded-3xl border border-border/60 bg-surface px-4 py-3 text-[11px] text-foreground">
            <p className="flex items-center gap-2 font-bold">
              <MapPin className="size-3" />
              {status === "requesting" ? "Solicitando localização..." : "Permitir localização?"}
            </p>
            <p className="mt-1 opacity-90">
              O iPhone/Navegador perguntará se você permite o uso do GPS. Aceite para ver as quadras próximas e entrar nas partidas. Se não aparecer, toque no ícone de mira ⌖.
            </p>
            {status === "prompt" && (
              <Button type="button" size="sm" className="mt-2" onClick={() => void requestLocation()}>
                <Crosshair className="size-3" /> Usar minha localização
              </Button>
            )}
          </div>
        ) : status === "denied" || status === "unavailable" || status === "error" ? (
          <div className="elevate-soft rise-in mt-3 rounded-3xl border border-border/60 bg-surface px-4 py-3 text-[11px] text-foreground">
            <p className="flex items-center gap-2 font-bold">
              <MapPin className="size-3" /> Localização indisponível
            </p>
            <p className="mt-1 opacity-90">{error}</p>
            <p className="mt-1 opacity-90">
              1. No iPhone, vá em <b>Ajustes {"->"} Privacidade {"->"} Localização {"->"} Safari</b> e marque "Ao usar o App".<br />
              2. No navegador, clique no ícone "AA" ou no cadeado na barra de endereço e selecione <b>Ajustes do Site {"->"} Localização {"->"} Permitir</b>.<br />
              3. Recarregue a página após mudar as configurações.
            </p>
            <Button type="button" size="sm" variant="outline" className="mt-2" onClick={retry}>Tentar novamente</Button>
          </div>
        ) : null}
      </div>

      <div className="mx-auto max-w-2xl px-4 pt-7 pb-36">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-display text-xl font-bold text-foreground">Acontecendo perto de você</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Toque em uma partida para ver os detalhes
            </p>
          </div>
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-accent text-sm font-bold text-accent-foreground tabular-nums">
            {visibleMatches.length}
          </span>
        </div>

        {matchesQuery.isPending ? (
          <ListSkeleton />
        ) : matchesQuery.isError ? (
          <ErrorState
            message={friendlyError(matchesQuery.error)}
            onRetry={() => void matchesQuery.refetch()}
          />
        ) : visibleMatches.length === 0 ? (
          <EmptyState
            icon={<Radar className="size-6" />}
            title="Radar silencioso"
            description="Nenhuma bola rolando por aqui agora. Seja o primeiro a abrir uma pelada na sua quadra."
            action={
              <Button asChild className="press rounded-full">
                <Link to="/matches/new">
                  <Plus className="size-4" /> Criar partida
                </Link>
              </Button>
            }
          />
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2">
            {visibleMatches.map((match) => {
              const venueCoords = match.venue
                ? { lat: Number(match.venue.latitude), lng: Number(match.venue.longitude) }
                : null;
              const dist = coords && venueCoords ? distanceMeters(coords, venueCoords) : null;
              return (
                <li key={match.id}>
                  <RadarMatchCard match={match} distance={dist} compact onSelect={setDetailMatch} />
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <MatchDrawer
        matchId={detailMatch}
        myCoords={coords}
        onOpenChange={(open) => setDetailMatch(open ? detailMatch : null)}
      />
    </AppShell>
  );
}
