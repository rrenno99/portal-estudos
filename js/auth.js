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
      data: { nome }
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
    throw new Error('Acesso restrito a alunos matriculados.');
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
  window.location.href = 'login.html';
}

// =============================================
//  SESSÃO ATUAL
// =============================================

export async function getUsuarioAtual() {
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
