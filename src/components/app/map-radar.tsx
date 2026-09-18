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
  distanceLabel?: string;
  matchId?: string;
}

const BALL_SVG = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" width="20" height="20"><circle cx="12" cy="12" r="9.2"/><path d="M12 7.1 8.6 9.6l1.3 4h4.2l1.3-4Z"/><path d="M12 2.8v4.3M4.2 9.4l4.4.2M19.8 9.4l-4.4.2M7 20.3l2.9-6.7M17 20.3l-2.9-6.7"/></svg>`;

function pinIcon(pin: RadarPin, selected: boolean) {
  const label = pin.distanceLabel;
  const height = label ? 62 : 44;
  return L.divIcon({
    className: "",
    iconSize: [64, height],
    iconAnchor: [32, height],
    html: `
      <div style="display:flex;flex-direction:column;align-items:center;gap:4px;width:64px">
        <div style="position:relative;display:grid;place-items:center;width:${selected ? "46px" : "40px"};height:${selected ? "46px" : "40px"};border-radius:9999px;background:${pin.live ? "var(--primary)" : "var(--surface)"};color:${pin.live ? "var(--primary-foreground)" : "var(--foreground)"};border:3px solid var(--surface);box-shadow:${selected ? "0 0 0 5px color-mix(in oklab, var(--primary) 24%, transparent), var(--shadow-float)" : "var(--shadow-float)"};transition:width .2s ease,height .2s ease,box-shadow .2s ease">
          ${BALL_SVG}
        </div>
        ${
          label
            ? `<span style="padding:2px 8px;border-radius:9999px;background:var(--primary);color:var(--primary-foreground);font-family:var(--font-sans);font-size:11px;font-weight:700;white-space:nowrap;box-shadow:var(--shadow-soft)">${label}</span>`
            : ""
        }
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

function KeepMapSized() {
  const map = useMap();
  useEffect(() => {
    const container = map.getContainer();
    const refresh = () => map.invalidateSize({ animate: false });
    const observer = new ResizeObserver(refresh);
    observer.observe(container);
    const frame = window.requestAnimationFrame(refresh);
    window.addEventListener("orientationchange", refresh);
    window.addEventListener("resize", refresh);
    return () => {
      observer.disconnect();
      window.cancelAnimationFrame(frame);
      window.removeEventListener("orientationchange", refresh);
      window.removeEventListener("resize", refresh);
    };
  }, [map]);
  return null;
}

export default function MapRadar({
  center,
  me,
  pins,
  onSelect,
  onMapClick,
  selectedMatchId,
  className,
}: {
  center: Coords;
  me?: Coords | null;
  pins: RadarPin[];
  onSelect?: (id: string) => void;
  onMapClick?: (coords: Coords) => void;
  selectedMatchId?: string | null;
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
      <KeepMapSized />
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
          icon={pinIcon(pin, pin.matchId === selectedMatchId)}
          eventHandlers={{ click: () => onSelect?.(pin.id) }}
          zIndexOffset={pin.live ? 500 : 0}
        />
      ))}
    </MapContainer>
  );
}