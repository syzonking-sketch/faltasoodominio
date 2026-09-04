import { useCallback, useEffect, useRef, useState } from "react";

export interface Coords {
  lat: number;
  lng: number;
}

/** Distance in meters between two coordinates (Haversine). */
export function distanceMeters(a: Coords, b: Coords): number {
  const R = 6371000;
  const toRad = (v: number) => (v * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

/** Max distance (meters) accepted as "presente na quadra". */
export const GPS_CHECKIN_RADIUS = 300;

/** São Paulo center: fallback when the browser denies geolocation. */
export const FALLBACK_CENTER: Coords = { lat: -23.5615, lng: -46.6559 };

export type GeoPermission = "granted" | "prompt" | "denied" | "unsupported" | "unknown";
export type GeoStatus = "idle" | "checking" | "prompt" | "requesting" | "granted" | "denied" | "unavailable" | "error";

export interface GeolocationDiagnostics {
  supported: boolean;
  secureContext: boolean;
  geolocationSupported: boolean;
  permissionsApiSupported: boolean;
  permission: GeoPermission;
  standalone: boolean;
  userAgent: string;
  platform: string;
  maxTouchPoints: number;
  ios: boolean;
  errorCode: number | null;
  errorMessage: string | null;
}

export function isIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

function browserDiagnostics(permission: GeoPermission, errorCode: number | null = null, errorMessage: string | null = null): GeolocationDiagnostics {
  const secureContext = typeof window !== "undefined" ? window.isSecureContext : false;
  const geolocationSupported = typeof navigator !== "undefined" && "geolocation" in navigator;
  const permissionsApiSupported = typeof navigator !== "undefined" && "permissions" in navigator;
  const standalone = typeof window !== "undefined" && (window.matchMedia?.("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true);
  return { supported: geolocationSupported, secureContext, geolocationSupported, permissionsApiSupported, permission, standalone, userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "", platform: typeof navigator !== "undefined" ? navigator.platform : "", maxTouchPoints: typeof navigator !== "undefined" ? navigator.maxTouchPoints : 0, ios: isIOS(), errorCode, errorMessage };
}

export async function diagnoseGeolocation(): Promise<GeolocationDiagnostics> {
  const permission = await checkGeolocationPermission();
  return browserDiagnostics(permission);
}

export async function checkGeolocationPermission(): Promise<GeoPermission> {
  if (typeof window === "undefined" || !navigator.geolocation) return "unsupported";
  if (!window.isSecureContext && location.hostname !== "localhost") return "denied";
  if (!navigator.permissions?.query) return "unknown";
  try {
    const result = await navigator.permissions.query({ name: "geolocation" as PermissionName });
    return result.state;
  } catch {
    return "unknown";
  }
}

/* -------------------------------------------------------------------------- */
/*  Cache global de localização — pedida uma única vez por sessão do app.      */
/* -------------------------------------------------------------------------- */

interface GeoStore {
  coords: Coords | null;
  center: Coords;
  status: GeoStatus;
  permission: GeoPermission;
  error: string | null;
  errorCode: number | null;
  errorMessage: string | null;
}

const STORAGE_KEY = "the-match:last-coords";

function readStoredCoords(): Coords | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Coords;
    return typeof parsed?.lat === "number" && typeof parsed?.lng === "number" ? parsed : null;
  } catch {
    return null;
  }
}

const stored = readStoredCoords();

const store: GeoStore = {
  coords: stored,
  center: stored ?? FALLBACK_CENTER,
  status: stored ? "granted" : "idle",
  permission: stored ? "granted" : "unknown",
  error: null,
  errorCode: null,
  errorMessage: null,
};

const listeners = new Set<() => void>();
let requestInFlight = false;
let bootstrapped = false;

function emit() {
  listeners.forEach((fn) => fn());
}

function patch(next: Partial<GeoStore>) {
  Object.assign(store, next);
  emit();
}

function persist(coords: Coords) {
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(coords));
  } catch {
    /* ignore */
  }
}

