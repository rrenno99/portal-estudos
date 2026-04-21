-- =============================================
--  Migration: REVERT material_link em aulas_materia
--
--  Decisao revisada: o link do material pertence a MATERIA, nao a aula.
--  Todas as aulas da mesma materia compartilham o mesmo link, que ja
--  existe na tabela links_materias.
--
--  Se voce rodou a versao anterior desta migration (que adicionou a
--  coluna material_link em aulas_materia), execute o comando abaixo
--  para remove-la. Caso contrario, ignore este arquivo.
--
--  Execute no Supabase SQL Editor:
-- =============================================

ALTER TABLE aulas_materia
  DROP COLUMN IF EXISTS material_link;
