-- =============================================
--  Migration: Biblioteca Mestre (topics_content + bank_questions)
--  Base do ecossistema de conteudo (teoria + banco de questoes).
--  Por enquanto: leitura restrita ao admin master.
--  Execute no Supabase SQL Editor.
-- =============================================

-- =============================================
--  TABELA: topics_content
--  Teoria por topico (HTML renderizavel)
-- =============================================
CREATE TABLE IF NOT EXISTS topics_content (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  subject_name TEXT NOT NULL,
  topic_name TEXT NOT NULL,
  html_body TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (subject_name, topic_name)
);

CREATE INDEX IF NOT EXISTS idx_topics_subject ON topics_content(subject_name);
CREATE INDEX IF NOT EXISTS idx_topics_topic   ON topics_content(topic_name);

ALTER TABLE topics_content ENABLE ROW LEVEL SECURITY;

-- Admin master (rodrigorenno99@gmail.com) e usuarios com is_admin=true podem
-- ler/escrever. Outros: bloqueados por enquanto.
DO $$ BEGIN
  CREATE POLICY "Admin le topics_content" ON topics_content FOR SELECT
    USING (
      auth.jwt() ->> 'email' = 'rodrigorenno99@gmail.com'
      OR EXISTS (
        SELECT 1 FROM usuarios_autorizados
        WHERE email = auth.jwt() ->> 'email' AND is_admin = true
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Admin cria topics_content" ON topics_content FOR INSERT
    WITH CHECK (
      auth.jwt() ->> 'email' = 'rodrigorenno99@gmail.com'
      OR EXISTS (
        SELECT 1 FROM usuarios_autorizados
        WHERE email = auth.jwt() ->> 'email' AND is_admin = true
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Admin atualiza topics_content" ON topics_content FOR UPDATE
    USING (
      auth.jwt() ->> 'email' = 'rodrigorenno99@gmail.com'
      OR EXISTS (
        SELECT 1 FROM usuarios_autorizados
        WHERE email = auth.jwt() ->> 'email' AND is_admin = true
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Admin deleta topics_content" ON topics_content FOR DELETE
    USING (
      auth.jwt() ->> 'email' = 'rodrigorenno99@gmail.com'
      OR EXISTS (
        SELECT 1 FROM usuarios_autorizados
        WHERE email = auth.jwt() ->> 'email' AND is_admin = true
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- =============================================
--  TABELA: bank_questions
--  Banco de questoes vinculado a um topico
-- =============================================
CREATE TABLE IF NOT EXISTS bank_questions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  topic_id UUID REFERENCES topics_content(id) ON DELETE CASCADE NOT NULL,
  banca TEXT,
  question_html TEXT NOT NULL,
  options_json JSONB NOT NULL,
  -- options_json shape sugerido:
  -- [{"key":"A","text":"..."}, {"key":"B","text":"..."}, ...]
  correct_option TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bank_questions_topic ON bank_questions(topic_id);
CREATE INDEX IF NOT EXISTS idx_bank_questions_banca ON bank_questions(banca);

ALTER TABLE bank_questions ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Admin le bank_questions" ON bank_questions FOR SELECT
    USING (
      auth.jwt() ->> 'email' = 'rodrigorenno99@gmail.com'
      OR EXISTS (
        SELECT 1 FROM usuarios_autorizados
        WHERE email = auth.jwt() ->> 'email' AND is_admin = true
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Admin cria bank_questions" ON bank_questions FOR INSERT
    WITH CHECK (
      auth.jwt() ->> 'email' = 'rodrigorenno99@gmail.com'
      OR EXISTS (
        SELECT 1 FROM usuarios_autorizados
        WHERE email = auth.jwt() ->> 'email' AND is_admin = true
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Admin atualiza bank_questions" ON bank_questions FOR UPDATE
    USING (
      auth.jwt() ->> 'email' = 'rodrigorenno99@gmail.com'
      OR EXISTS (
        SELECT 1 FROM usuarios_autorizados
        WHERE email = auth.jwt() ->> 'email' AND is_admin = true
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Admin deleta bank_questions" ON bank_questions FOR DELETE
    USING (
      auth.jwt() ->> 'email' = 'rodrigorenno99@gmail.com'
      OR EXISTS (
        SELECT 1 FROM usuarios_autorizados
        WHERE email = auth.jwt() ->> 'email' AND is_admin = true
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- =============================================
--  Data API GRANTs (Supabase requirement).
--  Tabelas usam UUID, sem sequence — apenas GRANT ON TABLE.
-- =============================================
GRANT ALL ON TABLE public.topics_content TO postgres, anon, authenticated, service_role;
GRANT ALL ON TABLE public.bank_questions TO postgres, anon, authenticated, service_role;
