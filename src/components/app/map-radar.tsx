import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { MapContainer, Marker, TileLayer, useMap } from "react-leaflet";
import { useEffect } from "react";

import type { Coords } from "@/lib/geo";

export interface RadarPin {
  id: string;
  lat: number;
  lng: number;
  label: string;
  players: number;
  live: boolean;
  matchId?: string;
}

function pinIcon(pin: RadarPin) {
  const size = pin.live ? 46 : 36;
  const inner = pin.live ? 34 : 26;
  const bg = pin.live ? "var(--primary)" : "var(--surface)";
  const fg = pin.live ? "var(--primary-foreground)" : "var(--muted-foreground)";
  return L.divIcon({
    className: "",
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    html: `
      <div style="position:relative;display:grid;place-items:center;width:${size}px;height:${size}px">
        ${
          pin.live
            ? `<span class="radar-ping" style="position:absolute;inset:4px;border-radius:9999px;background:var(--primary)"></span>`
            : ""
        }
        <div style="position:relative;display:grid;place-items:center;width:${inner}px;height:${inner}px;border-radius:9999px;background:${bg};color:${fg};font-weight:700;font-family:var(--font-sans);font-size:13px;letter-spacing:-0.01em;box-shadow:var(--shadow-float);border:2px solid var(--surface)">
          ${
            pin.live
              ? pin.players
              : '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>'
          }
        </div>
      </div>`,
  });
}

function meIcon() {
  return L.divIcon({
    className: "",
    iconSize: [22, 22],
    iconAnchor: [11, 11],
    html: `<span style="display:block;width:14px;height:14px;border-radius:9999px;background:oklch(0.55 0.16 250);border:3px solid var(--surface);box-shadow:0 0 0 5px oklch(0.55 0.16 250 / .18)"></span>`,
  });
}


function Recenter({ center }: { center: Coords }) {
  const map = useMap();
  useEffect(() => {
    map.setView([center.lat, center.lng], map.getZoom(), { animate: true });
  }, [center.lat, center.lng, map]);
  return null;
}

export default function MapRadar({
  center,
  me,
  pins,
  onSelect,
  onMapClick,
  className,
}: {
  center: Coords;
  me?: Coords | null;
  pins: RadarPin[];
  onSelect?: (id: string) => void;
  onMapClick?: (coords: Coords) => void;
  className?: string;
}) {
  return (
    <MapContainer
      center={[center.lat, center.lng]}
      zoom={15}
      zoomControl={false}
      attributionControl={false}
      className={className ?? "h-full w-full"}
      ref={(map) => {
        if (map && onMapClick) {
          map.off("click");
          map.on("click", (event) => onMapClick({ lat: event.latlng.lat, lng: event.latlng.lng }));
        }
      }}
    >
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <Recenter center={center} />
      {me ? (
        <Marker 
          position={[me.lat, me.lng]} 
          icon={meIcon()} 
          zIndexOffset={1000}
        />
      ) : null}
      {pins.map((pin) => (
        <Marker
          key={pin.id}
          position={[pin.lat, pin.lng]}
          icon={pinIcon(pin)}
          eventHandlers={{ click: () => onSelect?.(pin.id) }}
          zIndexOffset={pin.live ? 500 : 0}
        />
      ))}
    </MapContainer>
  );
}