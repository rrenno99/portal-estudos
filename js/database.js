import { supabase } from './supabase.js';

// =============================================
//  PERFIL DO ALUNO
// =============================================

export async function criarPerfil(dados) {
  const { data, error } = await supabase
    .from('perfil_aluno')
    .insert([dados])
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function buscarPerfil(userId) {
  const { data, error } = await supabase
    .from('perfil_aluno')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  return data;
}

export async function atualizarPerfil(userId, dados) {
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
  const { data, error } = await supabase
    .from('links_materias')
    .insert([dados])
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function buscarLinks(userId) {
  const { data, error } = await supabase
    .from('links_materias')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data;
}

export async function buscarLinksPorMateria(userId, materia) {
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
  const { error } = await supabase
    .from('links_materias')
    .delete()
    .eq('id', linkId);

  if (error) throw error;
}
