import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { LogOut, ShieldCheck, Star, Trophy } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/app/app-shell";
import { PlayerAvatar } from "@/components/app/player-avatar";
import { StarRating } from "@/components/app/star-rating";
import { ErrorState } from "@/components/app/states";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ensureCurrentProfile, fetchPlayerStats, updateProfile } from "@/lib/api";
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
  const { user, profile, profileLoading, loading: authLoading, refetchProfile } = useAuth();

  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [nickname, setNickname] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");

  const metadata = user?.user_metadata;
  const accountFullName =
    profile?.full_name ||
    (typeof metadata?.full_name === "string" ? metadata.full_name : "") ||
    user?.email?.split("@")[0] ||
    "Boleiro";
  const accountNickname =
    profile?.nickname ||
    (typeof metadata?.nickname === "string" ? metadata.nickname : "") ||
    accountFullName.split(" ")[0];
  const accountCity =
    profile?.city || (typeof metadata?.city === "string" ? metadata.city : "");
  const accountState =
    profile?.state || (typeof metadata?.state === "string" ? metadata.state : "");
  const accountAvatar =
    profile?.avatar_url ||
    (typeof metadata?.avatar_url === "string" ? metadata.avatar_url : null);

  useEffect(() => {
    if (!user) return;
    setNickname(accountNickname);
    setCity(accountCity);
    setState(accountState);
  }, [user, accountNickname, accountCity, accountState]);

  const statsQuery = useQuery({
    queryKey: ["player-stats", user?.id],
    queryFn: () => {
      if (!user?.id) return Promise.resolve({ avg_score: 0, matches_played: 0, ratings_count: 0 });
      return fetchPlayerStats(user.id);
    },
    enabled: Boolean(user?.id),
    placeholderData: { avg_score: 0, matches_played: 0, ratings_count: 0 },
  });

  const save = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error("Sua conta ainda não carregou.");
      await ensureCurrentProfile();
      await updateProfile(user.id, { nickname, city, state: state.toUpperCase() });
    },
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

  const stats = statsQuery.data ?? { avg_score: 0, matches_played: 0, ratings_count: 0 };

  return (
    <AppShell title="Perfil" subtitle="Sua carteira de boleiro">
      <div className="card-glow rounded-2xl border border-border bg-card p-5 text-center">
        {authLoading && !user ? (
          <div className="flex flex-col items-center gap-3">
            <div className="animate-pulse bg-primary/10 size-28 rounded-full" />
            <div className="animate-pulse rounded-md bg-primary/10 h-8 w-32" />
            <div className="animate-pulse rounded-md bg-primary/10 h-4 w-48" />
          </div>
        ) : !user ? (
          <div className="py-8 text-center">
            <div className="bg-destructive/10 text-destructive p-4 rounded-xl mb-6">
              <p className="font-bold mb-1 text-sm uppercase">Perfil Não Sincronizado</p>
              <p className="text-[10px] leading-tight opacity-80">
                Não foi possível carregar sua conta agora. Tente sincronizar novamente.
              </p>
            </div>
            
            <Button 
              className="w-full mb-4 bg-primary text-primary-foreground font-bold"
              onClick={async () => {
                const toastId = toast.loading("Sincronizando perfil...");
                try {
                  const res = await refetchProfile();
                  if (res.data) {
                    toast.success("Perfil sincronizado com sucesso!", { id: toastId });
                  } else {
                    toast.error("Ainda não conseguimos criar seu perfil. Tente novamente.", { id: toastId });
                  }
                } catch (e) {
                  toast.error("Falha ao sincronizar.", { id: toastId });
                }
              }}
            >
              CRIAR MEU PERFIL AGORA
            </Button>
            
            <p className="text-[9px] text-muted-foreground uppercase tracking-widest break-all">
              ID: {user?.id}
            </p>
          </div>
        ) : (
          <>
            <div className="flex justify-center">
              <PlayerAvatar
                name={accountFullName}
                nickname={accountNickname}
                photoUrl={accountAvatar}
                size="xl"
              />
            </div>
            <h2 className="text-display mt-3 text-2xl font-extrabold text-foreground">
              {accountNickname}
            </h2>
            <p className="text-xs text-muted-foreground uppercase tracking-widest">
              {accountFullName} · {accountCity || "Cidade"} / {accountState || "UF"}
            </p>
          </>
        )}
      </div>

      {authLoading && !user ? (
        <div className="mt-4">
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <div key={i} className="rounded-2xl border border-border bg-card p-4">
                <div className="flex items-center gap-3">
                  <div className="animate-pulse bg-primary/10 size-12 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <div className="animate-pulse rounded-md bg-primary/10 h-4 w-2/3" />
                    <div className="animate-pulse rounded-md bg-primary/10 h-3 w-1/3" />
                  </div>
                  <div className="animate-pulse bg-primary/10 h-8 w-16 rounded-lg" />
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : statsQuery.isError ? (
        <div className="mt-4">
          <ErrorState
            message={friendlyError(statsQuery.error)}
            onRetry={() => void statsQuery.refetch()}
          />
        </div>
      ) : (
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
      )}

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

      <Button variant="ghost" className="mt-3 w-full text-destructive hover:bg-destructive/10" onClick={() => void signOut()}>
        <LogOut className="size-4 mr-2" /> Sair da conta
      </Button>
    </AppShell>
  );
}