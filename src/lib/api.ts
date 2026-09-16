import { supabase } from "./supabase";
import { effectiveStatus, isExpired, isFull, maxPlayers, playerCount } from "./match-utils";
import type {
  Confronto,
  ConfrontoStatus,
  MatchEvent,
  MatchParticipant,
  MatchEventType,
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
  city?: string | null;
  state?: string | null;
  latitude: number;
  longitude: number;
}): Promise<Venue> {
  return unwrap<Venue>(await supabase.from("venues").insert(input).select("*").single());
}

/* --------------------------------- Matches --------------------------------- */

export async function fetchMatches(status?: "active" | "finished", filter?: { city?: string | null | undefined, state?: string | null | undefined }): Promise<MatchWithRelations[]> {
  let query = supabase.from("matches").select(MATCH_SELECT).order("created_at", { ascending: false });
  // Para "encerradas" também trazemos as ativas cujo tempo já acabou: elas são
  // normalizadas para `finished` abaixo e aparecem no histórico na hora.
  if (status === "finished") query = query.in("status", ["active", "finished"]);
  else if (status) query = query.eq("status", status);

  
  const raw = unwrap<MatchWithRelations[]>(await query);

  // Encerramento automático: partidas cujo horário de término já passou.
  const expired = raw.filter((m) => isExpired(m));
  if (expired.length > 0) {
    await Promise.allSettled(expired.map((m) => autoFinishIfExpired(m)));
  }
  const normalized = raw.map((m) =>
    isExpired(m) ? { ...m, status: "finished" as const } : m,
  );
  const results = status ? normalized.filter((m) => m.status === status) : normalized;

  // Filtragem e ordenação por Bairro/Estado
  if (filter?.state) {
    const state = filter.state.toUpperCase();
    const city = filter.city?.toLowerCase();

    return results.filter(m => m.venue?.state?.toUpperCase() === state)
      .sort((a, b) => {
        const cityA = a.venue?.city?.toLowerCase();
        const cityB = b.venue?.city?.toLowerCase();

        // Se ambos são da mesma cidade do usuário, mantém ordem original ou por distância se disponível
        if (cityA === city && cityB !== city) return -1;
        if (cityA !== city && cityB === city) return 1;
        return 0;
      });
  }

  return results;
}

export async function fetchMatch(id: string): Promise<MatchWithRelations | null> {
  const match = unwrap<MatchWithRelations | null>(
    await supabase.from("matches").select(MATCH_SELECT).eq("id", id).maybeSingle(),
  );
  if (match && isExpired(match)) {
    await autoFinishIfExpired(match);
    return { ...match, status: "finished" as const };
  }
  return match;
}

function isMissingColumn(error: { message?: string } | null, column: string): boolean {
  return Boolean(error?.message && error.message.includes(column));
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
  max_players?: number | null;
  creator_is_scorekeeper: boolean;
}): Promise<string> {
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!uuidPattern.test(input.venue_id)) {
    throw new Error("Selecione uma quadra válida no mapa.");
  }
  if (!uuidPattern.test(input.created_by)) {
    throw new Error("Sua sessão não carregou corretamente. Entre novamente e tente criar a partida.");
  }

  const { data: { user } } = await supabase.auth.getUser();
  const createdBy = user?.id || input.created_by;

  if (!uuidPattern.test(createdBy)) {
    throw new Error("Sua sessão não carregou corretamente. Entre novamente e tente criar a partida.");
  }

  const startAt = input.scheduled_at || new Date().toISOString();
  const endAt =
    input.finished_at || new Date(new Date(startAt).getTime() + 60 * 60_000).toISOString();

  const basePayload = {
    venue_id: input.venue_id,
    created_by: createdBy,
    name: input.name || null,
    match_type: input.match_type,
    status: "active",
    scheduled_at: startAt,
    finished_at: endAt,
  };

  let matchResponse = await supabase
    .from("matches")
    .insert({
      ...basePayload,
      max_players: input.max_players ?? 10,
      scorekeeper_id: input.creator_is_scorekeeper ? createdBy : null,
    })
    .select("id")
    .single();

  // Compatibilidade temporária enquanto o schema externo ainda não recebeu
  // max_players e/ou scorekeeper_id. Cada tentativa remove somente as colunas
  // ausentes, evitando bloquear a criação da partida pelo cache do PostgREST.
  if (matchResponse.error && (
    isMissingColumn(matchResponse.error, "max_players") ||
    isMissingColumn(matchResponse.error, "scorekeeper_id")
  )) {
    const compatiblePayload: typeof basePayload & {
      max_players?: number;
      scorekeeper_id?: string | null;
    } = { ...basePayload };

    if (!isMissingColumn(matchResponse.error, "max_players")) {
      compatiblePayload.max_players = input.max_players ?? 10;
    }
    if (!isMissingColumn(matchResponse.error, "scorekeeper_id")) {
      compatiblePayload.scorekeeper_id = input.creator_is_scorekeeper ? createdBy : null;
    }

    matchResponse = await supabase.from("matches").insert(compatiblePayload).select("id").single();

    if (matchResponse.error && (
      isMissingColumn(matchResponse.error, "max_players") ||
      isMissingColumn(matchResponse.error, "scorekeeper_id")
    )) {
      matchResponse = await supabase.from("matches").insert(basePayload).select("id").single();
    }
  }

  const match = unwrap<{ id: string }>(matchResponse);

  unwrap<unknown>(
    await supabase.from("match_participants").insert({
      match_id: match.id,
      user_id: createdBy,
      role: input.role,
      team_side: input.role === "player" ? input.team_side : null,
      checked_in_gps: input.checked_in_gps,
    }),
  );

  return match.id;
}

