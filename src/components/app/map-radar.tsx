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
  return L.divIcon({
    className: "",
    iconSize: [46, 46],
    iconAnchor: [23, 23],
    html: `
      <div style="position:relative;display:grid;place-items:center;width:46px;height:46px;">
        ${
          pin.live
            ? `<span class="radar-ping" style="position:absolute;inset:6px;border-radius:9999px;background:${color};opacity:.5"></span>`
            : ""
        }
        <span style="position:relative;display:grid;place-items:center;width:34px;height:34px;border-radius:9999px;background:${color};color:oklch(0.16 0.04 155);font-weight:800;font-family:'Barlow Condensed',sans-serif;font-size:15px;box-shadow:0 6px 16px -4px rgba(0,0,0,.8);border:2px solid rgba(255,255,255,.35)">
          ${pin.players}
        </span>
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
      zoom={14}
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
      {me ? <Marker position={[me.lat, me.lng]} icon={meIcon()} /> : null}
      {pins.map((pin) => (
        <Marker
          key={pin.id}
          position={[pin.lat, pin.lng]}
          icon={pinIcon(pin)}
          eventHandlers={{ click: () => onSelect?.(pin.id) }}
        />
      ))}
    </MapContainer>
  );
}