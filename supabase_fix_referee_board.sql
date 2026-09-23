-- Correção do link do juiz: a tabela profiles usa avatar_url (não photo_url).
-- Execute este bloco no SQL Editor do Supabase.

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
        'id', p.id, 'name', COALESCE(NULLIF(p.nickname, ''), p.full_name), 'photo_url', p.avatar_url, 'team_side', mp.team_side
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

GRANT EXECUTE ON FUNCTION public.referee_board(TEXT) TO anon, authenticated, service_role;
