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
  secureContext: boolean;
  geolocationSupported: boolean;
  permissionsApiSupported: boolean;
  permission: GeoPermission;
  standalone: boolean;
  userAgent: string;
}

function browserDiagnostics(permission: GeoPermission): GeolocationDiagnostics {
  const secureContext = typeof window !== "undefined" ? window.isSecureContext : false;
  const geolocationSupported = typeof navigator !== "undefined" && "geolocation" in navigator;
  const permissionsApiSupported = typeof navigator !== "undefined" && "permissions" in navigator;
  const standalone = typeof window !== "undefined" && (window.matchMedia?.("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true);
  return { secureContext, geolocationSupported, permissionsApiSupported, permission, standalone, userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "" };
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

export function useGeolocation() {
  const [coords, setCoords] = useState<Coords | null>(null);
  const [center, setCenter] = useState<Coords>(FALLBACK_CENTER);
  const [status, setStatus] = useState<GeoStatus>("idle");
  const [permission, setPermission] = useState<GeoPermission>("unknown");
  const [error, setError] = useState<string | null>(null);
  const requestInFlight = useRef(false);
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);

  const request = useCallback(async () => {
    if (requestInFlight.current) return;
    if (typeof window === "undefined" || !navigator.geolocation) {
      setPermission("unsupported");
      setStatus("unavailable");
      setError("Este navegador não oferece suporte à localização.");
      return;
    }
    if (!window.isSecureContext && location.hostname !== "localhost") {
      setStatus("error");
      setError("A localização exige uma conexão segura (HTTPS).");
      return;
    }
    requestInFlight.current = true;
    setStatus("requesting");
    setError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const newCoords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setCoords(newCoords);
        setCenter(newCoords);
        setPermission("granted");
        setStatus("granted");
        requestInFlight.current = false;
      },
      (err) => {
        console.warn("Geolocation error:", err.code, err.message);
        setPermission(err.code === 1 ? "denied" : "unknown");
        setStatus(err.code === 1 ? "denied" : err.code === 2 ? "unavailable" : "error");
        setError(err.code === 1 ? "Permissão de localização não concedida." : err.code === 2 ? "Não foi possível determinar sua localização. Verifique o GPS e a conexão." : "A localização demorou muito para responder. Tente novamente.");
        requestInFlight.current = false;
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  }, []);

  const retry = useCallback(() => void request(), [request]);

  const searchLocation = useCallback(async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }
    setIsSearching(true);
    try {
      // Nominatim search with more details
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5&addressdetails=1`,
        { headers: { 'Accept-Language': 'pt-BR', 'User-Agent': 'TheMatchApp/1.0' } }
      );
      const data = await response.json();
      setSearchResults(data || []);
      
      if (data && data.length > 0) {
        const result = {
          lat: parseFloat(data[0].lat),
          lng: parseFloat(data[0].lon),
        };
        setCenter(result);
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

  useEffect(() => {
    let active = true;
    setStatus("checking");
    void checkGeolocationPermission().then((state) => {
      if (!active) return;
      setPermission(state);
      setStatus(state === "granted" ? "granted" : state === "denied" ? "denied" : state === "unsupported" ? "unavailable" : "prompt");
    });
    return () => { active = false; };
  }, []);

  return { coords, status, permission, error, request, requestLocation: request, retry, center, setCenter, searchLocation, isSearching, searchResults, diagnostics: browserDiagnostics(permission) };
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