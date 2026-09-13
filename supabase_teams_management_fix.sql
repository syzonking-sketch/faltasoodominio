-- Execute este arquivo uma vez no SQL Editor do projeto Supabase.
-- Corrige aprovação/recusa de solicitações e exclusão segura de times.

CREATE OR REPLACE FUNCTION public.manage_team_request(
  _member_id UUID,
  _action TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_team_id UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sessão não carregada';
  END IF;

  SELECT tm.team_id INTO target_team_id
  FROM public.team_members tm
  JOIN public.teams t ON t.id = tm.team_id
  WHERE tm.id = _member_id
    AND tm.status = 'pending_approval'
    AND t.captain_id = auth.uid();

  IF target_team_id IS NULL THEN
    RAISE EXCEPTION 'Solicitação não encontrada ou sem permissão';
  END IF;

  IF _action = 'approve' THEN
    UPDATE public.team_members SET status = 'active' WHERE id = _member_id;
  ELSIF _action = 'reject' THEN
    DELETE FROM public.team_members WHERE id = _member_id;
  ELSE
    RAISE EXCEPTION 'Ação inválida';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_team(_team_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.teams
    WHERE id = _team_id AND captain_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Somente o capitão pode eliminar este time';
  END IF;

  DELETE FROM public.match_confrontos
  WHERE team_a_id = _team_id OR team_b_id = _team_id;

  DELETE FROM public.team_members WHERE team_id = _team_id;
  DELETE FROM public.teams WHERE id = _team_id AND captain_id = auth.uid();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Time não encontrado';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.manage_team_request(UUID, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.delete_team(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.manage_team_request(UUID, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.delete_team(UUID) TO authenticated, service_role;