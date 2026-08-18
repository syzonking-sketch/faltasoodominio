import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Loader2, ShieldAlert, Swords } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
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
import { createConfronto, fetchConfrontos, fetchTeams, fetchVenues, reportConfrontoScore } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { confrontoSchema, type ConfrontoValues } from "@/lib/schemas";
import { friendlyError } from "@/lib/supabase";
import type { Confronto } from "@/lib/types";

export const Route = createFileRoute("/_authenticated/teams/confrontos")({
  head: () => ({
    meta: [
      { title: "Contras entre Times — The Match" },
      {
        name: "description",
        content:
          "Agende confrontos entre clãs e valide o placar em dupla checagem entre capitães. Divergência anula a partida.",
      },
      { property: "og:title", content: "Contras entre Times — The Match" },
      {
        property: "og:description",
        content: "Validação cruzada de placar entre capitães, com anulação automática em caso de conflito.",
      },
    ],
  }),
  component: ConfrontosPage,
});

const statusLabel: Record<Confronto["status"], { text: string; className: string }> = {
  pending: { text: "AGUARDANDO VALIDAÇÃO", className: "bg-accent/20 text-accent" },
  confirmed: { text: "PLACAR CONFIRMADO", className: "bg-primary/20 text-primary" },
  conflict_nullified: { text: "ANULADA POR CONFLITO", className: "bg-destructive/20 text-destructive" },
};

