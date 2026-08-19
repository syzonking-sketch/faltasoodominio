import { supabase } from "./supabase";
import type {
  Confronto,
  ConfrontoStatus,
  MatchParticipant,
  MatchWithRelations,
  ParticipantRole,
  Profile,
  RankingRow,
  Rating,
  Team,
  TeamMember,
  TeamSide,
  Venue,
} from "./types";

function unwrap<T>(result: { data: unknown; error: { message: string } | null }): T {
  if (result.error) throw new Error(result.error.message);
  return result.data as T;
}

const MATCH_SELECT = `
  *,
  venue:venues(*),
  creator:profiles!matches_created_by_fkey(*),
  participants:match_participants(*, profile:profiles(*))
`;

/* ---------------------------------- Venues --------------------------------- */

export async function fetchVenues(search?: string): Promise<Venue[]> {
  let query = supabase.from("venues").select("*").order("name");
  
  if (search) {
    query = query.or(`name.ilike.%${search}%,address.ilike.%${search}%`);
  }
  
  return unwrap<Venue[]>(await query);
}

export async function createVenue(input: {
  name: string;
  address: string;
  latitude: number;
  longitude: number;
}): Promise<Venue> {
  return unwrap<Venue>(await supabase.from("venues").insert(input).select("*").single());
}

/* --------------------------------- Matches --------------------------------- */

export async function fetchMatches(status?: "active" | "finished"): Promise<MatchWithRelations[]> {
  let query = supabase.from("matches").select(MATCH_SELECT).order("created_at", { ascending: false });
  if (status) query = query.eq("status", status);
  return unwrap<MatchWithRelations[]>(await query);
}

export async function fetchMatch(id: string): Promise<MatchWithRelations | null> {
  return unwrap<MatchWithRelations | null>(
    await supabase.from("matches").select(MATCH_SELECT).eq("id", id).maybeSingle(),
  );
}

export async function createMatch(input: {
  venue_id: string;
  created_by: string;
  name?: string | null;
  match_type: "pelada" | "campeonato";
  role: ParticipantRole;
  team_side: TeamSide;
  checked_in_gps: boolean;
  scheduled_at?: string | null;
  finished_at?: string | null;
}): Promise<string> {
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!uuidPattern.test(input.venue_id)) {
    throw new Error("Selecione uma quadra válida no mapa.");
  }
  if (!uuidPattern.test(input.created_by)) {
    throw new Error("Sua sessão não carregou corretamente. Entre novamente e tente criar a partida.");
  }

  const matchResponse = await supabase
    .from("matches")
    .insert({
      venue_id: input.venue_id,
      created_by: input.created_by,
      name: input.name || null,
      match_type: input.match_type,
      status: "active",
      scheduled_at: input.scheduled_at || new Date().toISOString(),
    })
    .select("id")
    .single();

  const match = unwrap<{ id: string }>(matchResponse);

  unwrap<unknown>(
    await supabase.from("match_participants").insert({
      match_id: match.id,
      user_id: input.created_by,
      role: input.role,
      team_side: input.role === "player" ? input.team_side : null,
      checked_in_gps: input.checked_in_gps,
    }),
  );

  return match.id;
}

export async function joinMatch(input: {
  match_id: string;
  user_id: string;
  role: ParticipantRole;
  team_side: TeamSide | null;
  checked_in_gps: boolean;
}): Promise<MatchParticipant> {
  return unwrap<MatchParticipant>(
    await supabase
      .from("match_participants")
      .insert({
        match_id: input.match_id,
        user_id: input.user_id,
        role: input.role,
        team_side: input.role === "player" ? input.team_side : null,
        checked_in_gps: input.checked_in_gps,
      })
      .select("*")
      .single(),
  );
}

export async function leaveMatch(participantId: string): Promise<void> {
  unwrap<unknown>(await supabase.from("match_participants").delete().eq("id", participantId));
}

export async function finishMatch(input: {
  match_id: string;
  score_team_a: number;
  score_team_b: number;
}): Promise<void> {
  unwrap<unknown>(
    await supabase
      .from("matches")
      .update({
        status: "finished",
        score_team_a: input.score_team_a,
        score_team_b: input.score_team_b,
        updated_at: new Date().toISOString(),
      })
      .eq("id", input.match_id),
  );
}

export async function cancelMatch(matchId: string): Promise<void> {
  unwrap<unknown>(
    await supabase
      .from("matches")
      .update({ status: "cancelled", updated_at: new Date().toISOString() })
      .eq("id", matchId),
  );
}

