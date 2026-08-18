import { useEffect, useState, type ReactNode } from "react";

/** Renders children only after hydration (browser-only libraries like Leaflet). */
export function ClientOnly({ children, fallback }: { children: ReactNode; fallback?: ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return <>{fallback ?? null}</>;
  return <>{children}</>;
}