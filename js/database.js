import { supabase } from './supabase.js';

// =============================================
//  HELPER: get current user_id (throws if none)
// =============================================

async function requireUserId() {
  const { data: { session } } = await supabase.auth.getSession();
  const userId = session?.user?.id;
  if (!userId) throw new Error('Nenhum usuário logado.');
  return userId;
}

// =============================================
//  PERFIL DO ALUNO
// =============================================

export async function criarPerfil(dados) {
  const userId = await requireUserId();
  const { data, error } = await supabase
    .from('perfil_aluno')
    .insert([{ ...dados, user_id: userId }])
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function buscarPerfil(userId) {
  if (!userId) { userId = await requireUserId(); }
  const { data, error } = await supabase
    .from('perfil_aluno')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  return data;
}

export async function atualizarPerfil(userId, dados) {
  if (!userId) { userId = await requireUserId(); }
  const { data, error } = await supabase
    .from('perfil_aluno')
    .update(dados)
    .eq('user_id', userId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

// =============================================
//  LINKS DE MATERIAS
// =============================================

export async function criarLink(dados) {
  const userId = await requireUserId();
  const { data, error } = await supabase
    .from('links_materias')
    .insert([{ ...dados, user_id: userId }])
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function buscarLinks(userId) {
  if (!userId) { userId = await requireUserId(); }
  const { data, error } = await supabase
    .from('links_materias')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data;
}

export async function buscarLinksPorMateria(userId, materia) {
  if (!userId) { userId = await requireUserId(); }
  const { data, error } = await supabase
    .from('links_materias')
    .select('*')
    .eq('user_id', userId)
    .eq('materia', materia)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data;
}

export async function deletarLink(linkId) {
  await requireUserId(); // ensure logged in
  const { error } = await supabase
    .from('links_materias')
    .delete()
    .eq('id', linkId);

  if (error) throw error;
}
