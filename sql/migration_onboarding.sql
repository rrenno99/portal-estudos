-- =============================================
--  Migration: Onboarding avancado
--  Execute no Supabase SQL Editor
-- =============================================

-- Novos campos em perfil_aluno
ALTER TABLE perfil_aluno ADD COLUMN IF NOT EXISTS edital_pdf_url TEXT;
ALTER TABLE perfil_aluno ADD COLUMN IF NOT EXISTS edital_link TEXT;
ALTER TABLE perfil_aluno ADD COLUMN IF NOT EXISTS trilha_revisao TEXT DEFAULT 'consistente';

-- Tabela de perfil por materia (nivel + fechada)
CREATE TABLE IF NOT EXISTS materia_perfil (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  materia TEXT NOT NULL,
  nivel TEXT DEFAULT 'iniciante' CHECK (nivel IN ('iniciante', 'regular', 'avancado')),
  fechada BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, materia)
);

CREATE INDEX IF NOT EXISTS idx_materia_perfil_user ON materia_perfil(user_id);

ALTER TABLE materia_perfil ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Aluno le proprio perfil materia" ON materia_perfil FOR SELECT USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Aluno cria proprio perfil materia" ON materia_perfil FOR INSERT WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Aluno atualiza proprio perfil materia" ON materia_perfil FOR UPDATE USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Aluno deleta proprio perfil materia" ON materia_perfil FOR DELETE USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Tabela plano_fundo: logica completa do plano para recalculo
CREATE TABLE IF NOT EXISTS plano_fundo (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  dados JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE plano_fundo ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Aluno le proprio plano_fundo" ON plano_fundo FOR SELECT USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "Aluno cria proprio plano_fundo" ON plano_fundo FOR INSERT WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "Aluno atualiza proprio plano_fundo" ON plano_fundo FOR UPDATE USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "Aluno deleta proprio plano_fundo" ON plano_fundo FOR DELETE USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Data API GRANTs (Supabase requirement). RLS still gates row access.
GRANT ALL ON TABLE public.materia_perfil TO postgres, anon, authenticated, service_role;
GRANT ALL ON TABLE public.plano_fundo    TO postgres, anon, authenticated, service_role;
