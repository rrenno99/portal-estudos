-- =============================================
--  Migration: Login Tracking
--  Adiciona campos de rastreio de acesso
--  Execute no Supabase SQL Editor
-- =============================================

ALTER TABLE usuarios_autorizados
  ADD COLUMN IF NOT EXISTS last_login TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS login_count INTEGER DEFAULT 0;

-- Indice para queries de churn (alunos sem login recente)
CREATE INDEX IF NOT EXISTS idx_usuarios_last_login ON usuarios_autorizados(last_login);
