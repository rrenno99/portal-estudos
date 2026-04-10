-- =============================================
--  Migration: Gestao Manual de Alunos
--  Adiciona campos nome e expires_at na tabela usuarios_autorizados
--  Execute no Supabase SQL Editor
-- =============================================

-- Adicionar coluna nome (para cadastro manual pelo admin)
ALTER TABLE usuarios_autorizados
  ADD COLUMN IF NOT EXISTS nome TEXT;

-- Adicionar coluna de expiracao de acesso
ALTER TABLE usuarios_autorizados
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

-- Indice para consultas por expiracao
CREATE INDEX IF NOT EXISTS idx_usuarios_expires ON usuarios_autorizados(expires_at);