function ScoreForm({
  confronto,
  side,
  onDone,
}: {
  confronto: Confronto;
  side: "A" | "B";
  onDone: () => void;
}) {
  const [a, setA] = useState("0");
  const [b, setB] = useState("0");

  const report = useMutation({
    mutationFn: () =>
      reportConfrontoScore({ confronto, side, score_a: Number(a) || 0, score_b: Number(b) || 0 }),
    onSuccess: (status) => {
      if (status === "confirmed") toast.success("Placar batido pelos dois capitães. Confirmado!");
      else if (status === "conflict_nullified")
        toast.error("Placares divergentes sem consenso: confronto anulado automaticamente.");
      else toast.success("Placar enviado. Aguardando o outro capitão.");
      onDone();
    },
    onError: (error) => toast.error(friendlyError(error)),
  });

  return (
    <div className="mt-3 flex items-end gap-2 rounded-xl bg-surface-2 p-3">
      <div className="flex-1">
        <Label className="text-xs">{confronto.team_a?.name ?? "Time A"}</Label>
        <Input inputMode="numeric" value={a} onChange={(e) => setA(e.target.value)} />
      </div>
      <div className="flex-1">
        <Label className="text-xs">{confronto.team_b?.name ?? "Time B"}</Label>
        <Input inputMode="numeric" value={b} onChange={(e) => setB(e.target.value)} />
      </div>
      <Button onClick={() => report.mutate()} disabled={report.isPending}>
        {report.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
        Enviar
      </Button>
    </div>
  );
}

function ConfrontosPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  const confrontosQuery = useQuery({ queryKey: ["confrontos"], queryFn: fetchConfrontos });
  const teamsQuery = useQuery({ queryKey: ["teams"], queryFn: fetchTeams });
  const venuesQuery = useQuery({ queryKey: ["venues"], queryFn: fetchVenues });

  const teams = teamsQuery.data ?? [];
  const venues = venuesQuery.data ?? [];
  const myTeams = teams.filter((t) => t.captain_id === user?.id);

  const form = useForm<ConfrontoValues>({
    resolver: zodResolver(confrontoSchema),
    defaultValues: { team_a_id: "", team_b_id: "", scheduled_at: "" },
  });

  const create = useMutation({
    mutationFn: (values: ConfrontoValues) =>
      createConfronto({
        team_a_id: values.team_a_id,
        team_b_id: values.team_b_id,
        venue_id: values.venue_id ?? null,
        scheduled_at: new Date(values.scheduled_at).toISOString(),
      }),
    onSuccess: () => {
      toast.success("Contra marcado! Agora é só aparecer.");
      setOpen(false);
      form.reset();
      void queryClient.invalidateQueries({ queryKey: ["confrontos"] });
    },
    onError: (error) => toast.error(friendlyError(error)),
  });

  const refresh = () => void queryClient.invalidateQueries({ queryKey: ["confrontos"] });

  return (
    <AppShell
      title="Contras"
      subtitle="Confrontos entre clãs com validação cruzada"
      action={
        <div className="flex gap-2">
          <Button asChild size="sm" variant="ghost">
            <Link to="/teams">
              <ArrowLeft className="size-4" /> Times
            </Link>
          </Button>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" disabled={myTeams.length === 0}>
                Marcar
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="text-display text-2xl">Marcar contra</DialogTitle>
              </DialogHeader>
              <form className="space-y-3" onSubmit={form.handleSubmit((v) => create.mutate(v))}>
                <div>
                  <Label htmlFor="team-a">Seu time</Label>
                  <select
                    id="team-a"
                    className="h-10 w-full rounded-md border border-input bg-surface-2 px-3 text-sm text-foreground"
                    {...form.register("team_a_id")}
                  >
                    <option value="">Selecione</option>
                    {myTeams.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                  <FieldError message={form.formState.errors.team_a_id?.message} />
                </div>
                <div>
                  <Label htmlFor="team-b">Adversário</Label>
                  <select
                    id="team-b"
                    className="h-10 w-full rounded-md border border-input bg-surface-2 px-3 text-sm text-foreground"
                    {...form.register("team_b_id")}
                  >
                    <option value="">Selecione</option>
                    {teams
                      .filter((t) => t.captain_id !== user?.id)
                      .map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                  </select>
                  <FieldError message={form.formState.errors.team_b_id?.message} />
                </div>
                <div>
                  <Label htmlFor="venue">Quadra</Label>
                  <select
                    id="venue"
                    className="h-10 w-full rounded-md border border-input bg-surface-2 px-3 text-sm text-foreground"
                    {...form.register("venue_id")}
                  >
                    <option value="">A definir</option>
                    {venues.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label htmlFor="date">Data e hora</Label>
                  <Input id="date" type="datetime-local" {...form.register("scheduled_at")} />
                  <FieldError message={form.formState.errors.scheduled_at?.message} />
                </div>
                <DialogFooter>
                  <Button type="submit" className="w-full" disabled={create.isPending}>
                    {create.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
                    Marcar contra
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      }
    >
      {confrontosQuery.isPending ? (
        <ListSkeleton />
      ) : confrontosQuery.isError ? (
        <ErrorState
          message={friendlyError(confrontosQuery.error)}
          onRetry={() => void confrontosQuery.refetch()}
        />
      ) : (confrontosQuery.data ?? []).length === 0 ? (
        <EmptyState
          icon={<Swords className="size-7" />}
          title="Nenhum contra marcado"
          description="Capitães podem marcar confrontos entre clãs e validar o placar em dupla checagem."
        />
      ) : (
        <ul className="space-y-3">
          {(confrontosQuery.data ?? []).map((confronto) => {
            const isCaptainA = confronto.team_a?.captain_id === user?.id;
            const isCaptainB = confronto.team_b?.captain_id === user?.id;
            const reportedByA = confronto.reported_score_a_by_a !== null;
            const reportedByB = confronto.reported_score_a_by_b !== null;
            const status = statusLabel[confronto.status];

            return (
              <li key={confronto.id} className="card-glow rounded-2xl border border-border bg-card p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 flex-1 items-center gap-2">
                    <PlayerAvatar name={confronto.team_a?.name ?? "A"} photoUrl={confronto.team_a?.shield_url} size="sm" />
                    <span className="truncate text-sm font-semibold text-foreground">
                      {confronto.team_a?.name ?? "Time A"}
                    </span>
                  </div>
                  <span className="text-display text-lg text-muted-foreground">x</span>
                  <div className="flex min-w-0 flex-1 items-center justify-end gap-2">
                    <span className="truncate text-sm font-semibold text-foreground">
                      {confronto.team_b?.name ?? "Time B"}
                    </span>
                    <PlayerAvatar name={confronto.team_b?.name ?? "B"} photoUrl={confronto.team_b?.shield_url} size="sm" />
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Badge className={status.className}>{status.text}</Badge>
                  {confronto.scheduled_at ? (
                    <span className="text-xs text-muted-foreground">
                      {new Date(confronto.scheduled_at).toLocaleString("pt-BR", {
                        day: "2-digit",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  ) : null}
                  {confronto.venue?.name ? (
                    <span className="text-xs text-muted-foreground">· {confronto.venue.name}</span>
                  ) : null}
                </div>

                {confronto.status === "confirmed" ? (
                  <p className="text-display mt-3 text-center text-3xl font-extrabold text-primary">
                    {confronto.reported_score_a_by_a}–{confronto.reported_score_b_by_a}
                  </p>
                ) : null}

                {confronto.status === "conflict_nullified" ? (
                  <p className="mt-3 flex items-center gap-2 rounded-xl bg-destructive/10 p-3 text-xs text-destructive">
                    <ShieldAlert className="size-4 shrink-0" />
                    Capitães informaram placares diferentes ({confronto.reported_score_a_by_a}–
                    {confronto.reported_score_b_by_a} vs {confronto.reported_score_a_by_b}–
                    {confronto.reported_score_b_by_b}). Sem consenso da torcida, o resultado foi anulado.
                  </p>
                ) : null}

                {confronto.status === "pending" ? (
                  <>
                    <p className="mt-3 text-xs text-muted-foreground">
                      {reportedByA ? "Capitão A já enviou." : "Capitão A ainda não enviou."}{" "}
                      {reportedByB ? "Capitão B já enviou." : "Capitão B ainda não enviou."}
                    </p>
                    {isCaptainA && !reportedByA ? (
                      <ScoreForm confronto={confronto} side="A" onDone={refresh} />
                    ) : null}
                    {isCaptainB && !reportedByB ? (
                      <ScoreForm confronto={confronto} side="B" onDone={refresh} />
                    ) : null}
                  </>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </AppShell>
  );
}