-- =============================================
--  Migration: planos_mestres (Admin-curated plans)
--  Execute no Supabase SQL Editor
-- =============================================

CREATE TABLE IF NOT EXISTS planos_mestres (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  concurso_nome TEXT NOT NULL,
  cargo TEXT,
  banca TEXT,
  data_prova DATE,
  materias JSONB NOT NULL,
  -- materias format: [{nome, peso, questoes, topicos:[]}]
  trilha_sugerida TEXT DEFAULT 'consistente',
  ativo BOOLEAN DEFAULT true,
  criado_por UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_planos_mestres_concurso ON planos_mestres(concurso_nome);
CREATE INDEX IF NOT EXISTS idx_planos_mestres_ativo ON planos_mestres(ativo);

ALTER TABLE planos_mestres ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can read active plans
DO $$ BEGIN
  CREATE POLICY "Ler planos mestres ativos" ON planos_mestres FOR SELECT USING (ativo = true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Only admins can insert/update (check via user metadata or email)
DO $$ BEGIN
  CREATE POLICY "Admin cria planos mestres" ON planos_mestres FOR INSERT
    WITH CHECK (auth.jwt() ->> 'email' IN ('rodrigorenno99@gmail.com'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Admin atualiza planos mestres" ON planos_mestres FOR UPDATE
    USING (auth.jwt() ->> 'email' IN ('rodrigorenno99@gmail.com'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Admin deleta planos mestres" ON planos_mestres FOR DELETE
    USING (auth.jwt() ->> 'email' IN ('rodrigorenno99@gmail.com'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Unique constraint for upsert
CREATE UNIQUE INDEX IF NOT EXISTS idx_planos_mestres_nome_unique ON planos_mestres(concurso_nome);

-- Data API GRANTs (Supabase requirement). RLS still gates row access.
GRANT ALL ON TABLE public.planos_mestres TO postgres, anon, authenticated, service_role;
