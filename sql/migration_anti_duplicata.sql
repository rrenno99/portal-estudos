-- =============================================
--  Migration: anti-duplicata de sessoes
--  Rejeita INSERT se ja existe sessao do mesmo
--  usuario, mesma materia e mesmo tempo_segundos
--  nos ultimos 10 segundos.
--  Execute no Supabase SQL Editor
-- =============================================

CREATE OR REPLACE FUNCTION check_sessao_duplicata()
RETURNS TRIGGER AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM sessoes_estudo
    WHERE user_id = NEW.user_id
      AND materia = NEW.materia
      AND tempo_segundos = NEW.tempo_segundos
      AND created_at > (now() - interval '10 seconds')
  ) THEN
    RAISE EXCEPTION 'Sessão duplicada detectada (mesmo usuário, matéria e tempo em < 10s)';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Adicionar coluna created_at se nao existir
ALTER TABLE sessoes_estudo ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();

DROP TRIGGER IF EXISTS trg_check_sessao_duplicata ON sessoes_estudo;

CREATE TRIGGER trg_check_sessao_duplicata
  BEFORE INSERT ON sessoes_estudo
  FOR EACH ROW EXECUTE FUNCTION check_sessao_duplicata();
