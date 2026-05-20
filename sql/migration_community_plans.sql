-- =============================================
--  Migration: community_plans + study_plans refinement
--  Execute no Supabase SQL Editor
-- =============================================

-- Planos comunitarios (compartilhados entre alunos)
CREATE TABLE IF NOT EXISTS community_plans (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  orgao TEXT NOT NULL,
  cargo TEXT NOT NULL,
  banca TEXT,
  materias JSONB NOT NULL,
  data_prova DATE,
  horas_semanais NUMERIC(4,1),
  trilha TEXT DEFAULT 'consistente',
  criado_por UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  votos INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(orgao, cargo)
);

CREATE INDEX IF NOT EXISTS idx_community_plans_cargo ON community_plans(cargo);
CREATE INDEX IF NOT EXISTS idx_community_plans_orgao ON community_plans(orgao);

ALTER TABLE community_plans ENABLE ROW LEVEL SECURITY;

-- Qualquer aluno autenticado pode ler planos comunitarios
DO $$ BEGIN
  CREATE POLICY "Aluno le planos comunitarios" ON community_plans FOR SELECT USING (auth.uid() IS NOT NULL);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Aluno cria plano comunitario" ON community_plans FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Aluno atualiza votos" ON community_plans FOR UPDATE USING (auth.uid() IS NOT NULL);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Data API GRANTs (Supabase requirement). RLS still controls row visibility.
GRANT ALL ON TABLE public.community_plans TO postgres, anon, authenticated, service_role;