export async function joinMatch(input: {
  match_id: string | null | undefined;
  user_id: string | null | undefined;
  role: ParticipantRole;
  team_side: TeamSide | null;
  checked_in_gps: boolean;
}): Promise<MatchParticipant> {
  if (!input.match_id) {
    throw new Error("Partida não carregada. Feche e abra a partida novamente.");
  }
  let userId = input.user_id;
  if (!userId) {
    // Fallback: pega a sessão direto do Supabase quando o contexto ainda não hidratou.
    const { data } = await supabase.auth.getUser();
    userId = data.user?.id ?? null;
  }
  if (!userId) {
    throw new Error("Sua sessão não carregou. Entre novamente para participar.");
  }

  // Valida a partida no servidor antes de inserir o participante.
  const match = await fetchMatch(input.match_id);
  if (!match) throw new Error("Partida não encontrada ou removida.");

  await autoFinishIfExpired(match);

  if (effectiveStatus(match) !== "active") {
    throw new Error("Esta partida já foi encerrada.");
  }

  if (match.participants.some((p) => p.user_id === userId)) {
    throw new Error("Você já está na súmula desta partida.");
  }

  if (input.role === "player" && isFull(match)) {
    throw new Error(`Partida cheia (${playerCount(match)}/${maxPlayers(match)}).`);
  }

  return unwrap<MatchParticipant>(
    await supabase
      .from("match_participants")
      .insert({
        match_id: match.id,
        user_id: userId,
        role: input.role,
        team_side: input.role === "player" ? input.team_side : null,
        checked_in_gps: input.checked_in_gps,
      })
      .select("*")
      .single(),
  );
}

/**
 * Encerramento automático: quando `finished_at` (início + duração) já passou,
 * a partida é marcada como `finished` no banco na próxima leitura.
 */
export async function autoFinishIfExpired(match: MatchWithRelations): Promise<void> {
  if (!isExpired(match)) return;
  await supabase.rpc("auto_finish_match", { _match_id: match.id });
}

/** Placar salvo no banco (colunas score_team_a / score_team_b da partida). */
export async function updateMatchScore(input: {
  match_id: string;
  score_team_a: number;
  score_team_b: number;
}): Promise<void> {
  unwrap<unknown>(await supabase.rpc("update_match_score", {
    _match_id: input.match_id,
    _score_team_a: Math.max(0, Math.trunc(input.score_team_a)),
    _score_team_b: Math.max(0, Math.trunc(input.score_team_b)),
  }));
}

export async function assignMatchScorekeeper(input: {
  match_id: string;
  scorekeeper_id: string | null;
}): Promise<void> {
  unwrap<unknown>(await supabase.rpc("assign_match_scorekeeper", {
    _match_id: input.match_id,
    _scorekeeper_id: input.scorekeeper_id,
  }));
}

