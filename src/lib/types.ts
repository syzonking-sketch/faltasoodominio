export type MatchStatus = "active" | "finished" | "cancelled";
export type MatchType = "pelada" | "campeonato";
export type ParticipantRole = "player" | "spectator";
export type TeamSide = "A" | "B";
export type MemberStatus = "invited" | "pending_approval" | "active";
export type ConfrontoStatus = "pending" | "confirmed" | "conflict_nullified";

export interface Profile {
  id: string;
  full_name: string;
  nickname: string;
  avatar_url: string | null;
  city: string | null;
  state: string | null;
  created_at: string;
  updated_at: string;
}

export interface Venue {
  id: string;
  name: string;
  address: string | null;
  city: string | null;
  state: string | null;
  latitude: number;
  longitude: number;
  description: string | null;
  photo_url: string | null;
  created_at: string;
}

export interface Match {
  id: string;
  venue_id: string;
  created_by: string;
  status: MatchStatus;
  match_type: MatchType;
  score_team_a: number;
  score_team_b: number;
  created_at: string;
  updated_at: string;
}

export interface MatchParticipant {
  id: string;
  match_id: string;
  user_id: string;
  role: ParticipantRole;
  team_side: TeamSide | null;
  checked_in_gps: boolean;
  created_at: string;
  profile?: Profile | null;
}

export interface MatchWithRelations extends Match {
  venue: Venue | null;
  creator: Profile | null;
  participants: MatchParticipant[];
}

export interface Rating {
  id: string;
  match_id: string;
  evaluator_id: string;
  evaluated_user_id: string;
  score: number;
  is_opponent: boolean;
  created_at: string;
}

export interface Team {
  id: string;
  name: string;
  shield_url: string | null;
  captain_id: string;
  city: string | null;
  state: string | null;
  created_at: string;
  captain?: Profile | null;
  members?: TeamMember[];
}

export interface TeamMember {
  id: string;
  team_id: string;
  user_id: string;
  status: MemberStatus;
  created_at: string;
  profile?: Profile | null;
  team?: Team | null;
}

export interface Confronto {
  id: string;
  venue_id: string | null;
  team_a_id: string;
  team_b_id: string;
  scheduled_at: string | null;
  reported_score_a_by_a: number | null;
  reported_score_b_by_a: number | null;
  reported_score_a_by_b: number | null;
  reported_score_b_by_b: number | null;
  status: ConfrontoStatus;
  created_at: string;
  updated_at: string;
  team_a?: Team | null;
  team_b?: Team | null;
  venue?: Venue | null;
}

export interface RankingRow {
  user_id: string;
  full_name: string;
  nickname: string;
  avatar_url: string | null;
  city: string | null;
  state: string | null;
  avg_score: number;
  ratings_count: number;
  matches_played: number;
}