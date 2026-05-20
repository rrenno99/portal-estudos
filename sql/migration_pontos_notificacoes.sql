-- =============================================
--  Migration: pontos + notificacoes
--  Execute no Supabase SQL Editor
-- =============================================

-- 1. Adicionar coluna pontos na perfil_aluno
ALTER TABLE perfil_aluno ADD COLUMN IF NOT EXISTS pontos INTEGER DEFAULT 0;

-- 2. Criar tabela de notificacoes
CREATE TABLE IF NOT EXISTS notificacoes_aluno (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  texto TEXT NOT NULL,
  lida BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notificacoes_user_id ON notificacoes_aluno(user_id, created_at DESC);

ALTER TABLE notificacoes_aluno ENABLE ROW LEVEL SECURITY;

-- RLS policies (usando DO block para evitar erro se já existirem)
DO $$ BEGIN
  CREATE POLICY "Aluno le proprias notificacoes" ON notificacoes_aluno FOR SELECT USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Aluno cria proprias notificacoes" ON notificacoes_aluno FOR INSERT WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Aluno atualiza proprias notificacoes" ON notificacoes_aluno FOR UPDATE USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Data API GRANTs (Supabase requirement). RLS still gates row access.
GRANT ALL ON TABLE public.notificacoes_aluno TO postgres, anon, authenticated, service_role;
