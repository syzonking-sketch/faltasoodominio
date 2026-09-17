import { useQuery } from "@tanstack/react-query";
import { CircleDot, MapPin, Shield, Star, Swords, Trophy } from "lucide-react";

import { PlayerAvatar } from "@/components/app/player-avatar";
import { ErrorState } from "@/components/app/states";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { fetchPlayerPublicStats } from "@/lib/api";
import { friendlyError } from "@/lib/supabase";
import type { Profile } from "@/lib/types";

export function PlayerProfileDialog({
  player,
  onOpenChange,
}: {
  player: Profile | null;
  onOpenChange: (open: boolean) => void;
}) {
  const statsQuery = useQuery({
    queryKey: ["player-public-stats", player?.id],
    queryFn: () => fetchPlayerPublicStats(player?.id ?? ""),
    enabled: Boolean(player?.id),
  });

  return (
    <Dialog open={Boolean(player)} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-env(safe-area-inset-top,0px)-env(safe-area-inset-bottom,0px)-1.5rem)] max-w-[92vw] touch-pan-y overflow-y-auto overscroll-contain rounded-2xl pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))] sm:max-h-[85dvh] sm:max-w-sm">
        {player ? (
          <>
            <DialogHeader className="items-center text-center">
              <PlayerAvatar
                name={player.full_name}
                nickname={player.nickname}
                photoUrl={player.avatar_url}
                size="xl"
              />
              <div>
                <DialogTitle className="text-display mt-2 text-2xl">
                  {player.nickname || player.full_name}
                </DialogTitle>
                <DialogDescription>{player.full_name}</DialogDescription>
              </div>
            </DialogHeader>

            <div className="flex items-center justify-center gap-1.5 text-sm text-muted-foreground">
              <MapPin className="size-4 text-primary" />
              <span>{player.city || "Bairro não informado"}{player.state ? ` · ${player.state}` : ""}</span>
            </div>

            {statsQuery.isPending ? (
              <div className="grid grid-cols-2 gap-2" aria-label="Carregando informações do jogador">
                {[1, 2, 3, 4].map((item) => (
                  <div key={item} className="h-20 animate-pulse rounded-xl bg-surface-2" />
                ))}
              </div>
            ) : statsQuery.isError ? (
              <ErrorState message={friendlyError(statsQuery.error)} onRetry={() => void statsQuery.refetch()} />
            ) : (
              <>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: "Jogos", value: statsQuery.data?.matches_played ?? 0, icon: Swords },
                    { label: "Gols", value: statsQuery.data?.goals ?? 0, icon: CircleDot },
                    { label: "Campeonatos", value: statsQuery.data?.championships ?? 0, icon: Trophy },
                    { label: "Nota", value: (statsQuery.data?.avg_score ?? 0).toFixed(2), icon: Star },
                    { label: "Amarelos", value: statsQuery.data?.yellow_cards ?? 0, icon: Shield },
                    { label: "Vermelhos", value: statsQuery.data?.red_cards ?? 0, icon: Shield },
                  ].map(({ label, value, icon: Icon }) => (
                    <div key={label} className="rounded-xl border border-border bg-surface-2 p-3 text-center">
                      <Icon className="mx-auto size-4 text-primary" />
                      <p className="text-display mt-1 text-xl font-bold text-foreground">{value}</p>
                      <p className="text-[11px] text-muted-foreground">{label}</p>
                    </div>
                  ))}
                </div>

                <div className="rounded-xl border border-border bg-card p-3">
                  <p className="mb-2 flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                    <Shield className="size-4 text-primary" /> Times
                  </p>
                  {statsQuery.data?.teams.length ? (
                    <div className="flex flex-wrap gap-2">
                      {statsQuery.data.teams.map((team) => (
                        <span key={team.id} className="rounded-full bg-surface-2 px-3 py-1 text-xs font-semibold text-foreground">
                          {team.name}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">Sem time no momento.</p>
                  )}
                </div>
              </>
            )}
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}