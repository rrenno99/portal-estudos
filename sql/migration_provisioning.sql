-- =============================================
--  Migration: Provisioning (Make.com + Hotmart)
--  Expande usuarios_autorizados com status e origem
--  Execute no Supabase SQL Editor
-- =============================================

-- Add new columns to existing table
ALTER TABLE usuarios_autorizados
  ADD COLUMN IF NOT EXISTS subscription_status TEXT DEFAULT 'active' CHECK (subscription_status IN ('active', 'inactive', 'pending')),
  ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS plan_type TEXT DEFAULT 'standard',
  ADD COLUMN IF NOT EXISTS hotmart_transaction_id TEXT,
  ADD COLUMN IF NOT EXISTS activated_at TIMESTAMPTZ DEFAULT now(),
  ADD COLUMN IF NOT EXISTS deactivated_at TIMESTAMPTZ;

-- Index for status queries
CREATE INDEX IF NOT EXISTS idx_usuarios_status ON usuarios_autorizados(subscription_status);

-- Allow service_role to manage (for Edge Functions)
-- The existing SELECT policy allows anyone to check authorization
-- We need INSERT/UPDATE/DELETE for the provisioning API

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
