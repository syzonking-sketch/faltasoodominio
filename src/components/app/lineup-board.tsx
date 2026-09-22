import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Shirt, UserPlus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import campoConfronto from "@/assets/confronto-campo.png.asset.json";
import { PlayerAvatar } from "@/components/app/player-avatar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { fetchMatch, setConfrontoLineup } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { friendlyError } from "@/lib/supabase";
import type { Confronto, LineupRole, Team, TeamSide } from "@/lib/types";

type Entry = { user_id: string; lineup_role: LineupRole };

const roleLabel: Record<LineupRole, string> = {
  gk: "Goleiro",
  starter: "Titular",
  bench: "Reserva",
};

function rosterOf(team: Team | null | undefined) {
  if (!team) return [] as { id: string; name: string; photo: string | null }[];
  const seen = new Set<string>();
  const list: { id: string; name: string; photo: string | null }[] = [];
  if (team.captain?.id) {
    seen.add(team.captain.id);
    list.push({
      id: team.captain.id,
      name: team.captain.nickname || team.captain.full_name || "Capitão",
      photo: team.captain.avatar_url,
    });
  }
  for (const member of team.members ?? []) {
    if (!member.user_id || seen.has(member.user_id)) continue;
    if (member.status !== "active") continue;
    seen.add(member.user_id);
    list.push({
      id: member.user_id,
      name: member.profile?.nickname || member.profile?.full_name || "Jogador",
      photo: member.profile?.avatar_url ?? null,
    });
  }
  return list;
}

/** Distribui titulares em linhas (defesa → ataque), como um quadro de escalação. */
function rows<T>(items: T[]): T[][] {
  const n = items.length;
  if (n === 0) return [];
  if (n <= 3) return [items];
  const shape = n <= 5 ? [2, n - 2] : n <= 7 ? [3, n - 3] : n <= 10 ? [4, 3, n - 7] : [4, 4, 3, n - 11];
  const out: T[][] = [];
  let index = 0;
  for (const size of shape) {
    if (size <= 0) continue;
    out.push(items.slice(index, index + size));
    index += size;
  }
  if (index < n) out.push(items.slice(index));
  return out.reverse();
}

function PitchPlayer({ name, photo, badge }: { name: string; photo: string | null; badge?: string }) {
  return (
    <div className="flex min-w-0 flex-col items-center gap-1">
      <span className="relative grid size-11 place-items-center overflow-hidden rounded-full border-2 border-primary-foreground/70 bg-background/70 shadow-raised sm:size-12">
        <PlayerAvatar name={name} photoUrl={photo} size="md" className="size-full border-0" />
      </span>
      <span className="max-w-16 truncate text-[9px] leading-tight font-bold text-primary-foreground drop-shadow-md sm:max-w-20 sm:text-[10px]">
        {badge ? `${badge} ` : ""}
        {name}
      </span>
    </div>
  );
}

