-- Execute uma vez no SQL Editor do Supabase.
-- Juiz do Contra: pode ser qualquer jogador dos dois times OU um convidado via link
-- (sem conta). Cada Contra recebe um número de jogo único e a súmula aceita
-- gols (com autor), cartões e substituições.

-- Habilita pgcrypto (necessária para gen_random_bytes).
CREATE EXTENSION IF NOT EXISTS pgcrypto;

/* ------------------------------ Colunas novas ------------------------------ */

ALTER TABLE public.match_confrontos
  ADD COLUMN IF NOT EXISTS referee_token TEXT,
  ADD COLUMN IF NOT EXISTS referee_name TEXT,
  ADD COLUMN IF NOT EXISTS match_number INTEGER;

CREATE SEQUENCE IF NOT EXISTS public.confronto_number_seq AS INTEGER START 1;

DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT id FROM public.match_confrontos WHERE match_number IS NULL ORDER BY created_at LOOP
    UPDATE public.match_confrontos SET match_number = nextval('public.confronto_number_seq') WHERE id = r.id;
  END LOOP;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS match_confrontos_referee_token_key
  ON public.match_confrontos(referee_token) WHERE referee_token IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS match_confrontos_match_number_key
  ON public.match_confrontos(match_number) WHERE match_number IS NOT NULL;

ALTER TABLE public.match_events
  ADD COLUMN IF NOT EXISTS related_player_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.match_events ALTER COLUMN created_by DROP NOT NULL;
ALTER TABLE public.match_events DROP CONSTRAINT IF EXISTS match_events_event_type_check;
ALTER TABLE public.match_events
  ADD CONSTRAINT match_events_event_type_check
  CHECK (event_type IN ('goal', 'yellow_card', 'red_card', 'substitution'));

/* ----------------------------- Criar o Contra ------------------------------ */

DROP FUNCTION IF EXISTS public.create_team_confronto(UUID, UUID, UUID, TIMESTAMPTZ, UUID);

CREATE OR REPLACE FUNCTION public.create_team_confronto(
  _team_a_id UUID,
  _team_b_id UUID,
  _venue_id UUID,
  _scheduled_at TIMESTAMPTZ,
  _referee_id UUID DEFAULT NULL,
  _invite_link BOOLEAN DEFAULT FALSE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_match_id UUID;
  new_confronto_id UUID;
  team_a_name TEXT;
  team_b_name TEXT;
  new_number INTEGER;
  new_token TEXT;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sessão não encontrada'; END IF;
  IF _team_a_id = _team_b_id THEN RAISE EXCEPTION 'Escolha times diferentes'; END IF;
  IF NOT EXISTS (SELECT 1 FROM teams WHERE id = _team_a_id AND captain_id = auth.uid()) THEN
    RAISE EXCEPTION 'Somente o capitão pode marcar um Contra';
  END IF;
  IF _referee_id IS NULL AND NOT _invite_link THEN
    RAISE EXCEPTION 'Escolha um juiz ou gere um link de convite';
  END IF;
  IF _referee_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM profiles WHERE id = _referee_id) THEN
    RAISE EXCEPTION 'Juiz não encontrado';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM venues WHERE id = _venue_id) THEN
    RAISE EXCEPTION 'Quadra não encontrada';
  END IF;

  SELECT name INTO team_a_name FROM teams WHERE id = _team_a_id;
  SELECT name INTO team_b_name FROM teams WHERE id = _team_b_id;
  new_number := nextval('public.confronto_number_seq');
  IF _referee_id IS NULL OR _invite_link THEN
    new_token := encode(gen_random_bytes(16), 'hex');
  END IF;

  INSERT INTO matches (
    venue_id, created_by, scorekeeper_id, name, match_type, status,
    score_team_a, score_team_b, scheduled_at, finished_at, max_players
  ) VALUES (
    _venue_id, auth.uid(), _referee_id,
    'Jogo #' || new_number || ' · ' || team_a_name || ' x ' || team_b_name,
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
    match_id, referee_id, referee_token, match_number,
    team_a_id, team_b_id, venue_id, scheduled_at, status
  ) VALUES (
    new_match_id, _referee_id, new_token, new_number,
    _team_a_id, _team_b_id, _venue_id, _scheduled_at, 'pending'
  ) RETURNING id INTO new_confronto_id;

  RETURN jsonb_build_object(
    'id', new_confronto_id,
    'match_id', new_match_id,
    'match_number', new_number,
    'referee_token', new_token
  );
