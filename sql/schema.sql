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
  url TEXT NOT NULL,
  tipo TEXT DEFAULT 'artigo',
  descricao TEXT,
  concluido BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),

  CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

-- =============================================
--  INDICES
-- =============================================
CREATE INDEX idx_perfil_user_id ON perfil_aluno(user_id);
CREATE INDEX idx_links_user_id ON links_materias(user_id);
CREATE INDEX idx_links_materia ON links_materias(materia);

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
  USING (auth.uid() = user_id);

CREATE POLICY "Aluno deleta próprios links"
  ON links_materias FOR DELETE
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
