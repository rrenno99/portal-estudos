// =============================================
//  API: /api/provisioning
//  Provisioning endpoint for Make.com + Hotmart
//
//  Vercel Serverless Function (Node.js runtime)
//  URL: https://planejador.rodrigorenno.com/api/provisioning
//
//  Usage from Make.com:
//  POST /api/provisioning
//  Headers: { "x-api-key": "your-secret-key", "Content-Type": "application/json" }
//  Body: { "email": "aluno@email.com", "action": "activate" }
//        { "email": "aluno@email.com", "action": "deactivate" }
// =============================================

const { createClient } = require('@supabase/supabase-js');

module.exports = async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-api-key');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  // -----------------------------------------------
  //  1. AUTHENTICATE via API Key
  // -----------------------------------------------
  const API_KEY = process.env.PROVISIONING_API_KEY;
  const providedKey = req.headers['x-api-key'];

  if (!API_KEY) {
    return res.status(500).json({ error: 'Server error: PROVISIONING_API_KEY not configured' });
  }

  if (providedKey !== API_KEY) {
    return res.status(401).json({ error: 'Unauthorized: invalid or missing API key' });
  }

  // -----------------------------------------------
  //  2. VALIDATE request body
  // -----------------------------------------------
  const { email, action, source, plan_type, transaction_id, nome } = req.body || {};

  if (!email) {
    return res.status(400).json({ error: 'Missing required field: email' });
  }

  if (!action || !['activate', 'deactivate'].includes(action)) {
    return res.status(400).json({ error: 'Missing or invalid field: action. Use "activate" or "deactivate"' });
  }

  const normalizedEmail = email.toLowerCase().trim();

  // -----------------------------------------------
  //  3. CONNECT to Supabase (service role = bypass RLS)
  // -----------------------------------------------
  const SUPABASE_URL = process.env.SUPABASE_URL || 'https://hcngacohwiwphcbroint.supabase.co';
  const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!SUPABASE_SERVICE_KEY) {
    return res.status(500).json({ error: 'Server error: SUPABASE_SERVICE_ROLE_KEY not configured' });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  // -----------------------------------------------
  //  4. EXECUTE action
  // -----------------------------------------------
  try {
    if (action === 'activate') {
      // Check if email already exists
      const { data: existing } = await supabase
        .from('usuarios_autorizados')
        .select('email, subscription_status')
        .eq('email', normalizedEmail)
        .single();

      if (existing) {
        // Email exists — update status to active
        const { error } = await supabase
          .from('usuarios_autorizados')
          .update({
            subscription_status: 'active',
            source: source || existing.source || 'hotmart',
            plan_type: plan_type || existing.plan_type || 'standard',
            hotmart_transaction_id: transaction_id || null,
            activated_at: new Date().toISOString(),
            deactivated_at: null
          })
          .eq('email', normalizedEmail);

        if (error) throw error;

        console.log('[Provisioning] Reactivated:', normalizedEmail);
        return res.status(200).json({
          success: true,
          action: 'reactivated',
          message: 'Email reactivated successfully',
          email: normalizedEmail,
          status: 'active'
        });

      } else {
        // New email — insert
        const { error } = await supabase
          .from('usuarios_autorizados')
          .insert({
            email: normalizedEmail,
            subscription_status: 'active',
            source: source || 'hotmart',
            plan_type: plan_type || 'standard',
            hotmart_transaction_id: transaction_id || null,
            activated_at: new Date().toISOString()
          });

        if (error) throw error;

        console.log('[Provisioning] Activated (new):', normalizedEmail);
        return res.status(200).json({
          success: true,
          action: 'created',
          message: 'Email activated successfully',
          email: normalizedEmail,
          status: 'active'
        });
      }

    } else if (action === 'deactivate') {
      // Check if email exists
      const { data: existing } = await supabase
        .from('usuarios_autorizados')
        .select('email')
        .eq('email', normalizedEmail)
        .single();

      if (!existing) {
        return res.status(404).json({
          error: 'Email not found',
          email: normalizedEmail
        });
      }

      // Deactivate
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
        action: 'deactivated',
        message: 'Email deactivated successfully',
        email: normalizedEmail,
        status: 'inactive'
      });
    }

  } catch (err) {
    console.error('[Provisioning] Error:', err.message);
    return res.status(500).json({
      error: 'Database error',
      details: err.message
    });
  }
};