/* --------------------------------- Ratings --------------------------------- */

export async function fetchRatingsByEvaluator(evaluatorId: string): Promise<Rating[]> {
  return unwrap<Rating[]>(
    await supabase.from("ratings").select("*").eq("evaluator_id", evaluatorId),
  );
}

export async function fetchRatingsForUser(userId: string): Promise<Rating[]> {
  return unwrap<Rating[]>(
    await supabase.from("ratings").select("*").eq("evaluated_user_id", userId),
  );
}

export async function submitRating(input: {
  match_id: string;
  evaluator_id: string;
  evaluated_user_id: string;
  score: number;
  is_opponent: boolean;
}): Promise<void> {
  unwrap<unknown>(await supabase.from("ratings").insert(input));
}

/* ---------------------------------- Teams ---------------------------------- */

const TEAM_SELECT = `*, captain:profiles!teams_captain_id_fkey(*), members:team_members(*, profile:profiles(*))`;

export async function fetchTeams(): Promise<Team[]> {
  return unwrap<Team[]>(
    await supabase.from("teams").select(TEAM_SELECT).order("created_at", { ascending: false }),
  );
}

export async function createTeam(input: {
  name: string;
  shield_url: string;
  city: string;
  state: string;
  captain_id: string;
}): Promise<Team> {
  const team = unwrap<Team>(await supabase.from("teams").insert(input).select("*").single());
  unwrap<unknown>(
    await supabase
      .from("team_members")
      .insert({ team_id: team.id, user_id: input.captain_id, status: "active" }),
  );
  return team;
}

export async function requestToJoinTeam(teamId: string, userId: string): Promise<void> {
  unwrap<unknown>(
    await supabase
      .from("team_members")
      .insert({ team_id: teamId, user_id: userId, status: "pending_approval" }),
  );
}

export async function inviteToTeam(teamId: string, userId: string): Promise<void> {
  unwrap<unknown>(
    await supabase.from("team_members").insert({ team_id: teamId, user_id: userId, status: "invited" }),
  );
}

export async function setMemberStatus(memberId: string, status: "active"): Promise<void> {
  unwrap<unknown>(await supabase.from("team_members").update({ status }).eq("id", memberId));
}

export async function removeMember(memberId: string): Promise<void> {
  unwrap<unknown>(await supabase.from("team_members").delete().eq("id", memberId));
}

export async function fetchMyMemberships(userId: string): Promise<TeamMember[]> {
  return unwrap<TeamMember[]>(
    await supabase.from("team_members").select("*, team:teams(*)").eq("user_id", userId),
  );
}

/* -------------------------------- Confrontos -------------------------------- */

const CONFRONTO_SELECT = `
  *,
  team_a:teams!match_confrontos_team_a_id_fkey(*),
  team_b:teams!match_confrontos_team_b_id_fkey(*),
  venue:venues(*)
`;

export async function fetchConfrontos(): Promise<Confronto[]> {
  return unwrap<Confronto[]>(
    await supabase
      .from("match_confrontos")
      .select(CONFRONTO_SELECT)
      .order("created_at", { ascending: false }),
  );
}

export async function createConfronto(input: {
  team_a_id: string;
  team_b_id: string;
  venue_id: string | null;
  scheduled_at: string;
}): Promise<void> {
  unwrap<unknown>(await supabase.from("match_confrontos").insert({ ...input, status: "pending" }));
}

/**
 * Cross validation: each captain reports the final score. Matching reports
 * confirm the result; irreducible divergence nullifies the confronto.
 */
export async function reportConfrontoScore(input: {
  confronto: Confronto;
  side: "A" | "B";
  score_a: number;
  score_b: number;
}): Promise<ConfrontoStatus> {
  const { confronto, side, score_a, score_b } = input;

  const reportedA = side === "A" ? score_a : confronto.reported_score_a_by_a;
  const reportedB = side === "A" ? score_b : confronto.reported_score_b_by_a;
  const reportedA2 = side === "B" ? score_a : confronto.reported_score_a_by_b;
  const reportedB2 = side === "B" ? score_b : confronto.reported_score_b_by_b;

  let status: ConfrontoStatus = "pending";
  const bothReported =
    reportedA !== null && reportedB !== null && reportedA2 !== null && reportedB2 !== null;
  if (bothReported) {
    status = reportedA === reportedA2 && reportedB === reportedB2 ? "confirmed" : "conflict_nullified";
  }

  unwrap<unknown>(
    await supabase
      .from("match_confrontos")
      .update({
        reported_score_a_by_a: reportedA,
        reported_score_b_by_a: reportedB,
        reported_score_a_by_b: reportedA2,
        reported_score_b_by_b: reportedB2,
        status,
        updated_at: new Date().toISOString(),
      })
      .eq("id", confronto.id),
  );

  return status;
}

