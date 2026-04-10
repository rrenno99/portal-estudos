// =============================================
//  API: /api/create-student
//  Cadastro manual de alunos pelo Admin
//
//  1. Gera senha provisoria
//  2. Cria usuario no Supabase Auth
//  3. Insere na tabela usuarios_autorizados
//  4. Envia e-mail de boas-vindas via Resend
//
//  POST /api/create-student
//  Headers: { "x-api-key": "...", "Content-Type": "application/json" }
//  Body: { "email", "nome", "expires_at" }
// =============================================

const { createClient } = require('@supabase/supabase-js');

module.exports = async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-api-key');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Use POST.' });

  // Auth
  const API_KEY = process.env.PROVISIONING_API_KEY;
  if (!API_KEY || req.headers['x-api-key'] !== API_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Validate
  const { email, nome, expires_at } = req.body || {};
  if (!email) return res.status(400).json({ error: 'Campo email obrigatorio' });

  const normalizedEmail = email.toLowerCase().trim();

  // Env vars
  const SUPABASE_URL = process.env.SUPABASE_URL || 'https://hcngacohwiwphcbroint.supabase.co';
  const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const RESEND_API_KEY = process.env.RESEND_API_KEY;

  if (!SUPABASE_SERVICE_KEY) {
    return res.status(500).json({ error: 'SUPABASE_SERVICE_ROLE_KEY not configured' });
  }
  if (!RESEND_API_KEY) {
    return res.status(500).json({ error: 'RESEND_API_KEY not configured' });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  try {
    // 1. Check if already exists in usuarios_autorizados
    const { data: existing } = await supabase
      .from('usuarios_autorizados')
      .select('email')
      .eq('email', normalizedEmail)
      .single();

    if (existing) {
      return res.status(409).json({ error: 'Este e-mail ja esta cadastrado.' });
    }

    // 2. Generate provisional password
    const senha = gerarSenha();

    // 3. Create user in Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: normalizedEmail,
      password: senha,
      email_confirm: true,
      user_metadata: { nome: nome || '' }
    });

    if (authError) {
      // If user already exists in Auth but not in our table, still proceed
      if (!authError.message.includes('already been registered')) {
        throw new Error('Erro Auth: ' + authError.message);
      }
    }

    // 4. Insert into usuarios_autorizados
    const insertData = {
      email: normalizedEmail,
      nome: nome || null,
      subscription_status: 'active',
      source: 'manual',
      plan_type: 'standard',
      activated_at: new Date().toISOString()
    };
    if (expires_at) insertData.expires_at = expires_at;

    const { error: dbError } = await supabase
      .from('usuarios_autorizados')
      .insert(insertData);

    if (dbError) throw new Error('Erro DB: ' + dbError.message);

    // 5. Send welcome email via Resend
    const nomeDisplay = nome || 'Aluno(a)';
    const emailResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + RESEND_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: 'Planejador Renno <noreply@planejador.rodrigorenno.com>',
        to: [normalizedEmail],
        subject: 'Bem-vindo(a) ao Planejador Renno!',
        html: buildWelcomeEmail(nomeDisplay, normalizedEmail, senha, expires_at)
      })
    });

    const emailResult = await emailResponse.json();

    if (!emailResponse.ok) {
      console.error('[CreateStudent] Resend error:', emailResult);
      // Student was created, just email failed — don't rollback
      return res.status(200).json({
        success: true,
        email: normalizedEmail,
        senha: senha,
        email_sent: false,
        email_error: emailResult.message || 'Falha no envio'
      });
    }

    console.log('[CreateStudent] Created:', normalizedEmail, '| Email sent:', emailResult.id);

    return res.status(200).json({
      success: true,
      email: normalizedEmail,
      senha: senha,
      email_sent: true
    });

  } catch (err) {
    console.error('[CreateStudent] Error:', err.message);
    return res.status(500).json({ error: err.message });
  }
};

// ---- Helpers ----

function gerarSenha() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  const specials = '!@#$&*';
  let senha = '';
  for (let i = 0; i < 8; i++) {
    senha += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  // Insert 1 special char at random position
  const pos = Math.floor(Math.random() * senha.length);
  const spec = specials.charAt(Math.floor(Math.random() * specials.length));
  senha = senha.slice(0, pos) + spec + senha.slice(pos);
  return senha;
}

function buildWelcomeEmail(nome, email, senha, expiresAt) {
  let validadeHtml = '';
  if (expiresAt) {
    const d = new Date(expiresAt);
    validadeHtml = '<p style="margin:0 0 8px;font-size:14px;color:#555">Seu acesso e valido ate: <strong>' + d.toLocaleDateString('pt-BR') + '</strong></p>';
  }

  return '<!DOCTYPE html>'
    + '<html><head><meta charset="utf-8"></head>'
    + '<body style="margin:0;padding:0;background:#F5F6FA;font-family:Inter,Arial,sans-serif">'
    + '<div style="max-width:520px;margin:40px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08)">'

    // Header
    + '<div style="background:linear-gradient(135deg,#1E88E5,#1565C0);padding:32px 28px;text-align:center">'
    + '<h1 style="margin:0;color:#fff;font-size:22px;font-weight:800">Planejador Renno</h1>'
    + '<p style="margin:8px 0 0;color:rgba(255,255,255,0.85);font-size:14px">Seu plano de estudos inteligente</p>'
    + '</div>'

    // Body
    + '<div style="padding:28px">'
    + '<h2 style="margin:0 0 16px;font-size:18px;color:#1A1A2E">Ola, ' + nome + '!</h2>'
    + '<p style="margin:0 0 20px;font-size:14px;color:#555;line-height:1.6">Sua conta no <strong>Planejador Renno</strong> foi criada com sucesso. Use as credenciais abaixo para acessar a plataforma:</p>'

    // Credentials box
    + '<div style="background:#F0F7FF;border:1px solid #D0E3F7;border-radius:8px;padding:20px;margin-bottom:20px">'
    + '<p style="margin:0 0 8px;font-size:14px;color:#555">E-mail: <strong style="color:#1A1A2E">' + email + '</strong></p>'
    + '<p style="margin:0 0 8px;font-size:14px;color:#555">Senha provisoria: <strong style="color:#1E88E5;font-size:16px;letter-spacing:1px">' + senha + '</strong></p>'
    + validadeHtml
    + '</div>'

    + '<p style="margin:0 0 24px;font-size:13px;color:#888;line-height:1.5">Recomendamos que voce altere sua senha apos o primeiro acesso em <strong>Configuracoes</strong>.</p>'

    // CTA Button
    + '<div style="text-align:center">'
    + '<a href="https://planejador.rodrigorenno.com" style="display:inline-block;background:#1E88E5;color:#fff;text-decoration:none;padding:12px 32px;border-radius:8px;font-weight:700;font-size:15px">Acessar o Planejador</a>'
    + '</div>'
    + '</div>'

    // Footer
    + '<div style="padding:16px 28px;background:#F9FAFB;border-top:1px solid #EEE;text-align:center">'
    + '<p style="margin:0;font-size:12px;color:#AAA">Planejador Renno — planejador.rodrigorenno.com</p>'
    + '</div>'

    + '</div>'
    + '</body></html>';
}
