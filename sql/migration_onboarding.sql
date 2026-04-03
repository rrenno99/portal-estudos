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
