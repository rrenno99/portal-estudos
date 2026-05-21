#!/usr/bin/env node
/**
 * scripts/upload-content.js
 *
 * Carrega teoria + questoes da pasta local `conteudo/<subject_slug>/<topic_slug>/`
 * para as tabelas Supabase `topics_content` e `bank_questions`.
 *
 * USAGE
 *   node scripts/upload-content.js                      # default: vendas_e_negociacao
 *   node scripts/upload-content.js outra_materia        # outra subject_slug
 *   node scripts/upload-content.js --dry                # nao escreve no banco, so loga
 *
 * ESTRUTURA ESPERADA
 *   conteudo/
 *     vendas_e_negociacao/
 *       01-conceitos-de-vendas/
 *         teoria.html        (HTML didatico; <h1> usado como topic_name)
 *         questoes.json      (array — schema abaixo)
 *       02-negociacao-estrategica/
 *         teoria.html
 *         questoes.json
 *
 * SCHEMA DO questoes.json
 *   [
 *     {
 *       "banca": "CESGRANRIO",
 *       "question_html": "<p>...</p>",
 *       "options_json": [
 *         {"key": "A", "text": "..."},
 *         {"key": "B", "text": "..."},
 *         ...
 *       ],
 *       "correct_option": "B"
 *     },
 *     ...
 *   ]
 *
 * ENV
 *   SUPABASE_URL                — herdado do .env do projeto
 *   SUPABASE_SERVICE_ROLE_KEY   — service_role (necessario para bypass RLS)
 */

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// =============================================
//  Subject slug -> display name
// =============================================
const SUBJECT_MAP = {
  'vendas_e_negociacao': 'Vendas e Negociação',
  'administracao_geral': 'Administração Geral'
};

// =============================================
//  CLI args
// =============================================
const ARGS = process.argv.slice(2);
const DRY = ARGS.includes('--dry') || ARGS.includes('-n');
const SUBJECT_SLUG = ARGS.find(a => !a.startsWith('-')) || 'vendas_e_negociacao';
const SUBJECT_NAME = SUBJECT_MAP[SUBJECT_SLUG] || prettify(SUBJECT_SLUG);

const CONTENT_ROOT = path.join(__dirname, '..', 'conteudo', SUBJECT_SLUG);

// =============================================
//  Helpers
// =============================================
function prettify(slug) {
  // Convert kebab-case or snake_case to Title Case
  return slug
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase())
    .replace(/\bE\b/g, 'e')   // lowercase common Portuguese conjunctions
    .replace(/\bDe\b/g, 'de')
    .replace(/\bDa\b/g, 'da')
    .replace(/\bDo\b/g, 'do')
    .trim();
}

function extractH1(html) {
  const m = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  if (!m) return null;
  return m[1].replace(/<[^>]+>/g, '').trim();
}

function loadDotEnv() {
  // Lightweight .env loader so we don't depend on the dotenv package
  const envPath = path.join(__dirname, '..', '.env');
  if (!fs.existsSync(envPath)) return;
  const raw = fs.readFileSync(envPath, 'utf-8');
  raw.split(/\r?\n/).forEach(line => {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/i);
    if (!m) return;
    const key = m[1];
    let val = m[2];
    // strip optional quotes
    if (/^".*"$/.test(val) || /^'.*'$/.test(val)) val = val.slice(1, -1);
    if (!(key in process.env)) process.env[key] = val;
  });
}

function safeReadJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch (e) {
    return { __error: e.message };
  }
}

function isValidQuestion(q) {
  if (!q || typeof q !== 'object') return false;
  if (typeof q.question_html !== 'string' || !q.question_html.trim()) return false;
  if (!Array.isArray(q.options_json) || q.options_json.length < 2) return false;
  if (typeof q.correct_option !== 'string' || !q.correct_option.trim()) return false;
  return true;
}

function log(symbol, msg) {
  const stamp = new Date().toISOString().slice(11, 19);
  console.log(`[${stamp}] ${symbol} ${msg}`);
}

