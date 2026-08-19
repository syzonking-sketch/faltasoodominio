import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { LogOut, ShieldCheck, Star, Trophy } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/app/app-shell";
import { PlayerAvatar } from "@/components/app/player-avatar";
import { StarRating } from "@/components/app/star-rating";
import { ErrorState, ListSkeleton } from "@/components/app/states";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { fetchPlayerStats, updateProfile } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { friendlyError, supabase } from "@/lib/supabase";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({
    meta: [
      { title: "Carteira do Boleiro — The Match" },
      {
        name: "description",
        content: "Sua reputação na várzea: nota média, partidas disputadas, clãs e histórico de avaliações.",
      },
      { property: "og:title", content: "Carteira do Boleiro — The Match" },
      {
        property: "og:description",
        content: "Reputação, notas e histórico do seu futebol de rua em um só lugar.",
      },
    ],
  }),
  component: ProfilePage,
});

function ProfilePage() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [nickname, setNickname] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");

  useEffect(() => {
    if (profile) {
      setNickname(profile.nickname ?? "");
      setCity(profile.city ?? "");
      setState(profile.state ?? "");
    }
  }, [profile]);

  const statsQuery = useQuery({
    queryKey: ["player-stats", user?.id],
    queryFn: () => fetchPlayerStats(user!.id),
    enabled: Boolean(user?.id),
  });

  const save = useMutation({
    mutationFn: () =>
      updateProfile(user!.id, { nickname, city, state: state.toUpperCase() }),
    onSuccess: () => {
      toast.success("Perfil atualizado.");
      setEditing(false);
      void queryClient.invalidateQueries({ queryKey: ["profile"] });
    },
    onError: (error) => toast.error(friendlyError(error)),
  });

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    void navigate({ to: "/auth", replace: true });
  }

  const stats = statsQuery.data;

  return (
    <AppShell title="Perfil" subtitle="Sua carteira de boleiro">
      <div className="card-glow rounded-2xl border border-border bg-card p-5 text-center">
        <div className="flex justify-center">
          <PlayerAvatar
            name={profile?.full_name ?? "Boleiro"}
            nickname={profile?.nickname ?? null}
            photoUrl={profile?.avatar_url ?? null}
            size="xl"
          />
        </div>
        <h2 className="text-display mt-3 text-2xl font-extrabold text-foreground">
          {profile?.nickname || profile?.full_name}
        </h2>
        <p className="text-xs text-muted-foreground">
          {profile?.full_name} · {profile?.city ?? "Cidade"} / {profile?.state ?? "UF"}
        </p>
      </div>

      {statsQuery.isPending ? (
        <div className="mt-4">
          <ListSkeleton rows={2} />
        </div>
      ) : statsQuery.isError ? (
        <div className="mt-4">
          <ErrorState
            message={friendlyError(statsQuery.error)}
            onRetry={() => void statsQuery.refetch()}
          />
        </div>
      ) : stats ? (
        <>
          <div className="mt-4 grid grid-cols-3 gap-2">
            <div className="rounded-2xl border border-border bg-card p-3 text-center">
              <Star className="mx-auto size-4 text-gold" />
              <p className="text-display mt-1 text-xl font-bold text-foreground">
                {stats.avg_score.toFixed(2)}
              </p>
              <p className="text-[11px] text-muted-foreground">Nota média</p>
            </div>
            <div className="rounded-2xl border border-border bg-card p-3 text-center">
              <Trophy className="mx-auto size-4 text-primary" />
              <p className="text-display mt-1 text-xl font-bold text-foreground">
                {stats.matches_played}
              </p>
              <p className="text-[11px] text-muted-foreground">Partidas</p>
            </div>
            <div className="rounded-2xl border border-border bg-card p-3 text-center">
              <ShieldCheck className="mx-auto size-4 text-accent" />
              <p className="text-display mt-1 text-xl font-bold text-foreground">
                {stats.ratings_count}
              </p>
              <p className="text-[11px] text-muted-foreground">Avaliações</p>
            </div>
          </div>

          <div className="mt-3 flex justify-center">
            <StarRating value={Math.round(stats.avg_score)} size={24} />
          </div>
        </>
      ) : null}

      <div className="mt-6 rounded-2xl border border-border bg-card p-4">
        {editing ? (
          <div className="space-y-3">
            <div>
              <Label htmlFor="nick">Apelido</Label>
              <Input id="nick" value={nickname} onChange={(e) => setNickname(e.target.value)} />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <Label htmlFor="city">Cidade</Label>
                <Input id="city" value={city} onChange={(e) => setCity(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="uf">UF</Label>
                <Input id="uf" maxLength={2} value={state} onChange={(e) => setState(e.target.value)} />
              </div>
            </div>
            <div className="flex gap-2">
              <Button onClick={() => save.mutate()} disabled={save.isPending} className="flex-1">
                Salvar
              </Button>
              <Button variant="ghost" onClick={() => setEditing(false)}>
                Cancelar
              </Button>
            </div>
          </div>
        ) : (
          <Button variant="secondary" className="w-full" onClick={() => setEditing(true)}>
            Editar perfil
          </Button>
        )}
      </div>

      <Button variant="ghost" className="mt-3 w-full text-destructive" onClick={() => void signOut()}>
        <LogOut className="size-4" /> Sair da conta
      </Button>
    </AppShell>
  );
}