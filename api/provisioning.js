// =============================================
//  API: /api/provisioning
//  Provisioning endpoint for Make.com + Hotmart
//
//  Deploy as Vercel Serverless Function:
//  - Place in /api/provisioning.js
//  - Set PROVISIONING_API_KEY in Vercel env vars
//
//  Usage:
//  POST /api/provisioning
//  Headers: { "x-api-key": "your-secret-key" }
//  Body: { "email": "aluno@email.com", "action": "activate" }
//        { "email": "aluno@email.com", "action": "deactivate" }
// =============================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://hcngacohwiwphcbroint.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const API_KEY = process.env.PROVISIONING_API_KEY;

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-api-key');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Authenticate via API key
  const providedKey = req.headers['x-api-key'];
  if (!API_KEY || providedKey !== API_KEY) {
    return res.status(401).json({ error: 'Unauthorized: invalid API key' });
  }

  // Validate body
  const { email, action, source, plan_type, transaction_id } = req.body || {};

  if (!email || !action) {
    return res.status(400).json({ error: 'Missing required fields: email, action' });
  }

  if (!['activate', 'deactivate'].includes(action)) {
    return res.status(400).json({ error: 'Invalid action. Use "activate" or "deactivate"' });
  }

  const normalizedEmail = email.toLowerCase().trim();

  // Connect to Supabase with service role (bypasses RLS)
  if (!SUPABASE_SERVICE_KEY) {
    return res.status(500).json({ error: 'Server misconfigured: missing SUPABASE_SERVICE_ROLE_KEY' });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  try {
    if (action === 'activate') {
      // Upsert: insert or reactivate
      const { error } = await supabase
        .from('usuarios_autorizados')
        .upsert({
          email: normalizedEmail,
          subscription_status: 'active',
          source: source || 'hotmart',
          plan_type: plan_type || 'standard',
          hotmart_transaction_id: transaction_id || null,
          activated_at: new Date().toISOString(),
          deactivated_at: null
        }, { onConflict: 'email' });

      if (error) throw error;

      console.log('[Provisioning] Activated:', normalizedEmail, source);
      return res.status(200).json({
        success: true,
        message: 'Email activated successfully',
        email: normalizedEmail,
        status: 'active'
      });

    } else if (action === 'deactivate') {
      // Update status to inactive
      const { error } = await supabase
        .from('usuarios_autorizados')
        .update({
          subscription_status: 'inactive',
          deactivated_at: new Date().toISOString()
        })
        .eq('email', normalizedEmail);

      if (error) throw error;

      console.log('[Provisioning] Deactivated:', normalizedEmail);
      return res.status(200).json({
        success: true,
        message: 'Email deactivated successfully',
        email: normalizedEmail,
        status: 'inactive'
      });
    }
  } catch (err) {
    console.error('[Provisioning] Error:', err.message);
    return res.status(500).json({ error: 'Database error: ' + err.message });
  }
}
