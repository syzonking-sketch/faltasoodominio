import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ListChecks, Plus } from "lucide-react";
import { useState } from "react";

import { AppShell } from "@/components/app/app-shell";
import { MatchDrawer } from "@/components/app/match-drawer";
import { MatchCard } from "@/components/app/match-card";

import { EmptyState, ErrorState, ListSkeleton } from "@/components/app/states";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { fetchMatches } from "@/lib/api";
import { useGeolocation } from "@/lib/geo";
import { friendlyError } from "@/lib/supabase";
import type { MatchWithRelations } from "@/lib/types";

export const Route = createFileRoute("/_authenticated/matches/")({
  head: () => ({
    meta: [
      { title: "Minhas Partidas — The Match" },
      {
        name: "description",
        content: "Acompanhe as peladas ao vivo e o histórico de partidas encerradas com placares e súmulas.",
      },
      { property: "og:title", content: "Partidas — The Match" },
      {
        property: "og:description",
        content: "Súmulas digitais, placares e avaliações das suas peladas.",
      },
    ],
  }),
  component: MatchesPage,
});

function MatchList({
  matches,
  onSelect,
}: {
  matches: MatchWithRelations[];
  onSelect: (id: string) => void;
}) {
  return (
    <ul className="space-y-3">
      {matches.map((match, i) => (
        <li key={match.id}>
          <MatchCard match={match} index={i} onSelect={onSelect} />
        </li>
      ))}
    </ul>
  );
}


function MatchesPage() {
  const { coords } = useGeolocation();
  const [selected, setSelected] = useState<string | null>(null);

  const activeQuery = useQuery({
    queryKey: ["matches", "active"],
    queryFn: () => fetchMatches("active"),
    refetchInterval: 30000,
  });
  const finishedQuery = useQuery({
    queryKey: ["matches", "finished"],
    queryFn: () => fetchMatches("finished"),
    refetchInterval: 60000,
  });

  return (
    <AppShell
      title="Partidas"
      subtitle="Súmulas digitais e histórico"
      action={
        <Button asChild size="sm">
          <Link to="/matches/new">
            <Plus className="size-4" /> Nova
          </Link>
        </Button>
      }
    >
      <Tabs defaultValue="active">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="active">Ao vivo</TabsTrigger>
          <TabsTrigger value="finished">Encerradas</TabsTrigger>
        </TabsList>

        <TabsContent value="active" className="mt-4">
          {activeQuery.isPending ? (
            <ListSkeleton />
          ) : activeQuery.isError ? (
            <ErrorState
              message={friendlyError(activeQuery.error)}
              onRetry={() => void activeQuery.refetch()}
            />
          ) : (activeQuery.data ?? []).length === 0 ? (
            <EmptyState
              icon={<ListChecks className="size-7" />}
              title="Nenhuma bola rolando"
              description="Quando alguém abrir uma pelada na sua região ela aparece aqui na hora."
              action={
                <Button asChild>
                  <Link to="/matches/new">Criar partida</Link>
                </Button>
              }
            />
          ) : (
            <MatchList matches={activeQuery.data ?? []} onSelect={setSelected} />
          )}
        </TabsContent>

        <TabsContent value="finished" className="mt-4">
          {finishedQuery.isPending ? (
            <ListSkeleton />
          ) : finishedQuery.isError ? (
            <ErrorState
              message={friendlyError(finishedQuery.error)}
              onRetry={() => void finishedQuery.refetch()}
            />
          ) : (finishedQuery.data ?? []).length === 0 ? (
            <EmptyState
              icon={<ListChecks className="size-7" />}
              title="Sem histórico ainda"
              description="Assim que uma partida for encerrada pelo criador, o placar e as notas ficam guardados aqui."
            />
          ) : (
            <MatchList matches={finishedQuery.data ?? []} onSelect={setSelected} />
          )}
        </TabsContent>
      </Tabs>

      <MatchDrawer
        matchId={selected}
        myCoords={coords}
        onOpenChange={(open) => setSelected(open ? selected : null)}
      />
    </AppShell>
  );
}