-- =============================================
--  Migration: Blindagem RLS (Fase 1 - estabilizacao)
--
--  Objetivo: garantir que TODAS as tabelas existentes tenham RLS
--  habilitado e que tabelas com `user_id` so permitam ao usuario
--  autenticado ler/inserir/atualizar/deletar suas proprias linhas
--  (auth.uid() = user_id).
--
--  Para tabelas SEM user_id (compartilhadas: planos_mestres,
--  community_plans, usuarios_autorizados), mantemos as policies
--  pre-existentes — nao se aplica a regra de auth.uid().
--
--  Idempotente: pode rodar varias vezes sem erro.
--  Execute no Supabase SQL Editor.
-- =============================================

-- =============================================
--  1. HABILITAR RLS EM TODAS AS TABELAS
-- =============================================
ALTER TABLE public.perfil_aluno         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.links_materias       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.atividades_aluno     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessoes_estudo       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.aulas_materia        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notificacoes_aluno   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usuarios_autorizados ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.planos_mestres       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_plans      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.materia_perfil       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plano_fundo          ENABLE ROW LEVEL SECURITY;

-- =============================================
--  2. POLICIES POR TABELA (auth.uid() = user_id)
--  Tabelas com user_id: o aluno so ve/manipula suas proprias linhas.
-- =============================================

-- ---- perfil_aluno ----
DROP POLICY IF EXISTS "Aluno lê próprio perfil" ON public.perfil_aluno;
DROP POLICY IF EXISTS "Aluno cria próprio perfil" ON public.perfil_aluno;
DROP POLICY IF EXISTS "Aluno atualiza próprio perfil" ON public.perfil_aluno;
DROP POLICY IF EXISTS "Aluno deleta proprio perfil" ON public.perfil_aluno;

CREATE POLICY "Aluno le proprio perfil"      ON public.perfil_aluno
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Aluno cria proprio perfil"    ON public.perfil_aluno
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Aluno atualiza proprio perfil" ON public.perfil_aluno
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Aluno deleta proprio perfil"  ON public.perfil_aluno
  FOR DELETE USING (auth.uid() = user_id);

-- ---- links_materias ----
DROP POLICY IF EXISTS "Aluno lê próprios links" ON public.links_materias;
DROP POLICY IF EXISTS "Aluno cria próprios links" ON public.links_materias;
DROP POLICY IF EXISTS "Aluno atualiza próprios links" ON public.links_materias;
DROP POLICY IF EXISTS "Aluno deleta próprios links" ON public.links_materias;

CREATE POLICY "Aluno le proprios links"      ON public.links_materias
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Aluno cria proprios links"    ON public.links_materias
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Aluno atualiza proprios links" ON public.links_materias
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Aluno deleta proprios links"  ON public.links_materias
  FOR DELETE USING (auth.uid() = user_id);

-- ---- atividades_aluno ----
DROP POLICY IF EXISTS "Aluno lê próprias atividades" ON public.atividades_aluno;
DROP POLICY IF EXISTS "Aluno cria próprias atividades" ON public.atividades_aluno;

CREATE POLICY "Aluno le proprias atividades"   ON public.atividades_aluno
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Aluno cria proprias atividades" ON public.atividades_aluno
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ---- sessoes_estudo ----
DROP POLICY IF EXISTS "Aluno lê próprias sessões" ON public.sessoes_estudo;
DROP POLICY IF EXISTS "Aluno cria próprias sessões" ON public.sessoes_estudo;

CREATE POLICY "Aluno le proprias sessoes"      ON public.sessoes_estudo
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Aluno cria proprias sessoes"    ON public.sessoes_estudo
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Aluno atualiza proprias sessoes" ON public.sessoes_estudo
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Aluno deleta proprias sessoes"  ON public.sessoes_estudo
  FOR DELETE USING (auth.uid() = user_id);

-- ---- aulas_materia ----
DROP POLICY IF EXISTS "Aluno lê próprias aulas" ON public.aulas_materia;
DROP POLICY IF EXISTS "Aluno cria próprias aulas" ON public.aulas_materia;
DROP POLICY IF EXISTS "Aluno atualiza próprias aulas" ON public.aulas_materia;
DROP POLICY IF EXISTS "Aluno deleta próprias aulas" ON public.aulas_materia;

CREATE POLICY "Aluno le proprias aulas"        ON public.aulas_materia
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Aluno cria proprias aulas"      ON public.aulas_materia
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Aluno atualiza proprias aulas"  ON public.aulas_materia
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Aluno deleta proprias aulas"    ON public.aulas_materia
  FOR DELETE USING (auth.uid() = user_id);