export function LineupBoard({ confronto }: { confronto: Confronto }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [side, setSide] = useState<TeamSide>("A");
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Entry[]>([]);

  const matchQuery = useQuery({
    queryKey: ["match", confronto.match_id],
    queryFn: () => fetchMatch(confronto.match_id ?? ""),
    enabled: Boolean(confronto.match_id),
  });

  const team = side === "A" ? confronto.team_a : confronto.team_b;
  const roster = useMemo(() => rosterOf(team), [team]);
  const isCaptain = team?.captain_id === user?.id;

  const participants = (matchQuery.data?.participants ?? []).filter(
    (item) => item.role === "player" && item.team_side === side,
  );
  const named = participants.map((item) => ({
    id: item.user_id,
    name: item.profile?.nickname || item.profile?.full_name || "Jogador",
    photo: item.profile?.avatar_url ?? null,
    role: (item.lineup_role ?? "starter") as LineupRole,
  }));
  const keeper = named.find((item) => item.role === "gk") ?? null;
  const starters = named.filter((item) => item.role === "starter");
  const bench = named.filter((item) => item.role === "bench");

  useEffect(() => {
    if (!editing) return;
    setDraft(named.map((item) => ({ user_id: item.id, lineup_role: item.role })));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing, side]);

  const save = useMutation({
    mutationFn: () => setConfrontoLineup({ confronto_id: confronto.id, team_side: side, entries: draft }),
    onSuccess: () => {
      toast.success("Escalação salva.");
      setEditing(false);
      void matchQuery.refetch();
      void queryClient.invalidateQueries({ queryKey: ["confrontos"] });
    },
    onError: (error) => toast.error(friendlyError(error)),
  });

  const setRole = (id: string, role: LineupRole | null) => {
    setDraft((current) => {
      const without = current.filter((item) => item.user_id !== id);
      if (!role) return without;
      const cleaned = role === "gk" ? without.filter((item) => item.lineup_role !== "gk") : without;
      return [...cleaned, { user_id: id, lineup_role: role }];
    });
  };

  const draftRole = (id: string) => draft.find((item) => item.user_id === id)?.lineup_role ?? null;
  const draftCount = (role: LineupRole) => draft.filter((item) => item.lineup_role === role).length;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-[11px] font-bold tracking-[0.14em] text-muted-foreground uppercase">Escalação</h4>
        <div className="flex rounded-full border border-border/60 bg-surface-2/70 p-1">
          {(["A", "B"] as TeamSide[]).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setSide(option)}
              className={`max-w-28 truncate rounded-full px-3 py-1 text-[11px] font-bold transition-colors ${
                side === option ? "bg-primary text-primary-foreground" : "text-muted-foreground"
              }`}
            >
              {(option === "A" ? confronto.team_a?.name : confronto.team_b?.name) ?? `Time ${option}`}
            </button>
          ))}
        </div>
      </div>

      <div className="relative isolate aspect-[3/4] w-full overflow-hidden rounded-3xl border border-primary/30 bg-surface-2 shadow-raised">
        <img
          src={campoConfronto.url}
          alt="Campo de futebol"
          className="absolute inset-0 size-full rotate-90 scale-[1.34] object-cover"
        />
        <div className="absolute inset-0 bg-background/25" />

        {matchQuery.isPending ? (
          <div className="relative grid size-full place-items-center">
            <Loader2 className="size-6 animate-spin text-primary-foreground" />
          </div>
        ) : named.length === 0 ? (
          <div className="relative grid size-full place-items-center px-8 text-center">
            <p className="text-xs font-semibold text-primary-foreground drop-shadow-md">
              {isCaptain
                ? "Monte a escalação: escolha o goleiro, os titulares e os reservas."
                : "O capitão ainda não escalou este time."}
            </p>
          </div>
        ) : (
          <div className="relative flex size-full flex-col justify-between gap-2 px-3 py-4">
            {rows(starters).map((line, index) => (
              <div key={index} className="flex items-center justify-evenly gap-1">
                {line.map((player) => (
                  <PitchPlayer key={player.id} name={player.name} photo={player.photo} />
                ))}
              </div>
            ))}
            <div className="flex items-center justify-center">
              {keeper ? <PitchPlayer name={keeper.name} photo={keeper.photo} badge="GOL" /> : null}
            </div>
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-border/50 bg-surface-2/60 p-3">
        <p className="text-[10px] font-bold tracking-[0.14em] text-muted-foreground uppercase">
          Reservas ({bench.length})
        </p>
        {bench.length === 0 ? (
          <p className="mt-1 text-xs text-muted-foreground">Nenhum reserva escalado.</p>
        ) : (
          <ul className="mt-2 flex flex-wrap gap-2">
            {bench.map((player) => (
              <li
                key={player.id}
                className="flex items-center gap-2 rounded-full border border-border/50 bg-surface px-2 py-1"
              >
                <PlayerAvatar name={player.name} photoUrl={player.photo} size="sm" className="size-7 border-0" />
                <span className="max-w-24 truncate text-xs font-semibold">{player.name}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {isCaptain ? (
        <Button variant="outline" className="h-11 w-full rounded-xl" onClick={() => setEditing(true)}>
          <Shirt className="size-4" /> Montar escalação
        </Button>
      ) : null}

      <Dialog open={editing} onOpenChange={setEditing}>
        <DialogContent className="max-w-[92vw] rounded-3xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-display text-2xl">Escalar {team?.name ?? "time"}</DialogTitle>
            <DialogDescription>
              Escolha quem começa jogando, quem vai ao banco e quem fica no gol.
            </DialogDescription>
          </DialogHeader>

          <div className="flex gap-2 text-[11px] font-bold text-muted-foreground">
            <span className="rounded-full bg-surface-2 px-2.5 py-1">Titulares {draftCount("starter")}</span>
            <span className="rounded-full bg-surface-2 px-2.5 py-1">Reservas {draftCount("bench")}</span>
            <span className="rounded-full bg-surface-2 px-2.5 py-1">Goleiro {draftCount("gk")}</span>
          </div>

          {roster.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
              Este time ainda não tem jogadores ativos no elenco.
            </p>
          ) : (
            <ul className="max-h-[50vh] space-y-2 overflow-y-auto pr-1">
              {roster.map((player) => {
                const current = draftRole(player.id);
                return (
                  <li
                    key={player.id}
                    className="flex items-center gap-2 rounded-2xl border border-border/50 bg-surface-2/60 p-2"
                  >
                    <PlayerAvatar name={player.name} photoUrl={player.photo} size="sm" className="shrink-0" />
                    <span className="min-w-0 flex-1 truncate text-sm font-semibold">{player.name}</span>
                    <div className="flex shrink-0 gap-1">
                      {(["gk", "starter", "bench"] as LineupRole[]).map((role) => (
                        <button
                          key={role}
                          type="button"
                          onClick={() => setRole(player.id, current === role ? null : role)}
                          aria-label={`${roleLabel[role]}: ${player.name}`}
                          className={`rounded-full px-2 py-1 text-[10px] font-bold transition-colors ${
                            current === role
                              ? "bg-primary text-primary-foreground"
                              : "bg-surface text-muted-foreground"
                          }`}
                        >
                          {role === "gk" ? "GOL" : role === "starter" ? "TIT" : "RES"}
                        </button>
                      ))}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          <DialogFooter>
            <Button
              className="h-12 w-full rounded-xl text-base font-bold"
              disabled={save.isPending}
              onClick={() => save.mutate()}
            >
              {save.isPending ? <Loader2 className="size-4 animate-spin" /> : <UserPlus className="size-4" />}
              Salvar escalação
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
