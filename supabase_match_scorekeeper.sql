-- Execute este arquivo uma vez no SQL Editor do projeto Supabase.
-- Ele é idempotente e mantém partidas antigas sem responsável definido.

ALTER TABLE public.matches
  ADD COLUMN IF NOT EXISTS scorekeeper_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS matches_scorekeeper_id_idx ON public.matches(scorekeeper_id);

ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;

-- Remove permissões diretas de UPDATE. Todas as alterações sensíveis abaixo
-- passam por funções que validam usuário, participação, status e campos.
REVOKE UPDATE ON public.matches FROM authenticated;

-- Remove políticas UPDATE antigas e permissivas. As funções abaixo substituem
-- essas políticas sem permitir a alteração de outros campos da partida.
DO $$
DECLARE
  policy_row RECORD;
BEGIN
  FOR policy_row IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'matches' AND cmd = 'UPDATE'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.matches', policy_row.policyname);
  END LOOP;
END $$;

-- Garante que uma partida nova pertença à sessão e que o responsável inicial,
-- quando informado, seja o próprio criador (que entra na súmula logo depois).
DO $$
DECLARE
  policy_row RECORD;
BEGIN
  FOR policy_row IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'matches' AND cmd = 'INSERT'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.matches', policy_row.policyname);
  END LOOP;
END $$;

CREATE POLICY "Users create their own matches"
ON public.matches
FOR INSERT
TO authenticated
WITH CHECK (
  created_by = auth.uid()
  AND (scorekeeper_id IS NULL OR scorekeeper_id = auth.uid())
);

CREATE OR REPLACE FUNCTION public.assign_match_scorekeeper(
  _match_id UUID,
  _scorekeeper_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.matches
    WHERE id = _match_id AND created_by = auth.uid() AND status = 'active'
  ) THEN
    RAISE EXCEPTION 'Somente o criador pode escolher o responsável pelo placar';
  END IF;

  IF _scorekeeper_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.match_participants
    WHERE match_id = _match_id AND user_id = _scorekeeper_id
  ) THEN
    RAISE EXCEPTION 'O responsável precisa participar da partida';
  END IF;

  UPDATE public.matches
  SET scorekeeper_id = _scorekeeper_id, updated_at = now()
  WHERE id = _match_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_match_score(
  _match_id UUID,
  _score_team_a INTEGER,
  _score_team_b INTEGER
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR _score_team_a NOT BETWEEN 0 AND 999 OR _score_team_b NOT BETWEEN 0 AND 999 THEN
    RAISE EXCEPTION 'Placar inválido';
  END IF;

  UPDATE public.matches
  SET score_team_a = _score_team_a,
      score_team_b = _score_team_b,
      updated_at = now()
  WHERE id = _match_id
    AND scorekeeper_id = auth.uid()
    AND status = 'active';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Somente o responsável pode alterar o placar de uma partida ativa';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.finish_match(_match_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.matches
  SET status = 'finished', updated_at = now()
  WHERE id = _match_id AND created_by = auth.uid() AND status = 'active';
  IF NOT FOUND THEN RAISE EXCEPTION 'Somente o criador pode encerrar esta partida'; END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.cancel_match(_match_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.matches
  SET status = 'cancelled', updated_at = now()
  WHERE id = _match_id AND created_by = auth.uid() AND status = 'active';
  IF NOT FOUND THEN RAISE EXCEPTION 'Somente o criador pode cancelar esta partida'; END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.auto_finish_match(_match_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.matches
  SET status = 'finished', updated_at = now()
  WHERE id = _match_id
    AND status = 'active'
    AND COALESCE(finished_at, scheduled_at + INTERVAL '60 minutes', created_at + INTERVAL '60 minutes') <= now();
END;
$$;

REVOKE ALL ON FUNCTION public.assign_match_scorekeeper(UUID, UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.update_match_score(UUID, INTEGER, INTEGER) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.finish_match(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.cancel_match(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.auto_finish_match(UUID) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.assign_match_scorekeeper(UUID, UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.update_match_score(UUID, INTEGER, INTEGER) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.finish_match(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.cancel_match(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.auto_finish_match(UUID) TO authenticated, service_role;