/* --------------------------------- Ranking --------------------------------- */

export async function fetchRanking(filter?: {
  scope: "local" | "state" | "global";
  city?: string | null;
  state?: string | null;
}): Promise<RankingRow[]> {
  let query = supabase
    .from("player_rankings")
    .select("*")
    .order("avg_score", { ascending: false })
    .limit(100);

  if (filter?.scope === "local" && filter.city) query = query.ilike("city", filter.city);
  if (filter?.scope === "state" && filter.state) query = query.ilike("state", filter.state);

  return unwrap<RankingRow[]>(await query);
}

/* --------------------------------- Profiles -------------------------------- */

export async function fetchProfiles(): Promise<Profile[]> {
  return unwrap<Profile[]>(await supabase.from("profiles").select("*").order("nickname", { ascending: true }));
}

export async function updateProfile(id: string, values: Partial<Profile>): Promise<void> {
  unwrap<unknown>(
    await supabase
      .from("profiles")
      .update({ ...values, updated_at: new Date().toISOString() })
      .eq("id", id),
  );
}
export interface PlayerStats {
  avg_score: number;
  ratings_count: number;
  matches_played: number;
}

export async function fetchPlayerStats(userId: string): Promise<PlayerStats> {
  if (!userId) {
    return { avg_score: 0, ratings_count: 0, matches_played: 0 };
  }

  const [ratingsResult, participationsResult] = await Promise.all([
    supabase.from("ratings").select("score").eq("evaluated_user_id", userId),
    supabase.from("match_participants").select("match_id").eq("user_id", userId)
  ]);

  const ratings = (ratingsResult.data || []) as { score: number }[];
  const participations = (participationsResult.data || []) as { match_id: string }[];
  const total = ratings.reduce((sum, r) => sum + r.score, 0);

  return {
    avg_score: ratings.length > 0 ? total / ratings.length : 0,
    ratings_count: ratings.length,
    matches_played: new Set(participations.map((p) => p.match_id)).size,
  };
}

/**
 * Migrates existing auth users that don't have a profile yet.
 * Since we can't list auth.users directly from the client without admin keys,
 * this attempts to create a profile for the currently logged in user if it's missing.
 */
export async function ensureCurrentProfile(): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  console.log(`ensureCurrentProfile: Verificando perfil para ID ${user.id}...`);
  const { data: profile, error: fetchError } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();

  if (fetchError) {
    console.error("ensureCurrentProfile: Erro ao buscar perfil:", fetchError);
    // Se for um erro de permissão (42501) ou falta de RLS, pode ser a causa do carregamento infinito
    if (fetchError.code === '42501') {
      console.warn("ensureCurrentProfile: Falha de permissão RLS na tabela profiles.");
    }
    return;
  }

  if (!profile) {
    console.log("ensureCurrentProfile: Perfil não encontrado para usuário logado. Migrando dados do Auth para Profiles...");
    const meta = user.user_metadata || {};
    
    // Tentamos extrair o máximo de info dos metadados do auth.users
    const fullName = meta['full_name'] || meta['name'] || user.email?.split('@')[0] || "Boleiro";
    const nickname = meta['nickname'] || String(fullName).split(' ')[0];
    const avatarUrl = meta['avatar_url'] || `https://api.dicebear.com/10.x/dylan/svg?seed=${user.id}`;
    
    console.log(`ensureCurrentProfile: Criando perfil para ${user.id} (${nickname})...`);

    const { error: insertError } = await supabase.from("profiles").upsert({
      id: user.id,
      full_name: fullName,
      nickname: nickname,
      avatar_url: avatarUrl,
      city: meta['city'] || "",
      state: meta['state'] || "",
      updated_at: new Date().toISOString(),
    }, { onConflict: 'id' });

    if (insertError) {
      console.error("Erro ao migrar perfil de usuário existente:", insertError);
    } else {
      console.log("Perfil migrado com sucesso.");
    }
  }
}
