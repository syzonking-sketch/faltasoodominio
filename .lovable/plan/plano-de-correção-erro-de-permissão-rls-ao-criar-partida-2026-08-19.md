# Plano de Correção: Erro de Permissão (RLS) ao Criar Partida

O erro 403 (Forbidden) com a mensagem "new row violates row-level security policy for table 'matches'" confirma que as políticas de RLS no Supabase externo estão bloqueando a inserção de novas partidas, apesar de o usuário estar autenticado.

## Ações Necessárias

### 1. Banco de Dados (Supabase Externo)
Como não posso alterar o banco de dados diretamente, fornecerei o script SQL exato que você deve executar no seu painel do Supabase (SQL Editor) para liberar a criação de partidas.

### 2. Melhoria na UI (Frontend)
Vou melhorar o tratamento de erro em `src/routes/_authenticated/matches.new.tsx` para que, caso o erro de RLS persista, a mensagem seja clara sobre como resolver (executar o SQL).

### 3. Validação de Schema
Ajustarei a função `createMatch` em `src/lib/api.ts` para garantir que todos os campos obrigatórios pelo banco de dados (que podem estar causando a violação da política se estiverem faltando) sejam enviados corretamente.

## Detalhes Técnicos

O script SQL corrigirá:
- Permissão de `INSERT` na tabela `matches` para usuários autenticados.
- Permissão de `INSERT` na tabela `match_participants`.
- Garantia de que as sequências (se houver) e esquemas estão acessíveis.

```sql
-- Executar no SQL Editor do Supabase
GRANT ALL ON TABLE public.matches TO authenticated;
GRANT ALL ON TABLE public.match_participants TO authenticated;
GRANT ALL ON TABLE public.venues TO authenticated;

-- Garantir políticas de RLS básicas
ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can create matches" ON public.matches;
CREATE POLICY "Users can create matches" ON public.matches FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Users can view all matches" ON public.matches FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Users can join matches" ON public.match_participants;
CREATE POLICY "Users can join matches" ON public.match_participants FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can view participants" ON public.match_participants FOR SELECT TO authenticated USING (true);
```