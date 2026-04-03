-- =============================================
--  TABELA: perfil_aluno
--  Dados do perfil de cada aluno
-- =============================================
CREATE TABLE perfil_aluno (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  nome TEXT NOT NULL,
  email TEXT NOT NULL,
  telefone TEXT,
  concurso TEXT,
  nivel TEXT,
  data_prova DATE,
  horas_semanais INTEGER DEFAULT 20,
  turno_preferido TEXT DEFAULT 'Manhã',
  dia_descanso TEXT DEFAULT 'Domingo',
  foto_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================
--  TABELA: links_materias
--  Links de estudo vinculados ao aluno
-- =============================================
CREATE TABLE links_materias (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  materia TEXT NOT NULL,
  titulo TEXT NOT NULL,
  url TEXT DEFAULT '',
  tipo TEXT DEFAULT 'artigo',
  descricao TEXT,
  concluido BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),

  CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

-- =============================================
--  TABELA: atividades_aluno
--  Feed de atividades recentes do aluno
-- =============================================
CREATE TABLE atividades_aluno (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  tipo_evento TEXT NOT NULL CHECK (tipo_evento IN ('aula_concluida', 'tempo_estudo', 'meta_atingida', 'plano_criado', 'aula_iniciada')),
  descricao TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_atividades_user_id ON atividades_aluno(user_id);
CREATE INDEX idx_atividades_created ON atividades_aluno(user_id, created_at DESC);

ALTER TABLE atividades_aluno ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Aluno lê próprias atividades" ON atividades_aluno FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Aluno cria próprias atividades" ON atividades_aluno FOR INSERT WITH CHECK (auth.uid() = user_id);

-- =============================================
--  TABELA: sessoes_estudo
--  Cronômetro de tempo por sessão de estudo
-- =============================================
CREATE TABLE sessoes_estudo (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  materia TEXT NOT NULL,
  tempo_segundos INTEGER NOT NULL DEFAULT 0,
  data_inicio TIMESTAMPTZ DEFAULT now(),
  status TEXT DEFAULT 'concluido' CHECK (status IN ('concluido', 'cancelado'))
);

CREATE INDEX idx_sessoes_user_id ON sessoes_estudo(user_id);

ALTER TABLE sessoes_estudo ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Aluno lê próprias sessões" ON sessoes_estudo FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Aluno cria próprias sessões" ON sessoes_estudo FOR INSERT WITH CHECK (auth.uid() = user_id);

-- =============================================
--  TABELA: aulas_materia
--  Progresso individual de cada aula por matéria
--  status: 'pendente' | 'estudando' | 'concluido'
-- =============================================
CREATE TABLE aulas_materia (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  materia TEXT NOT NULL,
  numero INTEGER NOT NULL,
  titulo TEXT DEFAULT '',
  status TEXT DEFAULT 'pendente' CHECK (status IN ('pendente', 'estudando', 'concluido')),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================
--  INDICES
-- =============================================
CREATE INDEX idx_perfil_user_id ON perfil_aluno(user_id);
CREATE INDEX idx_links_user_id ON links_materias(user_id);
CREATE INDEX idx_links_materia ON links_materias(materia);
CREATE INDEX idx_aulas_user_id ON aulas_materia(user_id);
CREATE INDEX idx_aulas_materia ON aulas_materia(user_id, materia);

-- =============================================
--  ROW LEVEL SECURITY (RLS)
--  Cada aluno só acessa seus próprios dados
-- =============================================
ALTER TABLE perfil_aluno ENABLE ROW LEVEL SECURITY;
ALTER TABLE links_materias ENABLE ROW LEVEL SECURITY;

-- perfil_aluno: leitura e escrita apenas para o próprio usuário
CREATE POLICY "Aluno lê próprio perfil"
  ON perfil_aluno FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Aluno cria próprio perfil"
  ON perfil_aluno FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Aluno atualiza próprio perfil"
  ON perfil_aluno FOR UPDATE
  USING (auth.uid() = user_id);

-- links_materias: CRUD apenas para o próprio usuário
CREATE POLICY "Aluno lê próprios links"
  ON links_materias FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Aluno cria próprios links"
  ON links_materias FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Aluno atualiza próprios links"
  ON links_materias FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Aluno deleta próprios links"
  ON links_materias FOR DELETE
  USING (auth.uid() = user_id);

-- aulas_materia: CRUD apenas para o próprio usuário
ALTER TABLE aulas_materia ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Aluno lê próprias aulas"
  ON aulas_materia FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Aluno cria próprias aulas"
  ON aulas_materia FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Aluno atualiza próprias aulas"
  ON aulas_materia FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Aluno deleta próprias aulas"
  ON aulas_materia FOR DELETE
  USING (auth.uid() = user_id);

-- =============================================
--  TRIGGER: auto-update updated_at
-- =============================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER perfil_aluno_updated_at
  BEFORE UPDATE ON perfil_aluno
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER aulas_materia_updated_at
  BEFORE UPDATE ON aulas_materia
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- =============================================
--  CAMPO: pontos em perfil_aluno
--  Sistema de creditos por tempo estudado
-- =============================================
ALTER TABLE perfil_aluno ADD COLUMN IF NOT EXISTS pontos INTEGER DEFAULT 0;

-- =============================================
--  TABELA: notificacoes_aluno
--  Notificacoes do sistema para o aluno
-- =============================================
CREATE TABLE notificacoes_aluno (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  texto TEXT NOT NULL,
  lida BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_notificacoes_user_id ON notificacoes_aluno(user_id, created_at DESC);

ALTER TABLE notificacoes_aluno ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Aluno le proprias notificacoes" ON notificacoes_aluno FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Aluno cria proprias notificacoes" ON notificacoes_aluno FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Aluno atualiza proprias notificacoes" ON notificacoes_aluno FOR UPDATE USING (auth.uid() = user_id);

-- =============================================
--  TABELA: usuarios_autorizados
--  Lista de e-mails com acesso permitido
-- =============================================
CREATE TABLE usuarios_autorizados (
  email TEXT PRIMARY KEY
);

-- Qualquer usuário autenticado pode consultar se seu e-mail está na lista
ALTER TABLE usuarios_autorizados ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Qualquer um pode verificar autorização"
  ON usuarios_autorizados FOR SELECT
  USING (true);
