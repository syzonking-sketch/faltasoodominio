import { useCallback, useEffect, useState } from "react";

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

export type GeoStatus = "idle" | "loading" | "granted" | "denied";

export function useGeolocation() {
  const [coords, setCoords] = useState<Coords | null>(null);
  const [center, setCenter] = useState<Coords>(FALLBACK_CENTER);
  const [status, setStatus] = useState<GeoStatus>("idle");
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);

  const request = useCallback(() => {
    if (typeof window === "undefined" || !navigator.geolocation) {
      setStatus("denied");
      return;
    }

    setStatus("loading");

    // iOS/Safari fix: check permissions state first if available, but always trigger the call
    // because some browsers only prompt when the actual function is called.
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const newCoords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setCoords(newCoords);
        setCenter(newCoords);
        setStatus("granted");
      },
      (err) => {
        console.warn("Geolocation error:", err.code, err.message);
        setStatus("denied");
        
        // Error code 1 is PERMISSION_DENIED.
        // If we get this on iOS without a prompt, it might be due to insecure origin (needs HTTPS)
        // or the user previously denied and it's cached.
        if (err.code === 1) {
          console.error("Localização negada pelo usuário ou pelo sistema.");
        }
      },
      // enableHighAccuracy: false can sometimes trigger a prompt where true fails on older devices/weak signal
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 },
    );
  }, []);

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
    request();
  }, [request]);

  return { coords, status, request, center, setCenter, searchLocation, isSearching, searchResults };
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