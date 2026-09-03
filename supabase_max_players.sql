-- Execute no SQL Editor do seu projeto Supabase (odjgylxayhluepjbiqxi).
-- Adiciona a capacidade máxima de jogadores por partida.
alter table public.matches
  add column if not exists max_players integer not null default 10;

-- (opcional) garante acesso via Data API
grant select, insert, update, delete on public.matches to authenticated;
grant select on public.matches to anon;
grant all on public.matches to service_role;
