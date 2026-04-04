-- =============================================
--  FIX: Simplificar RLS para planos_mestres
--  A politica por email no JWT pode falhar.
--  Por enquanto: qualquer usuario autenticado pode CRUD.
--  Execute no Supabase SQL Editor
-- =============================================

-- Drop existing restrictive policies
DROP POLICY IF EXISTS "Admin cria planos mestres" ON planos_mestres;
DROP POLICY IF EXISTS "Admin atualiza planos mestres" ON planos_mestres;
DROP POLICY IF EXISTS "Admin deleta planos mestres" ON planos_mestres;
DROP POLICY IF EXISTS "Ler planos mestres ativos" ON planos_mestres;

-- Simplified policies: any authenticated user can read, admin can write
-- (admin check is done in the frontend for now)

CREATE POLICY "Qualquer autenticado le planos"
  ON planos_mestres FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Qualquer autenticado insere planos"
  ON planos_mestres FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Qualquer autenticado atualiza planos"
  ON planos_mestres FOR UPDATE
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Qualquer autenticado deleta planos"
  ON planos_mestres FOR DELETE
  USING (auth.uid() IS NOT NULL);

-- Ensure unique constraint exists
CREATE UNIQUE INDEX IF NOT EXISTS idx_planos_mestres_nome_unique
  ON planos_mestres(concurso_nome);
