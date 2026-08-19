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

  const request = useCallback(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setStatus("denied");
      return;
    }
    setStatus("loading");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const newCoords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setCoords(newCoords);
        setCenter(newCoords);
        setStatus("granted");
      },
      () => setStatus("denied"),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 },
    );
  }, []);

  const searchLocation = useCallback(async (query: string) => {
    if (!query.trim()) return;
    setIsSearching(true);
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`,
        { headers: { 'Accept-Language': 'pt-BR' } }
      );
      const data = await response.json();
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

  return { coords, status, request, center, setCenter, searchLocation, isSearching };
}