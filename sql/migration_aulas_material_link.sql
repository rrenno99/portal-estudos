-- =============================================
--  Migration: Link de material por aula
--  Adiciona coluna material_link em aulas_materia
--  Execute no Supabase SQL Editor
-- =============================================

ALTER TABLE aulas_materia
  ADD COLUMN IF NOT EXISTS material_link TEXT;
