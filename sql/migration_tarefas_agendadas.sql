-- =============================================
--  Migration: tarefas_agendadas (motor de revisao espacada)
--
--  Quando o aluno conclui uma aula (D-0), o sistema agenda duas
--  tarefas futuras para o mesmo topico:
--    - tipo='resumo'   em D+1 dia
--    - tipo='questoes' em D+3 dias
--
--  scheduled_for guarda a DATA em que a tarefa deve aparecer.
--  origem_data guarda quando a aula original foi concluida (chave
--  de dedupe para nao re-agendar se o aluno marcar concluida de novo).
-- =============================================

CREATE TABLE IF NOT EXISTS tarefas_agendadas (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  materia TEXT NOT NULL,
  numero_aula INTEGER,
  topic_id UUID REFERENCES topics_content(id) ON DELETE SET NULL,
  topic_name TEXT,
  tipo TEXT NOT NULL CHECK (tipo IN ('resumo', 'questoes')),
  scheduled_for DATE NOT NULL,
  origem_data DATE NOT NULL,
  status TEXT DEFAULT 'pendente' CHECK (status IN ('pendente', 'concluido', 'pulado')),
  concluido_em TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  -- Dedupe key: uma aula concluida no mesmo dia so gera UM resumo + UMA questao
  UNIQUE (user_id, materia, numero_aula, tipo, origem_data)
);

CREATE INDEX IF NOT EXISTS idx_tarefas_user_data    ON tarefas_agendadas(user_id, scheduled_for);
CREATE INDEX IF NOT EXISTS idx_tarefas_user_status  ON tarefas_agendadas(user_id, status);

ALTER TABLE tarefas_agendadas ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Aluno le proprias tarefas"     ON tarefas_agendadas
    FOR SELECT USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Aluno cria proprias tarefas"   ON tarefas_agendadas
    FOR INSERT WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Aluno atualiza proprias tarefas" ON tarefas_agendadas
    FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Aluno deleta proprias tarefas" ON tarefas_agendadas
    FOR DELETE USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Data API GRANTs (Supabase requirement). RLS continua gating row access.
GRANT ALL ON TABLE public.tarefas_agendadas TO postgres, anon, authenticated, service_role;
