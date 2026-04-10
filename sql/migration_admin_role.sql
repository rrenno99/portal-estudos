-- =============================================
--  Migration: Admin Role
--  Adiciona campo is_admin na tabela usuarios_autorizados
--  Execute no Supabase SQL Editor
-- =============================================

ALTER TABLE usuarios_autorizados
  ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT false;

-- Marca o admin master
UPDATE usuarios_autorizados
  SET is_admin = true
  WHERE email = 'rodrigorenno99@gmail.com';