END;
$$;

/* ---------------------- Gerar/renovar link do juiz -------------------------- */

CREATE OR REPLACE FUNCTION public.confronto_referee_link(_confronto_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE tok TEXT;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sessão não encontrada'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM match_confrontos c
    JOIN teams t ON t.id IN (c.team_a_id, c.team_b_id)
    WHERE c.id = _confronto_id AND t.captain_id = auth.uid()
  ) THEN RAISE EXCEPTION 'Somente os capitães podem gerar o link do juiz'; END IF;

  SELECT referee_token INTO tok FROM match_confrontos WHERE id = _confronto_id;
  IF tok IS NULL THEN
    tok := encode(gen_random_bytes(16), 'hex');
    UPDATE match_confrontos SET referee_token = tok, updated_at = now() WHERE id = _confronto_id;
  END IF;
  RETURN tok;
END;
$$;

/* -------------------------- Página pública do juiz -------------------------- */

CREATE OR REPLACE FUNCTION public.referee_board(_token TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE c public.match_confrontos%ROWTYPE;
BEGIN
  SELECT * INTO c FROM match_confrontos WHERE referee_token = _token;
  IF NOT FOUND THEN RAISE EXCEPTION 'Link inválido ou expirado'; END IF;

  RETURN jsonb_build_object(
    'confronto', jsonb_build_object(
      'id', c.id,
      'match_id', c.match_id,
      'match_number', c.match_number,
      'referee_name', c.referee_name,
      'status', c.status,
      'scheduled_at', c.scheduled_at,
      'team_a', (SELECT jsonb_build_object('id', t.id, 'name', t.name, 'shield_url', t.shield_url) FROM teams t WHERE t.id = c.team_a_id),
      'team_b', (SELECT jsonb_build_object('id', t.id, 'name', t.name, 'shield_url', t.shield_url) FROM teams t WHERE t.id = c.team_b_id),
      'venue', (SELECT jsonb_build_object('id', v.id, 'name', v.name, 'address', v.address) FROM venues v WHERE v.id = c.venue_id)
    ),
    'match', (SELECT jsonb_build_object('id', m.id, 'status', m.status, 'score_team_a', m.score_team_a, 'score_team_b', m.score_team_b, 'name', m.name)
              FROM matches m WHERE m.id = c.match_id),
    'players', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', p.id, 'name', COALESCE(NULLIF(p.nickname, ''), p.full_name), 'photo_url', p.photo_url, 'team_side', mp.team_side
      ) ORDER BY mp.team_side, COALESCE(NULLIF(p.nickname, ''), p.full_name))
      FROM match_participants mp JOIN profiles p ON p.id = mp.user_id
      WHERE mp.match_id = c.match_id AND mp.role = 'player'
    ), '[]'::jsonb),
    'events', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', e.id, 'event_type', e.event_type, 'team_side', e.team_side, 'minute', e.minute,
        'player_name', COALESCE(NULLIF(p.nickname, ''), p.full_name),
        'related_player_name', (SELECT COALESCE(NULLIF(p2.nickname, ''), p2.full_name) FROM profiles p2 WHERE p2.id = e.related_player_id)
      ) ORDER BY e.created_at)
      FROM match_events e JOIN profiles p ON p.id = e.player_id
      WHERE e.match_id = c.match_id
    ), '[]'::jsonb)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.referee_set_name(_token TEXT, _name TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF length(coalesce(trim(_name), '')) < 2 THEN RAISE EXCEPTION 'Informe seu nome'; END IF;
  UPDATE match_confrontos SET referee_name = trim(_name), updated_at = now()
  WHERE referee_token = _token;
  IF NOT FOUND THEN RAISE EXCEPTION 'Link inválido ou expirado'; END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.referee_add_event(
  _token TEXT,
  _player_id UUID,
  _team_side TEXT,
  _event_type TEXT,
  _minute INTEGER DEFAULT NULL,
  _related_player_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  c public.match_confrontos%ROWTYPE;
  new_event_id UUID;
BEGIN
  SELECT * INTO c FROM match_confrontos WHERE referee_token = _token;
  IF NOT FOUND THEN RAISE EXCEPTION 'Link inválido ou expirado'; END IF;
  IF c.referee_name IS NULL THEN RAISE EXCEPTION 'Informe o nome do juiz antes de iniciar'; END IF;
  IF c.status <> 'pending' THEN RAISE EXCEPTION 'Este jogo já foi encerrado'; END IF;
  IF _team_side NOT IN ('A', 'B') OR _event_type NOT IN ('goal', 'yellow_card', 'red_card', 'substitution') THEN
    RAISE EXCEPTION 'Evento inválido';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM match_participants
    WHERE match_id = c.match_id AND user_id = _player_id AND role = 'player' AND team_side = _team_side
  ) THEN RAISE EXCEPTION 'O jogador não pertence a este time na súmula'; END IF;

  INSERT INTO match_events (match_id, player_id, team_side, event_type, minute, related_player_id, created_by)
  VALUES (c.match_id, _player_id, _team_side, _event_type, _minute, _related_player_id, NULL)
  RETURNING id INTO new_event_id;

  IF _event_type = 'goal' THEN
    UPDATE matches SET
      score_team_a = score_team_a + CASE WHEN _team_side = 'A' THEN 1 ELSE 0 END,
      score_team_b = score_team_b + CASE WHEN _team_side = 'B' THEN 1 ELSE 0 END,
      updated_at = now()
    WHERE id = c.match_id;
  END IF;
  RETURN new_event_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.referee_remove_event(_token TEXT, _event_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  c public.match_confrontos%ROWTYPE;
  e public.match_events%ROWTYPE;
BEGIN
  SELECT * INTO c FROM match_confrontos WHERE referee_token = _token;
  IF NOT FOUND THEN RAISE EXCEPTION 'Link inválido ou expirado'; END IF;
  SELECT * INTO e FROM match_events WHERE id = _event_id AND match_id = c.match_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Evento não encontrado'; END IF;

  DELETE FROM match_events WHERE id = _event_id;
  IF e.event_type = 'goal' THEN
    UPDATE matches SET
      score_team_a = GREATEST(0, score_team_a - CASE WHEN e.team_side = 'A' THEN 1 ELSE 0 END),
      score_team_b = GREATEST(0, score_team_b - CASE WHEN e.team_side = 'B' THEN 1 ELSE 0 END),
      updated_at = now()
    WHERE id = c.match_id;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.referee_finish(_token TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE c public.match_confrontos%ROWTYPE;
BEGIN
  SELECT * INTO c FROM match_confrontos WHERE referee_token = _token;
  IF NOT FOUND THEN RAISE EXCEPTION 'Link inválido ou expirado'; END IF;
  UPDATE matches SET status = 'finished', finished_at = now(), updated_at = now() WHERE id = c.match_id;
  UPDATE match_confrontos SET status = 'confirmed', updated_at = now() WHERE id = c.id;
END;
$$;

/* -------- Juiz logado: aceita substituição e jogador dos dois times --------- */

CREATE OR REPLACE FUNCTION public.add_match_event(
  _match_id UUID,
  _player_id UUID,
  _team_side TEXT,
  _event_type TEXT,
  _minute INTEGER DEFAULT NULL,
  _related_player_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE new_event_id UUID;
BEGIN
  IF _team_side NOT IN ('A', 'B') OR _event_type NOT IN ('goal', 'yellow_card', 'red_card', 'substitution') THEN
    RAISE EXCEPTION 'Evento inválido';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM matches WHERE id = _match_id AND scorekeeper_id = auth.uid() AND status = 'active'
  ) THEN RAISE EXCEPTION 'Somente o juiz pode registrar eventos'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM match_participants
    WHERE match_id = _match_id AND user_id = _player_id AND role = 'player' AND team_side = _team_side
  ) THEN RAISE EXCEPTION 'O jogador não pertence a este time na súmula'; END IF;

  INSERT INTO match_events (match_id, player_id, team_side, event_type, minute, related_player_id, created_by)
  VALUES (_match_id, _player_id, _team_side, _event_type, _minute, _related_player_id, auth.uid())
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

/* --------------------------------- Permissões -------------------------------- */

REVOKE ALL ON FUNCTION public.create_team_confronto(UUID, UUID, UUID, TIMESTAMPTZ, UUID, BOOLEAN) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_team_confronto(UUID, UUID, UUID, TIMESTAMPTZ, UUID, BOOLEAN) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.confronto_referee_link(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.confronto_referee_link(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.referee_board(TEXT) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.referee_set_name(TEXT, TEXT) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.referee_add_event(TEXT, UUID, TEXT, TEXT, INTEGER, UUID) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.referee_remove_event(TEXT, UUID) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.referee_finish(TEXT) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.add_match_event(UUID, UUID, TEXT, TEXT, INTEGER, UUID) TO authenticated, service_role;
