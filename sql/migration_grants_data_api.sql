-- =============================================
--  Migration: Data API GRANTs para todas as tabelas
--
--  A partir do comunicado oficial do Supabase, toda tabela em public
--  precisa de GRANTs explicitos para que o @supabase/supabase-js
--  consiga acessa-la via Data API (PostgREST).
--
--  RLS continua sendo a camada de seguranca real — esses GRANTs apenas
--  expoem as tabelas para as roles `anon` e `authenticated`.
--
--  Rode este script UMA VEZ no Supabase SQL Editor para regularizar
--  o banco atual. Para tabelas futuras, ja deixei o GRANT no proprio
--  arquivo de migration que cria a tabela.
-- =============================================

-- Schema principal (schema.sql)
GRANT ALL ON TABLE public.perfil_aluno         TO postgres, anon, authenticated, service_role;
GRANT ALL ON TABLE public.links_materias       TO postgres, anon, authenticated, service_role;
GRANT ALL ON TABLE public.atividades_aluno     TO postgres, anon, authenticated, service_role;
GRANT ALL ON TABLE public.sessoes_estudo       TO postgres, anon, authenticated, service_role;
GRANT ALL ON TABLE public.aulas_materia        TO postgres, anon, authenticated, service_role;
GRANT ALL ON TABLE public.notificacoes_aluno   TO postgres, anon, authenticated, service_role;
GRANT ALL ON TABLE public.usuarios_autorizados TO postgres, anon, authenticated, service_role;

-- Migrations posteriores
GRANT ALL ON TABLE public.community_plans      TO postgres, anon, authenticated, service_role;
GRANT ALL ON TABLE public.planos_mestres       TO postgres, anon, authenticated, service_role;
GRANT ALL ON TABLE public.materia_perfil       TO postgres, anon, authenticated, service_role;
GRANT ALL ON TABLE public.plano_fundo          TO postgres, anon, authenticated, service_role;

-- =============================================
--  Default privileges para tabelas FUTURAS criadas em public
--  (Reduz a chance de esquecer GRANT em uma nova tabela.)
-- =============================================
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL ON TABLES TO postgres, anon, authenticated, service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL ON SEQUENCES TO postgres, anon, authenticated, service_role;
