-- Adiciona a coluna name na tabela matches
ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS name text;

-- Atualiza a política de visualização se necessário (geralmente não precisa se for public)
-- Mas vamos garantir que as tabelas tenham os grants corretos para o Supabase externo
GRANT SELECT, INSERT, UPDATE, DELETE ON public.matches TO authenticated;
GRANT ALL ON public.matches TO service_role;
