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
}

function pinIcon(pin: RadarPin) {
  const color = pin.live ? "var(--primary)" : "var(--muted-foreground)";
  const size = pin.live ? 48 : 40;
  return L.divIcon({
    className: "",
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    html: `
      <div style="position:relative;display:grid;place-items:center;width:${size}px;height:${size}px;filter:drop-shadow(0 0 8px ${pin.live ? color : 'transparent'})">
        ${
          pin.live
            ? `<span class="radar-ping" style="position:absolute;inset:0;border-radius:9999px;background:${color};opacity:.4"></span>`
            : ""
        }
        <div style="position:relative;display:grid;place-items:center;width:${size - 12}px;height:${size - 12}px;border-radius:9999px;background:${color};color:oklch(0.16 0.04 155);font-weight:900;font-family:'Barlow Condensed',sans-serif;font-size:16px;box-shadow:0 8px 20px -4px rgba(0,0,0,.9);border:2px solid rgba(255,255,255,.4);transition:transform 0.2s ease" class="hover:scale-110">
          ${pin.players}
        </div>
      </div>`,
  });
}

function meIcon() {
  return L.divIcon({
    className: "",
    iconSize: [22, 22],
    iconAnchor: [11, 11],
    html: `<span style="display:block;width:18px;height:18px;border-radius:9999px;background:oklch(0.78 0.19 78);border:3px solid rgba(255,255,255,.8);box-shadow:0 0 0 6px oklch(0.78 0.19 78 / .25)"></span>`,
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