export async function leaveMatch(participantId: string): Promise<void> {
  unwrap<unknown>(await supabase.from("match_participants").delete().eq("id", participantId));
}

export async function finishMatch(input: {
  match_id: string;
}): Promise<void> {
  unwrap<unknown>(await supabase.rpc("finish_match", { _match_id: input.match_id }));
}

export async function cancelMatch(matchId: string): Promise<void> {
  unwrap<unknown>(await supabase.rpc("cancel_match", { _match_id: matchId }));
}

export async function addMatchEvent(input: {
  match_id: string;
  player_id: string;
  team_side: TeamSide;
  event_type: MatchEventType;
  minute?: number | null;
}): Promise<string> {
  return unwrap<string>(await supabase.rpc("add_match_event", {
    _match_id: input.match_id,
    _player_id: input.player_id,
    _team_side: input.team_side,
    _event_type: input.event_type,
    _minute: input.minute ?? null,
  }));
}

export async function removeMatchEvent(eventId: string): Promise<void> {
  unwrap<unknown>(await supabase.rpc("remove_match_event", { _event_id: eventId }));
}

export async function fetchMatchEvents(matchId: string): Promise<MatchEvent[]> {
  return unwrap<MatchEvent[]>(
    await supabase
      .from("match_events")
      .select("*, player:profiles!match_events_player_id_fkey(*)")
      .eq("match_id", matchId)
      .order("minute", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: true }),
  );
}

export async function finishRefereedMatch(matchId: string): Promise<void> {
  unwrap<unknown>(await supabase.rpc("finish_refereed_match", { _match_id: matchId }));
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
  const { data: { user } } = await supabase.auth.getUser();
  const captainId = user?.id || input.captain_id;

  if (!captainId) {
    throw new Error("Sessão não carregada. Tente fazer login novamente.");
  }

  const teamResponse = await supabase.from("teams").insert({
    ...input,
    captain_id: captainId
  }).select("*").single();
  
  const team = unwrap<Team>(teamResponse);
  
  const memberResponse = await supabase
    .from("team_members")
    .insert({ 
      team_id: team.id, 
      user_id: captainId, 
      status: "active" 
    });
  
  try {
    unwrap<unknown>(memberResponse);
  } catch (err) {
    console.error("Erro ao adicionar capitão como membro do time:", err);
  }
  
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
  unwrap<unknown>(
    await supabase.rpc("manage_team_request", {
      _member_id: memberId,
      _action: status === "active" ? "approve" : status,
    }),
  );
}

export async function removeMember(memberId: string): Promise<void> {
  unwrap<unknown>(
    await supabase.rpc("manage_team_request", {
      _member_id: memberId,
      _action: "reject",
    }),
  );
}

