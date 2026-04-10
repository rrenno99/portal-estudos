-- =============================================
--  Migration COMPLETA: usuarios_autorizados
--  Unifica todas as colunas necessarias para:
--  - Provisioning (Make.com + Hotmart)
--  - Gestao Manual de Alunos (Admin)
--
--  Execute no Supabase SQL Editor (uma unica vez)
-- =============================================

-- 1. Colunas do provisioning (status, origem, transacao)
ALTER TABLE usuarios_autorizados
  ADD COLUMN IF NOT EXISTS subscription_status TEXT DEFAULT 'active' CHECK (subscription_status IN ('active', 'inactive', 'pending')),
  ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS plan_type TEXT DEFAULT 'standard',
  ADD COLUMN IF NOT EXISTS hotmart_transaction_id TEXT,
  ADD COLUMN IF NOT EXISTS activated_at TIMESTAMPTZ DEFAULT now(),
  ADD COLUMN IF NOT EXISTS deactivated_at TIMESTAMPTZ;

-- 2. Colunas da gestao manual (nome, expiracao)
ALTER TABLE usuarios_autorizados
  ADD COLUMN IF NOT EXISTS nome TEXT,
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

-- 3. Indices
CREATE INDEX IF NOT EXISTS idx_usuarios_status ON usuarios_autorizados(subscription_status);
CREATE INDEX IF NOT EXISTS idx_usuarios_expires ON usuarios_autorizados(expires_at);

-- 4. Policies para INSERT/UPDATE/DELETE (necessarias para o admin via anon key)
DO $$ BEGIN
  CREATE POLICY "Service insere usuarios" ON usuarios_autorizados FOR INSERT
    WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Service atualiza usuarios" ON usuarios_autorizados FOR UPDATE
    USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Service deleta usuarios" ON usuarios_autorizados FOR DELETE
    USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