function requestPosition(): Promise<Coords | null> {
  if (requestInFlight) return Promise.resolve(store.coords);
  if (typeof window === "undefined" || !navigator.geolocation) {
    patch({ permission: "unsupported", status: "unavailable", error: "Este navegador não oferece suporte à localização." });
    return Promise.resolve(null);
  }
  if (!window.isSecureContext && location.hostname !== "localhost") {
    patch({ status: "error", error: "A localização exige uma conexão segura (HTTPS)." });
    return Promise.resolve(null);
  }

  requestInFlight = true;
  patch({ status: "requesting", error: null, errorCode: null, errorMessage: null });

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        persist(coords);
        requestInFlight = false;
        patch({ coords, center: coords, permission: "granted", status: "granted", error: null });
        resolve(coords);
      },
      (err) => {
        console.warn("Geolocation error:", err.code, err.message);
        requestInFlight = false;
        patch({
          errorCode: err.code,
          errorMessage: err.message || null,
          permission: err.code === 1 ? "denied" : "unknown",
          status: err.code === 1 ? "denied" : err.code === 2 ? "unavailable" : "error",
          error:
            err.code === 1
              ? "Não foi possível acessar sua localização. O navegador não concedeu permissão para este site."
              : err.code === 2
                ? "Seu dispositivo não conseguiu determinar sua localização. Verifique se a localização está ativada e tente novamente."
                : "O dispositivo demorou para obter sua localização. Tente novamente em um local com melhor sinal.",
        });
        resolve(null);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 5 * 60_000 },
    );
  });
}

/** Roda uma única vez por carregamento do app. */
function bootstrap() {
  if (bootstrapped || typeof window === "undefined") return;
  bootstrapped = true;

  // Já temos coordenadas em cache nesta sessão: não pergunta de novo.
  if (store.coords) return;

  patch({ status: "checking" });
  void checkGeolocationPermission().then((state) => {
    patch({
      permission: state,
      status: state === "unsupported" ? "unavailable" : "prompt",
    });
    // Permissão já concedida antes: busca em silêncio, sem novo prompt.
    if (state === "granted") void requestPosition();
  });
}

export function useGeolocation() {
  const [, force] = useState(0);
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);

  useEffect(() => {
    const listener = () => force((n) => n + 1);
    listeners.add(listener);
    bootstrap();
    return () => {
      listeners.delete(listener);
    };
  }, []);

  const request = useCallback(async () => {
    // Se já temos posição nesta sessão, reaproveita sem novo prompt.
    if (store.coords) {
      patch({ center: store.coords, status: "granted", permission: "granted" });
      return store.coords;
    }
    return requestPosition();
  }, []);

  const retry = useCallback(() => void requestPosition(), []);

  const setCenter = useCallback((next: Coords) => patch({ center: next }), []);

  const searchLocation = useCallback(async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      return null;
    }
    setIsSearching(true);
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5&addressdetails=1`,
        { headers: { "Accept-Language": "pt-BR" } },
      );
      const data = await response.json();
      setSearchResults(data || []);

      if (data && data.length > 0) {
        const result = { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
        patch({ center: result });
        return result;
      }
      return null;
    } catch (error) {
      console.error("Erro na busca de localização:", error);
      return null;
    } finally {
      setIsSearching(false);
    }
  }, []);

  return {
    coords: store.coords,
    status: store.status,
    permission: store.permission,
    error: store.error,
    request,
    requestCurrentLocation: request,
    requestLocation: request,
    retry,
    center: store.center,
    setCenter,
    searchLocation,
    isSearching,
    searchResults,
    diagnostics: browserDiagnostics(store.permission, store.errorCode, store.errorMessage),
  };
}


export async function reverseGeocode(lat: number, lng: number): Promise<{ address: string; city: string; state: string }> {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&addressdetails=1`,
      { headers: { 'Accept-Language': 'pt-BR', 'User-Agent': 'TheMatchApp/1.0' } }
    );
    const data = await response.json();
    const addr = data.address || {};
    
    // Extracting best matches for PT-BR
    const city = addr.city || addr.town || addr.village || addr.municipality || "";
    const state = addr.state ? addr.state.substring(0, 2).toUpperCase() : "";
    const street = addr.road || addr.suburb || "";
    const houseNumber = addr.house_number ? `, ${addr.house_number}` : "";
    
    return {
      address: street ? `${street}${houseNumber}` : "Local sem endereço mapeado",
      city: city,
      state: state.length === 2 ? state : "",
    };
  } catch (error) {
    console.error("Erro na geocodificação reversa:", error);
    return { address: "", city: "", state: "" };
  }
}