-- Execute uma vez no SQL Editor do projeto externo.
-- Integra Contras ao fluxo de Partidas e protege a súmula pelo juiz escolhido.

ALTER TABLE public.matches
  ADD COLUMN IF NOT EXISTS scorekeeper_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS max_players INTEGER NOT NULL DEFAULT 10 CHECK (max_players BETWEEN 2 AND 100);

ALTER TABLE public.match_confrontos
  ADD COLUMN IF NOT EXISTS match_id UUID REFERENCES public.matches(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS referee_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS match_confrontos_match_id_key
  ON public.match_confrontos(match_id) WHERE match_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS match_confrontos_referee_id_idx ON public.match_confrontos(referee_id);

CREATE TABLE IF NOT EXISTS public.match_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  team_side TEXT NOT NULL CHECK (team_side IN ('A', 'B')),
  event_type TEXT NOT NULL CHECK (event_type IN ('goal', 'yellow_card', 'red_card')),
  minute INTEGER CHECK (minute IS NULL OR minute BETWEEN 0 AND 180),
  created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.match_events TO anon, authenticated;
GRANT ALL ON public.match_events TO service_role;
ALTER TABLE public.match_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Match events are viewable by everyone" ON public.match_events;
CREATE POLICY "Match events are viewable by everyone"
ON public.match_events FOR SELECT USING (true);

CREATE OR REPLACE FUNCTION public.create_team_confronto(
  _team_a_id UUID,
  _team_b_id UUID,
  _venue_id UUID,
  _scheduled_at TIMESTAMPTZ,
  _referee_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_match_id UUID;
  new_confronto_id UUID;
  team_a_name TEXT;
  team_b_name TEXT;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sessão não encontrada'; END IF;
  IF _team_a_id = _team_b_id THEN RAISE EXCEPTION 'Escolha times diferentes'; END IF;
  IF NOT EXISTS (SELECT 1 FROM teams WHERE id = _team_a_id AND captain_id = auth.uid()) THEN
    RAISE EXCEPTION 'Somente o capitão pode marcar um Contra';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = _referee_id) THEN
    RAISE EXCEPTION 'Juiz não encontrado';
  END IF;
  IF _referee_id = auth.uid() OR EXISTS (
    SELECT 1 FROM team_members
    WHERE user_id = _referee_id AND team_id IN (_team_a_id, _team_b_id) AND status = 'active'
  ) THEN RAISE EXCEPTION 'O juiz deve ser um usuário fora dos dois times'; END IF;
  IF NOT EXISTS (SELECT 1 FROM venues WHERE id = _venue_id) THEN
    RAISE EXCEPTION 'Quadra não encontrada';
  END IF;

  SELECT name INTO team_a_name FROM teams WHERE id = _team_a_id;
  SELECT name INTO team_b_name FROM teams WHERE id = _team_b_id;

  INSERT INTO matches (
    venue_id, created_by, scorekeeper_id, name, match_type, status,
    score_team_a, score_team_b, scheduled_at, finished_at, max_players
  ) VALUES (
    _venue_id, auth.uid(), _referee_id, team_a_name || ' x ' || team_b_name,
    'campeonato', 'active', 0, 0, _scheduled_at, _scheduled_at + INTERVAL '60 minutes',
    GREATEST(2, (SELECT count(*) FROM team_members WHERE team_id IN (_team_a_id, _team_b_id) AND status = 'active'))
  ) RETURNING id INTO new_match_id;

  INSERT INTO match_participants (match_id, user_id, role, team_side, checked_in_gps)
  SELECT new_match_id, tm.user_id, 'player',
         CASE WHEN tm.team_id = _team_a_id THEN 'A' ELSE 'B' END, false
  FROM team_members tm
  WHERE tm.team_id IN (_team_a_id, _team_b_id) AND tm.status = 'active'
  ON CONFLICT DO NOTHING;

  INSERT INTO match_confrontos (
    match_id, referee_id, team_a_id, team_b_id, venue_id, scheduled_at, status
  ) VALUES (
    new_match_id, _referee_id, _team_a_id, _team_b_id, _venue_id, _scheduled_at, 'pending'
  ) RETURNING id INTO new_confronto_id;

  RETURN new_confronto_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.add_match_event(
  _match_id UUID,
  _player_id UUID,
  _team_side TEXT,
  _event_type TEXT,
  _minute INTEGER DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE new_event_id UUID;
BEGIN
  IF _team_side NOT IN ('A', 'B') OR _event_type NOT IN ('goal', 'yellow_card', 'red_card') THEN
    RAISE EXCEPTION 'Evento inválido';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM matches WHERE id = _match_id AND scorekeeper_id = auth.uid() AND status = 'active'
  ) THEN RAISE EXCEPTION 'Somente o juiz pode registrar eventos'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM match_participants
    WHERE match_id = _match_id AND user_id = _player_id AND role = 'player' AND team_side = _team_side
  ) THEN RAISE EXCEPTION 'O jogador não pertence a este time na súmula'; END IF;

  INSERT INTO match_events (match_id, player_id, team_side, event_type, minute, created_by)
  VALUES (_match_id, _player_id, _team_side, _event_type, _minute, auth.uid())
  RETURNING id INTO new_event_id;

  IF _event_type = 'goal' THEN
    UPDATE matches SET
      score_team_a = score_team_a + CASE WHEN _team_side = 'A' THEN 1 ELSE 0 END,
      score_team_b = score_team_b + CASE WHEN _team_side = 'B' THEN 1 ELSE 0 END,
      updated_at = now()
    WHERE id = _match_id;
  END IF;
  RETURN new_event_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.remove_match_event(_event_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE event_row public.match_events%ROWTYPE;
BEGIN
  SELECT e.* INTO event_row FROM match_events e
  JOIN matches m ON m.id = e.match_id
  WHERE e.id = _event_id AND m.scorekeeper_id = auth.uid() AND m.status = 'active';
  IF NOT FOUND THEN RAISE EXCEPTION 'Somente o juiz pode remover este evento'; END IF;
  DELETE FROM match_events WHERE id = _event_id;
  IF event_row.event_type = 'goal' THEN
    UPDATE matches SET
      score_team_a = GREATEST(0, score_team_a - CASE WHEN event_row.team_side = 'A' THEN 1 ELSE 0 END),
      score_team_b = GREATEST(0, score_team_b - CASE WHEN event_row.team_side = 'B' THEN 1 ELSE 0 END),
      updated_at = now()
    WHERE id = event_row.match_id;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.finish_refereed_match(_match_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE matches SET status = 'finished', finished_at = now(), updated_at = now()
  WHERE id = _match_id AND scorekeeper_id = auth.uid() AND status = 'active';
  IF NOT FOUND THEN RAISE EXCEPTION 'Somente o juiz pode encerrar esta partida'; END IF;
  UPDATE match_confrontos SET status = 'confirmed', updated_at = now()
  WHERE match_id = _match_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_team_confronto(UUID, UUID, UUID, TIMESTAMPTZ, UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.add_match_event(UUID, UUID, TEXT, TEXT, INTEGER) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.remove_match_event(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.finish_refereed_match(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_team_confronto(UUID, UUID, UUID, TIMESTAMPTZ, UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.add_match_event(UUID, UUID, TEXT, TEXT, INTEGER) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.remove_match_event(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.finish_refereed_match(UUID) TO authenticated, service_role;