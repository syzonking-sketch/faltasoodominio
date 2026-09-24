-- Corrige o erro: could not find the 'city' column of 'venues' in the schema cache
-- Garante as colunas de localização usadas pelo app na tabela de quadras.

alter table public.venues
  add column if not exists city text;

alter table public.venues
  add column if not exists state text;

alter table public.venues
  add column if not exists address text;

alter table public.venues
  add column if not exists description text;

alter table public.venues
  add column if not exists photo_url text;

-- Força o PostgREST a recarregar o schema cache
notify pgrst, 'reload schema';
