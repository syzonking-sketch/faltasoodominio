import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { Bell, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { fetchMatches } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { distanceMeters, formatDistance, useGeolocation } from "@/lib/geo";
import { cn } from "@/lib/utils";
import type { MatchWithRelations } from "@/lib/types";

const SEEN_KEY = "thematch:notifications:seen-at";
const NEARBY_RADIUS_METERS = 8000;
const MAX_AGE_HOURS = 48;

function readSeenAt(): number {
  if (typeof window === "undefined") return 0;
  const raw = window.localStorage.getItem(SEEN_KEY);
  const value = raw ? Number(raw) : 0;
  return Number.isFinite(value) ? value : 0;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.max(1, Math.round(diff / 60000));
  if (minutes < 60) return `há ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `há ${hours} h`;
  return `há ${Math.round(hours / 24)} d`;
}

export function NotificationsBell({ className }: { className?: string }) {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const { coords } = useGeolocation();
  const [open, setOpen] = useState(false);
  const [seenAt, setSeenAt] = useState(0);

  useEffect(() => setSeenAt(readSeenAt()), []);

  const { data: matches = [] } = useQuery({
    queryKey: ["notifications", "matches"],
    queryFn: () => fetchMatches("active"),
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  const nearby = useMemo(() => {
    const city = profile?.city?.toLowerCase() ?? null;
    const minCreatedAt = Date.now() - MAX_AGE_HOURS * 3600_000;

    const withDistance = matches
      .filter((match) => match.created_by !== user?.id)
      .filter((match) => new Date(match.created_at).getTime() >= minCreatedAt)
      .map((match) => {
        const venue = match.venue;
        const distance =
          coords && venue?.latitude != null && venue?.longitude != null
            ? distanceMeters(coords, { lat: venue.latitude, lng: venue.longitude })
            : null;
        return { match, distance };
      })
      .filter(({ match, distance }) => {
        if (distance != null) return distance <= NEARBY_RADIUS_METERS;
        if (!city) return true;
        return match.venue?.city?.toLowerCase() === city;
      });

    return withDistance
      .sort((a, b) => {
        if (a.distance != null && b.distance != null) return a.distance - b.distance;
        return new Date(b.match.created_at).getTime() - new Date(a.match.created_at).getTime();
      })
      .slice(0, 12);
  }, [matches, coords, profile?.city, user?.id]);

  const unread = nearby.filter(({ match }) => new Date(match.created_at).getTime() > seenAt).length;
  const notificationCount = nearby.length;

  const markSeen = useCallback(() => {
    const now = Date.now();
    window.localStorage.setItem(SEEN_KEY, String(now));
    setSeenAt(now);
  }, []);

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (next) markSeen();
  };

  const goToMatch = (match: MatchWithRelations) => {
    setOpen(false);
    void navigate({ to: "/matches", hash: match.id });
  };

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="secondary"
          size="icon"
          aria-label={
            notificationCount > 0
              ? `Notificações (${notificationCount}${unread > 0 ? `, ${unread} novas` : ""})`
              : "Notificações"
          }
          className={cn("relative size-12 rounded-full border border-border/70 bg-secondary/80 backdrop-blur-xl", className)}
        >
          <Bell className="size-5" />
          {notificationCount > 0 ? (
            <span className="absolute -top-0.5 -right-0.5 grid min-w-5 place-items-center rounded-full bg-primary px-1.5 py-0.5 text-[0.625rem] leading-none font-bold text-primary-foreground">
              {notificationCount > 9 ? "9+" : notificationCount}
            </span>
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" sideOffset={10} className="w-[min(22rem,calc(100vw-2rem))] rounded-3xl border-border/70 bg-card/95 p-0 backdrop-blur-xl">
        <div className="border-b border-border/60 px-4 py-3">
          <p className="text-sm font-bold text-foreground">Notificações</p>
          <p className="text-xs text-muted-foreground">Partidas criadas perto de você</p>
        </div>
        <div className="max-h-[22rem] overflow-y-auto p-2">
          {nearby.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">
              Nenhuma partida nova por perto agora.
            </p>
          ) : (
            nearby.map(({ match, distance }) => (
              <button
                key={match.id}
                type="button"
                onClick={() => goToMatch(match)}
                className="press flex w-full items-start gap-3 rounded-2xl px-3 py-3 text-left transition-colors hover:bg-secondary/70"
              >
                <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-full bg-primary/15 text-primary">
                  <MapPin className="size-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-bold text-foreground">
                    {match.name ?? match.venue?.name ?? "Nova partida"}
                  </span>
                  <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                    {match.venue?.name ?? "Local a definir"}
                    {match.venue?.city ? ` • ${match.venue.city}` : ""}
                  </span>
                  <span className="mt-1 block text-xs text-muted-foreground">
                    {timeAgo(match.created_at)}
                    {distance != null ? ` • ${formatDistance(distance)}` : ""}
                  </span>
                </span>
              </button>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