// =============================================
//  Main
// =============================================
async function main() {
  loadDotEnv();

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!SUPABASE_URL || !SERVICE_KEY || SERVICE_KEY.startsWith('#')) {
    console.error('✗ SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY sao obrigatorios.');
    console.error('  Configure no .env do projeto e tente novamente.');
    process.exit(1);
  }

  if (!fs.existsSync(CONTENT_ROOT)) {
    console.error(`✗ Pasta nao encontrada: ${CONTENT_ROOT}`);
    console.error('  Crie a estrutura conteudo/<materia_slug>/<topico>/teoria.html e questoes.json');
    process.exit(1);
  }

  log('●', `Subject:  ${SUBJECT_NAME} (slug ${SUBJECT_SLUG})`);
  log('●', `Origem:   ${CONTENT_ROOT}`);
  log('●', `Modo:     ${DRY ? 'DRY-RUN (sem escrita no banco)' : 'WRITE'}`);
  console.log('');

  const supabase = DRY ? null : createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  const topicDirs = fs.readdirSync(CONTENT_ROOT, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name)
    .sort();

  if (topicDirs.length === 0) {
    log('⚠', 'Nenhuma subpasta de topico encontrada.');
    process.exit(0);
  }

  let topicsInsertados = 0;
  let questoesInsertadas = 0;
  let erros = 0;

  for (const slug of topicDirs) {
    const dir = path.join(CONTENT_ROOT, slug);
    const teoriaPath  = path.join(dir, 'teoria.html');
    const questoesPath = path.join(dir, 'questoes.json');

    if (!fs.existsSync(teoriaPath)) {
      log('⚠', `[${slug}] sem teoria.html — pulando.`);
      erros++;
      continue;
    }

    const teoriaHtml = fs.readFileSync(teoriaPath, 'utf-8');
    const topicName = extractH1(teoriaHtml) || prettify(slug.replace(/^\d+[-_]/, ''));

    log('▸', `[${slug}] topic_name="${topicName}"`);

    // ----- Upsert topics_content -----
    let topicId = null;
    if (!DRY) {
      const upsert = await supabase
        .from('topics_content')
        .upsert(
          { subject_name: SUBJECT_NAME, topic_name: topicName, html_body: teoriaHtml },
          { onConflict: 'subject_name,topic_name' }
        )
        .select('id')
        .single();

      if (upsert.error) {
        log('✗', `  topics_content upsert falhou: ${upsert.error.message}`);
        erros++;
        continue;
      }
      topicId = upsert.data.id;
      log('✓', `  topics_content id=${topicId.slice(0,8)}... (${teoriaHtml.length} chars HTML)`);
    } else {
      log('·', `  [DRY] topics_content upsert ${SUBJECT_NAME} / ${topicName} (${teoriaHtml.length} chars)`);
    }
    topicsInsertados++;

    // ----- Bulk insert bank_questions -----
    if (!fs.existsSync(questoesPath)) {
      log('·', `  sem questoes.json — pulando questoes.`);
      continue;
    }
    const parsed = safeReadJson(questoesPath);
    if (parsed.__error || !Array.isArray(parsed)) {
      log('✗', `  questoes.json invalido: ${parsed.__error || 'nao e array'}`);
      erros++;
      continue;
    }

    const rows = parsed.filter(isValidQuestion).map(q => ({
      topic_id: topicId,
      banca: q.banca || null,
      question_html: q.question_html,
      options_json: q.options_json,
      correct_option: q.correct_option
    }));
    const invalidas = parsed.length - rows.length;
    if (invalidas > 0) log('⚠', `  ${invalidas} questao(oes) ignorada(s) por schema invalido.`);

    if (rows.length === 0) {
      log('·', `  nenhuma questao valida para inserir.`);
      continue;
    }

    if (!DRY) {
      // Chunked insert to stay under PostgREST payload limits
      const CHUNK = 100;
      for (let i = 0; i < rows.length; i += CHUNK) {
        const slice = rows.slice(i, i + CHUNK);
        const res = await supabase.from('bank_questions').insert(slice);
        if (res.error) {
          log('✗', `  bank_questions insert falhou (chunk ${i / CHUNK + 1}): ${res.error.message}`);
          erros++;
          break;
        }
      }
      log('✓', `  ${rows.length} questao(oes) inseridas em bank_questions.`);
    } else {
      log('·', `  [DRY] bank_questions insert (${rows.length} linhas)`);
    }
    questoesInsertadas += rows.length;
  }

  console.log('');
  log('●', `Resumo: ${topicsInsertados} topico(s) | ${questoesInsertadas} questao(oes) | ${erros} erro(s)`);

  if (erros > 0) process.exit(2);
}

main().catch(err => {
  console.error('\n✗ Erro inesperado:', err.message);
  process.exit(1);
});
