import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Check, Loader2, Shield, Swords, UserPlus, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/app/app-shell";
import { PlayerAvatar } from "@/components/app/player-avatar";
import { EmptyState, ErrorState, FieldError, ListSkeleton } from "@/components/app/states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  createTeam,
  fetchTeams,
  removeMember,
  requestToJoinTeam,
  setMemberStatus,
} from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { friendlyError } from "@/lib/supabase";
import { teamSchema, type TeamValues } from "@/lib/schemas";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

export const Route = createFileRoute("/_authenticated/teams/")({
  head: () => ({
    meta: [
      { title: "Times — The Match" },
      {
        name: "description",
        content: "Crie seu time, convide boleiros, aprove solicitações e marque confrontos entre times da várzea.",
      },
      { property: "og:title", content: "Times — The Match" },
      {
        property: "og:description",
        content: "O hub dos times da sua região: escudo, elenco e confrontos.",
      },
    ],
  }),
  component: TeamsPage,
});

function TeamsPage() {
  const { user, profile } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  const teamsQuery = useQuery({ queryKey: ["teams"], queryFn: fetchTeams });
  const teams = teamsQuery.data ?? [];

  const form = useForm<TeamValues>({
    resolver: zodResolver(teamSchema),
    defaultValues: { name: "", shield_url: "", city: profile?.city || "", state: profile?.state || "" },
  });

  const invalidate = () => void queryClient.invalidateQueries({ queryKey: ["teams"] });

  const create = useMutation({
    mutationFn: async (values: TeamValues) => {
      if (!user?.id) {
        throw new Error("Sessão não carregada. Tente fazer login novamente.");
      }
      return createTeam({ ...values, state: values.state.toUpperCase(), captain_id: user.id });
    },
    onSuccess: () => {
      toast.success("Time fundado! Agora chame o elenco.");
      setOpen(false);
      form.reset();
      invalidate();
    },
    onError: (error) => {
      console.error("Erro ao criar time:", error);
      toast.error(friendlyError(error));
    },
  });

  const join = useMutation({
    mutationFn: (teamId: string) => {
      if (!user?.id) throw new Error("Sessão não carregada.");
      return requestToJoinTeam(teamId, user.id);
    },
    onSuccess: () => {
      toast.success("Solicitação enviada ao capitão.");
      invalidate();
    },
    onError: (error) => toast.error(friendlyError(error)),
  });

  const approve = useMutation({
    mutationFn: (memberId: string) => setMemberStatus(memberId, "active"),
    onSuccess: () => {
      toast.success("Boleiro aprovado no elenco.");
      invalidate();
    },
    onError: (error) => toast.error(friendlyError(error)),
  });

  const reject = useMutation({
    mutationFn: (memberId: string) => removeMember(memberId),
    onSuccess: () => {
      toast.success("Solicitação removida.");
      invalidate();
    },
    onError: (error) => toast.error(friendlyError(error)),
  });

  return (
    <AppShell
      title="Times"
      subtitle="Times da sua região"
      action={
        <div className="flex gap-2">
          <Button asChild size="sm" variant="secondary">
            <Link to="/teams/confrontos">
              <Swords className="size-4" /> Contras
            </Link>
          </Button>
          <Dialog open={open} onOpenChange={(v) => {
            setOpen(v);
            if (v && profile) {
              form.setValue("city", profile.city || "");
              form.setValue("state", profile.state || "");
            }
          }}>
            <DialogTrigger asChild>
              <Button size="sm">Criar</Button>
            </DialogTrigger>
            <DialogContent className="max-w-[90vw] rounded-2xl">
              <DialogHeader>
                <DialogTitle className="text-display text-2xl">Criar um time</DialogTitle>
              </DialogHeader>
              <form
                className="space-y-4 py-2"
                onSubmit={form.handleSubmit((values) => create.mutate(values))}
              >
                <div className="space-y-1.5">
                  <Label htmlFor="team-name" className="text-sm font-semibold">Nome do time</Label>
                  <Input id="team-name" placeholder="Ex: Topa do Ouro Preto" {...form.register("name")} className="h-12 bg-surface-1" />
                  <FieldError message={form.formState.errors.name?.message} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="shield" className="text-sm font-semibold">Escudo (URL da imagem)</Label>
                  <Input id="shield" placeholder="https://lh3.googleusercontent.com/..." {...form.register("shield_url")} className="h-12 bg-surface-1" />
                  <FieldError message={form.formState.errors.shield_url?.message} />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-2 space-y-1.5">
                    <Label htmlFor="team-city" className="text-sm font-semibold">Cidade</Label>
                    <Input id="team-city" placeholder="Nova Iguaçu" {...form.register("city")} className="h-12 bg-surface-1" />
                    <FieldError message={form.formState.errors.city?.message} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="team-state" className="text-sm font-semibold">UF</Label>
                    <Input id="team-state" placeholder="RJ" maxLength={2} {...form.register("state")} className="h-12 bg-surface-1 uppercase text-center" />
                    <FieldError message={form.formState.errors.state?.message} />
                  </div>
                </div>
                <DialogFooter className="pt-2">
                  <Button type="submit" disabled={create.isPending} className="w-full h-12 text-lg font-bold shadow-gold/20 shadow-lg">
                    {create.isPending ? <Loader2 className="size-5 animate-spin" /> : "Criar time"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      }
    >
      {teamsQuery.isPending ? (
        <ListSkeleton />
      ) : teamsQuery.isError ? (
        <ErrorState message={friendlyError(teamsQuery.error)} onRetry={() => void teamsQuery.refetch()} />
      ) : teams.length === 0 ? (
        <EmptyState
          icon={<Shield className="size-7" />}
          title="Nenhum time por perto"
          description="Funde o primeiro time da região, escolha o escudo e comece a marcar contras."
          action={<Button onClick={() => setOpen(true)}>Criar time</Button>}
        />
      ) : (
        <ul className="space-y-3">
          {teams.map((team) => {
            const members = team.members ?? [];
            const active = members.filter((m) => m.status === "active");
            const pending = members.filter((m) => m.status === "pending_approval");
            const isCaptain = team.captain_id === user?.id;
            const myMembership = members.find((m) => m.user_id === user?.id);

            return (
              <li key={team.id} className="card-glow rounded-2xl border border-border bg-card p-4">
                <div className="flex items-center gap-3">
                  <PlayerAvatar name={team.name} photoUrl={team.shield_url} size="md" />
                  <div className="min-w-0 flex-1">
                    <p className="text-display truncate text-lg font-bold text-foreground">{team.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {team.city} · {team.state} · {active.length} atletas
                    </p>
                  </div>
                  {isCaptain ? (
                    <Badge className="bg-gold/20 text-gold">Capitão</Badge>
                  ) : myMembership ? (
                    <Badge variant="secondary">
                      {myMembership.status === "active" ? "No elenco" : "Aguardando"}
                    </Badge>
                  ) : (
                    <Button size="sm" variant="outline" onClick={() => join.mutate(team.id)}>
                      <UserPlus className="size-4" /> Entrar
                    </Button>
                  )}
                </div>

                {active.length > 0 ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {active.map((member) => (
                      <div
                        key={member.id}
                        className="flex items-center gap-2 rounded-full bg-surface-2 py-1 pr-3 pl-1"
                      >
                        <PlayerAvatar
                          name={member.profile?.full_name ?? "Boleiro"}
                          nickname={member.profile?.nickname ?? null}
                          photoUrl={member.profile?.avatar_url ?? null}
                          size="sm"
                        />
                        <span className="text-xs font-semibold text-foreground">
                          {member.profile?.nickname ?? "Boleiro"}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : null}

                {isCaptain && pending.length > 0 ? (
                  <div className="mt-3 space-y-2 rounded-xl border border-accent/30 bg-accent/10 p-3">
                    <p className="text-xs font-semibold text-accent">
                      Solicitações de entrada ({pending.length})
                    </p>
                    {pending.map((member) => (
                      <div key={member.id} className="flex items-center gap-2">
                        <PlayerAvatar
                          name={member.profile?.full_name ?? "Boleiro"}
                          nickname={member.profile?.nickname ?? null}
                          photoUrl={member.profile?.avatar_url ?? null}
                          size="sm"
                        />
                        <span className="flex-1 truncate text-sm text-foreground">
                          {member.profile?.nickname ?? "Boleiro"}
                        </span>
                        <Button size="icon" variant="secondary" onClick={() => approve.mutate(member.id)}>
                          <Check className="size-4" />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => reject.mutate(member.id)}>
                          <X className="size-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </AppShell>
  );
}