export async function deleteTeam(teamId: string): Promise<void> {
  unwrap<unknown>(await supabase.rpc("delete_team", { _team_id: teamId }));
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
  venue:venues(*),
  referee:profiles!match_confrontos_referee_id_fkey(*),
  match:matches(*)
`;

const LEGACY_CONFRONTO_SELECT = `
  *,
  team_a:teams!match_confrontos_team_a_id_fkey(*),
  team_b:teams!match_confrontos_team_b_id_fkey(*),
  venue:venues(*)
`;

export async function fetchConfrontos(): Promise<Confronto[]> {
  const response = await supabase
    .from("match_confrontos")
    .select(CONFRONTO_SELECT)
    .order("created_at", { ascending: false });

  if (!response.error) return response.data as Confronto[];
  if (!isMissingColumn(response.error, "referee_id") && !isMissingColumn(response.error, "match_id")) {
    throw new Error(response.error.message);
  }

  return unwrap<Confronto[]>(
    await supabase
      .from("match_confrontos")
      .select(LEGACY_CONFRONTO_SELECT)
      .order("created_at", { ascending: false }),
  );
}

export async function createConfronto(input: {
  team_a_id: string;
  team_b_id: string;
  venue_id: string;
  scheduled_at: string;
  referee_id: string;
}): Promise<string> {
  return unwrap<string>(await supabase.rpc("create_team_confronto", {
    _team_a_id: input.team_a_id,
    _team_b_id: input.team_b_id,
    _venue_id: input.venue_id,
    _scheduled_at: input.scheduled_at,
    _referee_id: input.referee_id,
  }));
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

export interface PlayerPublicStats extends PlayerStats {
  goals: number;
  championships: number;
  yellow_cards: number;
  red_cards: number;
  teams: Array<{ id: string; name: string }>;
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

export async function fetchPlayerPublicStats(userId: string): Promise<PlayerPublicStats> {
  if (!userId) {
    return { avg_score: 0, ratings_count: 0, matches_played: 0, goals: 0, championships: 0, yellow_cards: 0, red_cards: 0, teams: [] };
  }

  const [ratingsResult, participationsResult, eventsResult, teamsResult] = await Promise.all([
    supabase.from("ratings").select("score").eq("evaluated_user_id", userId),
    supabase
      .from("match_participants")
      .select("match_id, match:matches(match_type)")
      .eq("user_id", userId)
      .eq("role", "player"),
    supabase.from("match_events").select("event_type").eq("player_id", userId),
    supabase
      .from("team_members")
      .select("team:teams(id, name)")
      .eq("user_id", userId)
      .eq("status", "active"),
  ]);

  if (ratingsResult.error) throw new Error(ratingsResult.error.message);
  if (participationsResult.error) throw new Error(participationsResult.error.message);
  if (eventsResult.error) throw new Error(eventsResult.error.message);
  if (teamsResult.error) throw new Error(teamsResult.error.message);

  const ratings = (ratingsResult.data ?? []) as { score: number }[];
  const participations = (participationsResult.data ?? []) as Array<{
    match_id: string;
    match: { match_type: string } | { match_type: string }[] | null;
  }>;
  const totalScore = ratings.reduce((sum, rating) => sum + rating.score, 0);
  const events = (eventsResult.data ?? []) as { event_type: MatchEventType }[];
  const teamMemberships = (teamsResult.data ?? []) as Array<{
    team: { id: string; name: string } | { id: string; name: string }[] | null;
  }>;
  const championshipMatches = new Set(
    participations
      .filter((participation) => {
        const match = Array.isArray(participation.match) ? participation.match[0] : participation.match;
        return match?.match_type === "campeonato";
      })
      .map((participation) => participation.match_id),
  );

  return {
    avg_score: ratings.length ? totalScore / ratings.length : 0,
    ratings_count: ratings.length,
    matches_played: new Set(participations.map((participation) => participation.match_id)).size,
    goals: events.filter((event) => event.event_type === "goal").length,
    championships: championshipMatches.size,
    yellow_cards: events.filter((event) => event.event_type === "yellow_card").length,
    red_cards: events.filter((event) => event.event_type === "red_card").length,
    teams: teamMemberships.flatMap((membership) => {
      if (!membership.team) return [];
      return Array.isArray(membership.team) ? membership.team : [membership.team];
    }),
  };
}

/**
 * Migrates existing auth users that don't have a profile yet.
 * Since we can't list auth.users directly from the client without admin keys,
 * this attempts to create a profile for the currently logged in user if it's missing.
 */
export async function ensureCurrentProfile(): Promise<Profile | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  console.log(`ensureCurrentProfile: Verificando perfil para ID ${user.id}...`);
  const { data: profile, error: fetchError } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  if (fetchError) {
    console.error("ensureCurrentProfile: Erro ao buscar perfil:", fetchError);
    return null;
  }

  if (profile) return profile as Profile;

  console.log("ensureCurrentProfile: Perfil não encontrado. Criando...");
  const meta = user.user_metadata || {};
  const fullName = meta['full_name'] || meta['name'] || user.email?.split('@')[0] || "Boleiro";
  const nickname = meta['nickname'] || String(fullName).split(' ')[0];
  const avatarUrl = meta['avatar_url'] || `https://api.dicebear.com/10.x/dylan/svg?seed=${user.id}`;
  
  const newProfile = {
    id: user.id,
    full_name: fullName,
    nickname: nickname,
    avatar_url: avatarUrl,
    city: meta['city'] || "",
    state: meta['state'] || "",
    updated_at: new Date().toISOString(),
  };

  const { data: inserted, error: insertError } = await supabase
    .from("profiles")
    .upsert(newProfile, { onConflict: 'id' })
    .select("*")
    .single();

  if (insertError) {
    console.error("Erro ao migrar perfil de usuário existente:", insertError);
    return null;
  }
  
  return inserted as Profile;
}
