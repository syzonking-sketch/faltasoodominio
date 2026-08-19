-- 1. Garante que a tabela de times existe e tem RLS habilitado
ALTER TABLE IF EXISTS public.teams ENABLE ROW LEVEL SECURITY;

-- 2. Grants de permissão para a tabela teams e team_members
GRANT ALL ON public.teams TO authenticated;
GRANT ALL ON public.teams TO service_role;
GRANT SELECT ON public.teams TO anon;

GRANT ALL ON public.team_members TO authenticated;
GRANT ALL ON public.team_members TO service_role;
GRANT SELECT ON public.team_members TO anon;

-- 3. Políticas para a tabela 'teams'
DROP POLICY IF EXISTS "Teams are viewable by everyone" ON public.teams;
CREATE POLICY "Teams are viewable by everyone" ON public.teams FOR SELECT USING (true);

DROP POLICY IF EXISTS "Authenticated users can create teams" ON public.teams;
CREATE POLICY "Authenticated users can create teams" ON public.teams FOR INSERT TO authenticated WITH CHECK (auth.uid() = captain_id);

DROP POLICY IF EXISTS "Captains can update their teams" ON public.teams;
CREATE POLICY "Captains can update their teams" ON public.teams FOR UPDATE TO authenticated USING (auth.uid() = captain_id);

-- 4. Políticas para a tabela 'team_members'
DROP POLICY IF EXISTS "Team members are viewable by everyone" ON public.team_members;
CREATE POLICY "Team members are viewable by everyone" ON public.team_members FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can request to join teams" ON public.team_members;
CREATE POLICY "Users can request to join teams" ON public.team_members FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Captains can manage members" ON public.team_members;
CREATE POLICY "Captains can manage members" ON public.team_members FOR ALL TO authenticated USING (
  EXISTS (
    SELECT 1 FROM public.teams 
    WHERE teams.id = team_members.team_id 
    AND teams.captain_id = auth.uid()
  )
);
