import { supabase } from './supabase.js';

// =============================================
//  VERIFICAR E-MAIL AUTORIZADO
// =============================================

export async function verificarAutorizacao(email) {
  const { data, error } = await supabase
    .from('usuarios_autorizados')
    .select('email')
    .eq('email', email.toLowerCase().trim())
    .single();

  if (error || !data) return false;
  return true;
}

// =============================================
//  CADASTRO (SIGN UP)
// =============================================

export async function cadastrar(email, senha, nome) {
  const autorizado = await verificarAutorizacao(email);
  if (!autorizado) {
    throw new Error('Acesso exclusivo para alunos. Verifique seu e-mail da Hotmart ou entre em contato com o suporte.');
  }

  const { data, error } = await supabase.auth.signUp({
    email,
    password: senha,
    options: {
      data: { nome },
      emailRedirectTo: window.location.origin + '/criar-plano.html'
    }
  });

  if (error) throw error;

  // Criar perfil na tabela perfil_aluno após cadastro
  if (data.user) {
    const { error: perfilError } = await supabase
      .from('perfil_aluno')
      .insert([{
        user_id: data.user.id,
        nome,
        email: email.toLowerCase().trim()
      }]);

    if (perfilError) console.error('Erro ao criar perfil:', perfilError.message);
  }

  return data;
}

// =============================================
//  LOGIN (SIGN IN)
// =============================================

export async function login(email, senha) {
  const autorizado = await verificarAutorizacao(email);
  if (!autorizado) {
    throw new Error('Acesso exclusivo para alunos. Verifique seu e-mail da Hotmart ou entre em contato com o suporte.');
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password: senha
  });

  if (error) throw error;
  return data;
}

// =============================================
//  LOGOUT
// =============================================

export async function logout() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;

  // Clear ALL user data from localStorage
  localStorage.removeItem('studyplan_perfil');
  localStorage.removeItem('studyplan_plan');
  localStorage.removeItem('studyplan_links');
  localStorage.removeItem('studyplan_stats');

  window.location.href = 'login.html';
}

// =============================================
//  SESSÃO ATUAL
// =============================================

export async function getUsuarioAtual() {
  // First try getSession (uses cached/persisted token)
  const { data: { session } } = await supabase.auth.getSession();
  if (session) return session.user;

  // Fallback to getUser (network call)
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export async function protegerPagina() {
  const user = await getUsuarioAtual();
  if (!user) {
    window.location.href = 'login.html';
    return null;
  }
  return user;
}

// =============================================
//  RECUPERAÇÃO DE SENHA
// =============================================

export async function enviarResetSenha(email) {
  const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: window.location.origin + '/reset-password.html'
  });

  if (error) throw error;
  return data;
}

export async function atualizarSenha(novaSenha) {
  const { data, error } = await supabase.auth.updateUser({
    password: novaSenha
  });

  if (error) throw error;
  return data;
}

// =============================================
//  AUTH STATE LISTENER
//  Call this on page load to handle session
//  changes (login, logout, token refresh, expiry)
// =============================================

export function onAuthStateChange(callback) {
  supabase.auth.onAuthStateChange((event, session) => {
    callback(event, session);
  });
}

// =============================================
//  REDIRECT IF LOGGED IN
//  Use on login.html to skip login if session exists
// =============================================

export async function redirecionarSeLogado(destino = 'dashboard.html') {
  const user = await getUsuarioAtual();
  if (user) {
    window.location.href = destino;
    return true;
  }
  return false;
}