-- ---- notificacoes_aluno ----
DROP POLICY IF EXISTS "Aluno le proprias notificacoes" ON public.notificacoes_aluno;
DROP POLICY IF EXISTS "Aluno cria proprias notificacoes" ON public.notificacoes_aluno;
DROP POLICY IF EXISTS "Aluno atualiza proprias notificacoes" ON public.notificacoes_aluno;
DROP POLICY IF EXISTS "Aluno deleta proprias notificacoes" ON public.notificacoes_aluno;

CREATE POLICY "Aluno le proprias notificacoes"      ON public.notificacoes_aluno
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Aluno cria proprias notificacoes"    ON public.notificacoes_aluno
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Aluno atualiza proprias notificacoes" ON public.notificacoes_aluno
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Aluno deleta proprias notificacoes"  ON public.notificacoes_aluno
  FOR DELETE USING (auth.uid() = user_id);

-- ---- materia_perfil ----
DROP POLICY IF EXISTS "Aluno le proprio perfil materia" ON public.materia_perfil;
DROP POLICY IF EXISTS "Aluno cria proprio perfil materia" ON public.materia_perfil;
DROP POLICY IF EXISTS "Aluno atualiza proprio perfil materia" ON public.materia_perfil;
DROP POLICY IF EXISTS "Aluno deleta proprio perfil materia" ON public.materia_perfil;

CREATE POLICY "Aluno le proprio perfil materia"       ON public.materia_perfil
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Aluno cria proprio perfil materia"     ON public.materia_perfil
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Aluno atualiza proprio perfil materia" ON public.materia_perfil
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Aluno deleta proprio perfil materia"   ON public.materia_perfil
  FOR DELETE USING (auth.uid() = user_id);

-- ---- plano_fundo ----
DROP POLICY IF EXISTS "Aluno le proprio plano_fundo" ON public.plano_fundo;
DROP POLICY IF EXISTS "Aluno cria proprio plano_fundo" ON public.plano_fundo;
DROP POLICY IF EXISTS "Aluno atualiza proprio plano_fundo" ON public.plano_fundo;
DROP POLICY IF EXISTS "Aluno deleta proprio plano_fundo" ON public.plano_fundo;

CREATE POLICY "Aluno le proprio plano_fundo"       ON public.plano_fundo
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Aluno cria proprio plano_fundo"     ON public.plano_fundo
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Aluno atualiza proprio plano_fundo" ON public.plano_fundo
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Aluno deleta proprio plano_fundo"   ON public.plano_fundo
  FOR DELETE USING (auth.uid() = user_id);

-- =============================================
--  3. TABELAS SEM user_id (compartilhadas)
--  Policies pre-existentes mantidas. Nao se aplica auth.uid() = user_id.
--
--  - planos_mestres:    leitura aberta para autenticados (ativos=true);
--                       insert/update/delete restrito ao admin.
--  - community_plans:   leitura/insert/update para qualquer autenticado.
--  - usuarios_autorizados: leitura aberta (checagem de whitelist).
-- =============================================

-- =============================================
--  4. GRANTs reforcados (idempotente)
-- =============================================
GRANT ALL ON TABLE public.perfil_aluno         TO postgres, anon, authenticated, service_role;
GRANT ALL ON TABLE public.links_materias       TO postgres, anon, authenticated, service_role;
GRANT ALL ON TABLE public.atividades_aluno     TO postgres, anon, authenticated, service_role;
GRANT ALL ON TABLE public.sessoes_estudo       TO postgres, anon, authenticated, service_role;
GRANT ALL ON TABLE public.aulas_materia        TO postgres, anon, authenticated, service_role;
GRANT ALL ON TABLE public.notificacoes_aluno   TO postgres, anon, authenticated, service_role;
GRANT ALL ON TABLE public.usuarios_autorizados TO postgres, anon, authenticated, service_role;
GRANT ALL ON TABLE public.planos_mestres       TO postgres, anon, authenticated, service_role;
GRANT ALL ON TABLE public.community_plans      TO postgres, anon, authenticated, service_role;
GRANT ALL ON TABLE public.materia_perfil       TO postgres, anon, authenticated, service_role;
GRANT ALL ON TABLE public.plano_fundo          TO postgres, anon, authenticated, service_role;

-- Default privileges para tabelas futuras (rede de seguranca)
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL ON TABLES TO postgres, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL ON SEQUENCES TO postgres, anon, authenticated, service_role;
