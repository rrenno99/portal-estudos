-- =============================================
--  Migration: ciclo de estudos adaptativo
--  Execute no Supabase SQL Editor
-- =============================================

-- Posicao atual do aluno no ciclo de materias (0-indexed)
ALTER TABLE perfil_aluno ADD COLUMN IF NOT EXISTS ciclo_posicao INTEGER DEFAULT 0;
