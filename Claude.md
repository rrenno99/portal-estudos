# Planejador de Estudos SaaS - Guia de Desenvolvimento  

Este documento serve como a fonte da verdade para diretrizes de arquitetura, estilos e comandos do projeto. Siga estas regras rigorosamente em cada sessão de codificação.

---

## 1. Visão Geral do Sistema & Regras de Negócio
O sistema é um planejador de estudos inteligente e gamificado para estudantes e concurseiros.
* **Ciclos de Estudo:** O usuário estuda por ciclos (metas de horas por matéria), e não por horários fixos de calendário.
* **Revisões Espaçadas:** O sistema calcula automaticamente as datas das próximas revisões com base no feedback de retenção do aluno.
* **Gamificação:** Ações como bater metas, concluir sessões de estudo e fazer revisões em dia geram pontos de experiência (XP) e atualizam a sequência (*streak*) diária.

---

## 2. Pilha Tecnológica (Tech Stack)
* **Ambiente:** Node.js (JavaScript/TypeScript)
* **Banco de Dados & Autenticação:** Supabase (utilizando o cliente oficial `@supabase/supabase-js`)
* **Abordagem de Banco:** Consultas e mutações diretas via API do Supabase Client e Políticas de Segurança de Linha (RLS) no banco.

---

## 3. Diretrizes de Arquitetura e Código
* **Isolamento do Supabase:** Toda a lógica de comunicação com o Supabase (queries, inserts, updates) deve ficar centralizada em arquivos de serviço/repositório (ex: `src/services/supabase.js` ou `src/lib/supabaseClient.js`). Nunca espalhe chamadas diretas do cliente de banco pelo código de negócios.
* **Segurança de Dados:** Certifique-se de que o ID do usuário autenticado seja capturado pelo contexto do Supabase em todas as operações que envolvam dados sensíveis ou progresso de estudos.
* **Tratamento de Erros:** Sempre verifique o objeto `{ data, error }` retornado pelas chamadas do Supabase. Erros devem ser capturados e tratados com mensagens claras.

---

## 4. Padrões de Estilo e Convenções de Nomes
* **Nomenclatura do Banco (Supabase):** * Tabelas e colunas sempre em snake_case (`study_sessions`, `user_id`, `subject_cycles`).
* **Nomenclatura do Código:**
  * Arquivos de funções e lógica em camelCase (`studyController.js`, `calculateRevision.js`).
* **Mensagens de Commit:** Siga o padrão de Commits Semânticos (ex: `feat: adiciona integração com tabela de ciclos`, `fix: corrige inserção de logs do supabase`).

---

## 5. Comandos Frequentes do Projeto
* **Instalar Dependências:** `npm install`
* **Iniciar Script/Aplicação:** `npm start` ou `node index.js` (ajustar conforme o script principal que criar)

---

## 6. Fluxo de Trabalho e Segurança contra Regressões
* **Regra de Ouro:** Antes de dar uma tarefa por concluída no Claude Code, execute o script principal para garantir que não há erros de runtime ou falhas de conexão com as chaves do Supabase.
* **Estrutura de Tabelas:** Se precisar que o Claude Code crie ou altere uma tabela, peça para ele gerar o script **SQL correspondente** para que você possa rodar diretamente no SQL Editor do Dashboard do seu Supabase.

---

## 7. Convenção obrigatória de GRANTs (Supabase Data API)

A partir do comunicado oficial do Supabase, **toda nova tabela em `public`** precisa de GRANTs explícitos para que o `@supabase/supabase-js` (PostgREST/Data API) consiga acessá-la. RLS continua sendo a camada de segurança real — os GRANTs apenas expõem a tabela às roles do PostgREST.

**Sempre que gerar um `CREATE TABLE public.x (...)`, adicionar no final do mesmo script:**

```sql
GRANT ALL ON TABLE public.x TO postgres, anon, authenticated, service_role;
-- Se houver coluna SERIAL/BIGSERIAL ou sequence:
GRANT ALL ON SEQUENCE public.x_id_seq TO postgres, anon, authenticated, service_role;
```

Observações:
* No nosso projeto, todas as tabelas usam `UUID DEFAULT gen_random_uuid()` como PK — não há sequences para conceder.
* As GRANTs são idempotentes: rodar de novo não dá erro.
* O arquivo [`sql/migration_grants_data_api.sql`](sql/migration_grants_data_api.sql) aplica todos os GRANTs do banco atual de uma vez, e também define `ALTER DEFAULT PRIVILEGES` para que tabelas futuras já nasçam com as permissões corretas (rede de segurança caso o GRANT seja esquecido em uma migration nova).