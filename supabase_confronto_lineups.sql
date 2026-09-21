-- ============================================================================
-- The Match — Escalação do Contra (titulares, reservas e goleiro)
-- Rode este arquivo UMA VEZ no SQL Editor do Supabase.
-- ============================================================================

-- 1) Papel na escalação do participante da partida
alter table public.match_participants
  add column if not exists lineup_role text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'match_participants_lineup_role_check'
  ) then
    alter table public.match_participants
      add constraint match_participants_lineup_role_check
      check (lineup_role is null or lineup_role in ('gk', 'starter', 'bench'));
  end if;
end $$;

create index if not exists match_participants_match_side_idx
  on public.match_participants (match_id, team_side);

-- 2) Escalação definida pelo capitão de cada time do confronto
create or replace function public.set_confronto_lineup(
  _confronto_id uuid,
  _team_side text,
  _entries jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  _uid uuid := auth.uid();
  _match_id uuid;
  _team_id uuid;
  _captain uuid;
  _gk_count int;
begin
  if _uid is null then
    raise exception 'Faça login para escalar o time.';
  end if;
  if _team_side not in ('A', 'B') then
    raise exception 'Lado do time inválido.';
  end if;

  select c.match_id,
         case when _team_side = 'A' then c.team_a_id else c.team_b_id end
    into _match_id, _team_id
  from public.match_confrontos c
  where c.id = _confronto_id;

  if _match_id is null then
    raise exception 'Confronto sem partida vinculada.';
  end if;

  select captain_id into _captain from public.teams where id = _team_id;
  if _captain is distinct from _uid then
    raise exception 'Só o capitão deste time pode montar a escalação.';
  end if;

  select count(*) into _gk_count
  from jsonb_array_elements(coalesce(_entries, '[]'::jsonb)) e
  where e->>'lineup_role' = 'gk';
  if _gk_count > 1 then
    raise exception 'Escale apenas um goleiro.';
  end if;

  -- Todos precisam ser membros ativos do time
  if exists (
    select 1
    from jsonb_array_elements(coalesce(_entries, '[]'::jsonb)) e
    where not exists (
      select 1 from public.team_members m
      where m.team_id = _team_id
        and m.user_id = (e->>'user_id')::uuid
        and m.status = 'active'
    )
    and (e->>'user_id')::uuid <> _captain
  ) then
    raise exception 'Só jogadores ativos do time podem ser escalados.';
  end if;

  delete from public.match_participants
  where match_id = _match_id
    and team_side = _team_side;

  insert into public.match_participants (match_id, user_id, role, team_side, checked_in_gps, lineup_role)
  select _match_id,
         (e->>'user_id')::uuid,
         'player',
         _team_side,
         false,
         coalesce(e->>'lineup_role', 'starter')
  from jsonb_array_elements(coalesce(_entries, '[]'::jsonb)) e
  on conflict do nothing;
end;
$$;

grant execute on function public.set_confronto_lineup(uuid, text, jsonb) to authenticated;
