-- 1. Garante que a coluna 'name' existe em 'matches'
ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS name text;

-- 2. Garante que as colunas de horário existem
ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS scheduled_at timestamptz DEFAULT now();
ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS finished_at timestamptz;

-- 3. Grants de permissão para o Supabase Externo (CRÍTICO)
-- Sem isso, o app recebe 403 Forbidden mesmo com RLS correto
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;

-- 4. Ajuste na tabela profiles para garantir que o insert de novo usuário funcione
GRANT ALL ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;

-- 5. Se houver sequências (IDs auto-increment), garantir grants nelas também
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- 6. Recriar a política de inserção de perfis (caso esteja bloqueando)
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
CREATE POLICY "Users can insert their own profile" ON public.profiles
FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles
FOR UPDATE TO authenticated USING (auth.uid() = id);
