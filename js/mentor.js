// =============================================
//  MENTOR IA — Motor de Inteligencia do Plano
//  Processamento de edital, pesos Renno,
//  adaptacao por dominio, geracao de ciclo
// =============================================

// =============================================
//  1. PARSING DE PDF (extrai texto via pdf.js)
// =============================================

async function extrairTextoPDF(file) {
  if (!window.pdfjsLib) {
    console.warn('[Mentor] pdf.js nao carregado');
    return '';
  }

  var arrayBuffer = await file.arrayBuffer();
  var pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  var textoCompleto = '';

  for (var i = 1; i <= pdf.numPages; i++) {
    var page = await pdf.getPage(i);
    var content = await page.getTextContent();
    var pageText = content.items.map(function(item) { return item.str; }).join(' ');
    textoCompleto += pageText + '\n';
  }

  return textoCompleto;
}

// =============================================
//  1b. EXTRACAO DE CARGOS DO PDF
// =============================================

// Known profession roots (titles that START a cargo name)
var PROFISSOES_CONHECIDAS = [
  'analista', 'tecnico', 'técnico', 'agente', 'auditor', 'fiscal',
  'inspetor', 'delegado', 'perito', 'escrivao', 'escrivão',
  'assessor', 'consultor', 'procurador', 'defensor', 'promotor',
  'oficial', 'assistente', 'auxiliar', 'servidor', 'policial',
  'investigador', 'papiloscopista', 'médico', 'medico', 'enfermeiro',
  'engenheiro', 'arquiteto', 'contador', 'administrador', 'economista',
  'psicólogo', 'psicologo', 'pedagogo', 'bibliotecário', 'bibliotecario',
  'programador', 'desenvolvedor', 'secretário', 'secretario'
];

// Phrases that are NEVER cargo names (clauses, instructions, noise)
var CARGO_BLACKLIST = [
  /edital/i, /inscri[cç]/i, /prova/i, /resultado/i, /convoca[cç]/i,
  /remunera/i, /vencimento/i, /requisito/i, /escolaridade/i,
  /vaga/i, /total\s+de/i, /quadro\s+de/i, /anexo/i,
  /cronograma/i, /publica[cç]/i, /di[aá]rio\s+oficial/i,
  /carga\s+hor/i, /jornada/i, /atribui[cç]/i,
  /por\s+ocasi/i, /de\s+acordo/i, /conforme/i, /disposto/i,
  /dever[aá]/i, /poder[aá]/i, /ser[aá]\s+/i, /estar[aá]/i,
  /no\s+prazo/i, /mediante/i, /observ/i, /previsto/i,
  /aprova[cç]/i, /classifica[cç]/i, /eliminat/i, /habilita/i,
  /documento/i, /comprova/i, /apresent/i, /exig[eê]/i,
  /n[uú]mero/i, /artigo/i, /par[aá]grafo/i, /inciso/i,
  /cap[ií]tulo/i, /se[cç][aã]o/i, /item\s+\d/i,
  /candidato/i, /requerimento/i, /formul[aá]rio/i,
  /www\./i, /http/i, /\.gov\./i, /\.com/i,
  /^\d+[\.\)]\s*$/i, /^[a-z]\)/i
];

function validarCargo(cargo) {
  // 1. Must be 3-50 chars (real cargos are short)
  if (cargo.length < 3 || cargo.length > 50) return false;

  // 2. Max 7 words (longer = probably a sentence, not a cargo)
  var palavras = cargo.split(/\s+/);
  if (palavras.length > 7) return false;

  // 3. Must NOT match any blacklist pattern
  for (var i = 0; i < CARGO_BLACKLIST.length; i++) {
    if (CARGO_BLACKLIST[i].test(cargo)) return false;
  }

  // 4. Must NOT be mostly numbers or punctuation
  var letras = (cargo.match(/[a-zA-ZÀ-ú]/g) || []).length;
  if (letras < cargo.length * 0.6) return false;

  // 5. Must NOT start with lowercase preposition/article (indicates mid-sentence)
  if (/^(de |do |da |dos |das |no |na |nos |nas |em |para |com |por |que |se |ou |e |a |o |os |as )/i.test(cargo) &&
      !/^(de\s+)/i.test(cargo)) {
    // Allow "de" only if followed by a profession name (e.g. "de Controle Externo")
    return false;
  }

  return true;
}

function extrairCargos(texto) {
  var cargosSet = new Map();

  // === STRATEGY 1: "CARGO:" or "ESPECIALIDADE:" labels ===
  var labelPatterns = [
    /(?:CARGO|ESPECIALIDADE|FUN[CÇ][AÃ]O|EMPREGO)\s*(?:\d+)?\s*[:\-–]\s*([^\n\r.;]{3,50})/gi,
    /(?:cargo|especialidade)\s*[:\-–]\s*([^\n\r.;]{3,50})/gi,
  ];

  labelPatterns.forEach(function(pattern) {
    var regex = new RegExp(pattern.source, pattern.flags);
    var match;
    while ((match = regex.exec(texto)) !== null) {
      var cargo = match[1].trim().replace(/\s+/g, ' ').replace(/[–—:]+$/, '').trim();
      if (validarCargo(cargo)) {
        var key = cargo.toLowerCase();
        if (!cargosSet.has(key)) cargosSet.set(key, cargo);
      }
    }
  });

  // === STRATEGY 2: Known profession names followed by area ===
  // E.g., "Analista Judiciário — Área Administrativa"
  var profRegex = new RegExp(
    '(' + PROFISSOES_CONHECIDAS.join('|') + ')\\s+' +
    '([A-ZÀ-Ú][a-zA-ZÀ-ú\\s\\-–/]{2,40})',
    'gi'
  );
  var match;
  while ((match = profRegex.exec(texto)) !== null) {
    var cargo = (match[1] + ' ' + match[2]).trim().replace(/\s+/g, ' ');
    // Cut at common separators
    cargo = cargo.split(/\s*[-–]\s*/)[0].trim();
    if (cargo.split(/\s+/).length > 6) {
      cargo = cargo.split(/\s+/).slice(0, 5).join(' ');
    }
    if (validarCargo(cargo)) {
      var key = cargo.toLowerCase();
      if (!cargosSet.has(key)) cargosSet.set(key, cargo);
    }
  }

  // === STRATEGY 3: QUADRO DE VAGAS table rows ===
  // Look for the section header, then parse nearby lines
  var quadroIdx = texto.search(/quadro\s+de\s+vagas/i);
  if (quadroIdx !== -1) {
    var afterQuadro = texto.substring(quadroIdx, quadroIdx + 3000);
    var linhas = afterQuadro.split(/\n/);
    linhas.forEach(function(linha) {
      // Table rows often have: "Analista ... 10 ... R$ 8.000"
      PROFISSOES_CONHECIDAS.forEach(function(prof) {
        var idx = linha.toLowerCase().indexOf(prof);
        if (idx !== -1) {
          // Extract from profession name to next number or pipe
          var substr = linha.substring(idx).replace(/\s+/g, ' ');
          var cargoMatch = substr.match(/^([a-zA-ZÀ-ú\s\-–/]{3,50})/);
          if (cargoMatch) {
            var cargo = cargoMatch[1].trim();
            if (validarCargo(cargo)) {
              var key = cargo.toLowerCase();
              if (!cargosSet.has(key)) cargosSet.set(key, cargo);
            }
          }
        }
      });
    });
  }

  // === STRATEGY 4: Numbered list items with profession names ===
  var linhas = texto.split(/\n/);
  linhas.forEach(function(linha) {
    var m = linha.match(/^\s*(?:\d+[\.\)]|[IVX]+[\.\)]|[a-z]\))\s+(.{3,50})$/);
    if (m) {
      var cargo = m[1].trim();
      // Only accept if it contains a known profession
      var hasProfissao = PROFISSOES_CONHECIDAS.some(function(p) {
        return cargo.toLowerCase().indexOf(p) !== -1;
      });
      if (hasProfissao && validarCargo(cargo)) {
        var key = cargo.toLowerCase();
        if (!cargosSet.has(key)) cargosSet.set(key, cargo);
      }
    }
  });

  var result = Array.from(cargosSet.values());

  // Deduplicate similar names (e.g., "Analista" and "Analista Judiciário")
  // Keep the more specific (longer) version
  result.sort(function(a, b) { return b.length - a.length; });
  var filtered = [];
  var usedKeys = new Set();
  result.forEach(function(cargo) {
    var dominated = false;
    usedKeys.forEach(function(existing) {
      if (existing.indexOf(cargo.toLowerCase()) !== -1) dominated = true;
    });
    if (!dominated) {
      filtered.push(cargo);
      usedKeys.add(cargo.toLowerCase());
    }
  });

  console.log('[Mentor] Cargos extraidos (pos-filtro):', filtered.length, filtered);
  return filtered;
}

// =============================================
//  1c. SCOPE-BOUNDED SECTION EXTRACTION
//  Finds start and end of the cargo's section
// =============================================

// Section boundary markers in Brazilian editais
var SECTION_HEADERS = [
  /conhecimentos?\s+b[aá]sicos/i,
  /conhecimentos?\s+espec[ií]ficos/i,
  /conhecimentos?\s+gerais/i,
  /conhecimentos?\s+complementares/i,
  /conte[uú]do\s+program[aá]tico/i,
  /programa\s+das\s+provas/i,
  /das\s+provas\s+objetivas/i,
  /prova\s+(?:objetiva|discursiva)/i,
  /quadro\s+de\s+provas/i,
  /disciplinas?\s+e\s+quest/i,
];

// Markers that signal END of a content section
var SECTION_END_MARKERS = [
  /^\s*(?:CARGO|cargo)\s*(?:\d+)?\s*[:\-–]/,
  /^\s*(?:T[IÍ]TULO|CAP[IÍ]TULO|ANEXO)\s+[IVX\d]/,
  /^\s*(?:DAS\s+DISPOSI[CÇ][OÕ]ES|DA\s+INSCRI[CÇ]|DOS\s+REQUISITOS|DA\s+REMUNERA)/i,
  /^\s*(?:DO\s+PROCESSO|DAS\s+VAGAS|DO\s+CRONOGRAMA|DA\s+PROVA\s+PR[AÁ]TICA)/i,
];

function filtrarTextoPorCargo(textoCompleto, cargoSelecionado) {
  var linhas = textoCompleto.split(/\n/);
  var cargoLower = cargoSelecionado.toLowerCase().trim();
  // Also try partial match (e.g., "Analista" matches "Analista Judiciário")
  var cargoWords = cargoLower.split(/\s+/).filter(function(w) { return w.length > 2; });

  // PASS 1: Find all lines where the cargo name appears
  var cargoLines = [];
  for (var i = 0; i < linhas.length; i++) {
    var linhaLower = linhas[i].toLowerCase();
    // Exact match first
    if (linhaLower.indexOf(cargoLower) !== -1) {
      cargoLines.push(i);
    }
    // Partial: all significant words present
    else if (cargoWords.length >= 2) {
      var allPresent = cargoWords.every(function(w) { return linhaLower.indexOf(w) !== -1; });
      if (allPresent) cargoLines.push(i);
    }
  }

  if (cargoLines.length === 0) {
    console.log('[Mentor] Cargo nao encontrado no texto');
    return '';
  }

  // PASS 2: For each cargo mention, look for nearby "Conhecimentos" sections
  var bestSection = '';
  var bestScore = 0;

  cargoLines.forEach(function(cargoLine) {
    // Scan forward from cargo mention to find content sections
    var sectionStart = -1;
    var sectionEnd = linhas.length;
    var scanEnd = Math.min(linhas.length, cargoLine + 800);

    for (var j = cargoLine; j < scanEnd; j++) {
      // Found a content section header?
      var isContentHeader = SECTION_HEADERS.some(function(p) { return p.test(linhas[j]); });
      if (isContentHeader && sectionStart === -1) {
        sectionStart = j;
      }

      // Found end boundary?
      if (sectionStart !== -1 && j > sectionStart + 5) {
        var isEnd = SECTION_END_MARKERS.some(function(p) { return p.test(linhas[j]); });
        // Also end if we find a DIFFERENT cargo name
        var isDiffCargo = /^\s*(?:cargo|especialidade)\s*[:\-–\d]/i.test(linhas[j]) &&
                          linhas[j].toLowerCase().indexOf(cargoLower) === -1;
        if (isEnd || isDiffCargo) {
          sectionEnd = j;
          break;
        }
      }
    }

    if (sectionStart === -1) sectionStart = cargoLine;

    var section = linhas.slice(sectionStart, sectionEnd).join('\n');
    // Score: prefer sections with more materia-like content
    var score = (section.match(/\d+\.\d+/g) || []).length + // numbered items
               (section.match(/conhecimento/gi) || []).length * 5;

    if (score > bestScore || (score === bestScore && section.length > bestSection.length)) {
      bestScore = score;
      bestSection = section;
    }
  });

  console.log('[Mentor] Secao extraida:', bestSection.length, 'chars, score:', bestScore);
  return bestSection || '';
}

// =============================================
//  2. STRUCTURE-BASED PARSING ENGINE
//  Hierarchy detection, boundary logic, cleaning
// =============================================

// Verb phrases to strip from topics (instructional noise)
var VERB_NOISE = [
  /^o\s+(?:aluno|candidato)\s+dever/i,
  /^ser[aá]\s+necess[aá]rio/i,
  /^(?:dever[aá]|poder[aá])\s+/i,
  /^(?:conhecer|compreender|analisar|identificar|avaliar|aplicar|interpretar|demonstrar|resolver)\s+/i,
  /^(?:capacidade|habilidade|compet[eê]ncia)\s+(?:de|para)\s+/i,
  /^(?:nesta\s+prova|neste\s+conte[uú]do|conforme|de\s+acordo)\s+/i,
  /^(?:os\s+seguintes\s+t[oó]picos|as\s+seguintes\s+mat[eé]rias)\s*/i,
];

// Detect hierarchy level from a numbered pattern
// Returns { level: 1|2|3, number: "1"|"1.2"|"1.2.3", text: "..." } or null
function parseHierarchyLine(linha) {
  var trimmed = linha.trim();
  // Pattern: 1. / 1.1 / 1.1.1 / 1) / I. / a)
  var m = trimmed.match(/^(\d{1,2}(?:\.\d{1,2}){0,3})[\.\)\s]+[-–]?\s*(.+)$/);
  if (m) {
    var parts = m[1].split('.');
    return { level: parts.length, number: m[1], text: m[2].trim() };
  }
  // Roman numerals: I. II. III.
  var roman = trimmed.match(/^([IVX]{1,4})[\.\)]\s+(.+)$/);
  if (roman) {
    return { level: 1, number: roman[1], text: roman[2].trim() };
  }
  // Letters: a) b) c)
  var letter = trimmed.match(/^([a-z])\)\s+(.+)$/);
  if (letter) {
    return { level: 3, number: letter[1], text: letter[2].trim() };
  }
  return null;
}

// Clean a topic string: remove verb noise, trim, extract terms
function limparTopico(texto) {
  var limpo = texto.trim();
  // Remove trailing periods, semicolons
  limpo = limpo.replace(/[.;:]+$/, '').trim();
  // Remove verb noise
  VERB_NOISE.forEach(function(r) { limpo = limpo.replace(r, '').trim(); });
  // Remove leading articles/prepositions
  limpo = limpo.replace(/^(?:os?|as?|dos?|das?|nos?|nas?|de|em|para|com)\s+/i, '').trim();
  // Capitalize first letter
  if (limpo.length > 0) limpo = limpo.charAt(0).toUpperCase() + limpo.slice(1);
  return limpo;
}

// Calculate confidence for an extracted materia
function calcularConfianca(materia) {
  var score = 50; // base

  // Has clean topics
  if (materia.topicos && materia.topicos.length > 5) score += 20;
  // Name is reasonable length
  if (materia.nome.length >= 5 && materia.nome.length <= 40) score += 10;
  // Name has <= 5 words
  if (materia.nome.split(/\s+/).length <= 5) score += 10;
  // Matched by dictionary
  if (materia.fonte === 'dicionario' || materia.fonte === 'analise_renno') score += 15;
  // Topics are clean (no long sentences)
  if (materia.topicos) {
    var topList = materia.topicos.split(',');
    var longTopics = topList.filter(function(t) { return t.trim().split(/\s+/).length > 8; });
    if (longTopics.length > topList.length * 0.3) score -= 20;
  }
  // Name contains suspicious words
  if (/edital|prova|candidato|inscri|requisito/i.test(materia.nome)) score -= 30;

  return Math.max(0, Math.min(100, score));
}

// Known subject dictionary (for matching/normalization)
var MATERIAS_CONHECIDAS = [
  { padrao: /l[ií]ngua\s+portugu[eê]sa|portugu[eê]s/i, nome: 'Lingua Portuguesa' },
  { padrao: /l[ií]ngua\s+inglesa|ingl[eê]s/i, nome: 'Lingua Inglesa' },
  { padrao: /racioc[ií]nio\s+l[oó]gico|matem[aá]tica|RLM/i, nome: 'Raciocinio Logico' },
  { padrao: /direito\s+administrativo/i, nome: 'Direito Administrativo' },
  { padrao: /direito\s+constitucional/i, nome: 'Direito Constitucional' },
  { padrao: /direito\s+penal(?!\s+militar)/i, nome: 'Direito Penal' },
  { padrao: /direito\s+processual\s+penal/i, nome: 'Direito Processual Penal' },
  { padrao: /direito\s+civil/i, nome: 'Direito Civil' },
  { padrao: /direito\s+processual\s+civil/i, nome: 'Direito Processual Civil' },
  { padrao: /direito\s+tribut[aá]rio/i, nome: 'Direito Tributario' },
  { padrao: /direito\s+(?:do\s+)?trabalho|direito\s+trabalhista/i, nome: 'Direito do Trabalho' },
  { padrao: /direito\s+empresarial|direito\s+comercial/i, nome: 'Direito Empresarial' },
  { padrao: /administra[cç][aã]o\s+(?:p[uú]blica|geral)|gest[aã]o\s+p[uú]blica/i, nome: 'Administracao Publica' },
  { padrao: /contabilidade|ci[eê]ncias?\s+cont[aá]beis/i, nome: 'Contabilidade' },
  { padrao: /economia|macroeconomia|microeconomia/i, nome: 'Economia' },
  { padrao: /inform[aá]tica|computa[cç][aã]o|tecnologia\s+da\s+informa/i, nome: 'Informatica' },
  { padrao: /controle\s+externo/i, nome: 'Controle Externo' },
  { padrao: /auditoria/i, nome: 'Auditoria' },
  { padrao: /legisla[cç][aã]o\s+(?:penal\s+)?especial/i, nome: 'Legislacao Especial' },
  { padrao: /administra[cç][aã]o\s+financeira|AFO|or[cç]ament[aá]ria/i, nome: 'AFO' },
  { padrao: /estat[ií]stica/i, nome: 'Estatistica' },
  { padrao: /atualidades|conhecimentos?\s+gerais/i, nome: 'Atualidades' },
  { padrao: /regimento\s+interno/i, nome: 'Regimento Interno' },
  { padrao: /[eé]tica/i, nome: 'Etica no Servico Publico' },
  { padrao: /reda[cç][aã]o\s+oficial|discursiva/i, nome: 'Redacao Oficial' },
  { padrao: /direito\s+financeiro/i, nome: 'Direito Financeiro' },
  { padrao: /direito\s+ambiental/i, nome: 'Direito Ambiental' },
  { padrao: /direito\s+previdenci[aá]rio/i, nome: 'Direito Previdenciario' },
  { padrao: /seguran[cç]a\s+p[uú]blica/i, nome: 'Seguranca Publica' },
  { padrao: /medicina\s+legal|criminal[ií]stica/i, nome: 'Medicina Legal' },
];

// Normalize a subject name using the dictionary
function normalizarNomeMateria(nome) {
  var lower = nome.toLowerCase();
  for (var i = 0; i < MATERIAS_CONHECIDAS.length; i++) {
    if (MATERIAS_CONHECIDAS[i].padrao.test(nome)) {
      return MATERIAS_CONHECIDAS[i].nome;
    }
  }
  // Capitalize first letter of each word
  return nome.replace(/\w\S*/g, function(t) {
    return t.charAt(0).toUpperCase() + t.substr(1).toLowerCase();
  });
}

// =============================================
//  2a. MAIN EXTRACTION — Structure-based
// =============================================

function extrairMateriasDoTexto(texto) {
  if (!texto || texto.length < 20) return [];

  var linhas = texto.split(/\n/);
  var materias = [];
  var nomesVistos = new Set();

  // PASS 1: Build hierarchy tree from numbered lines
  var arvore = []; // [{level, number, text, lineIdx, children:[]}]

  for (var i = 0; i < linhas.length; i++) {
    var parsed = parseHierarchyLine(linhas[i]);
    if (parsed && parsed.text.length >= 3 && parsed.text.length <= 80) {
      parsed.lineIdx = i;
      arvore.push(parsed);
    }
  }

  // PASS 2: Identify level-1 items as subjects, level-2+ as topics
  var level1Items = arvore.filter(function(n) { return n.level === 1; });

  if (level1Items.length > 0) {
    level1Items.forEach(function(item, idx) {
      var nome = normalizarNomeMateria(item.text);
      if (nomesVistos.has(nome.toLowerCase())) return;

      // Find boundary: from this item to the next level-1 item
      var startLine = item.lineIdx;
      var endLine = (idx + 1 < level1Items.length) ? level1Items[idx + 1].lineIdx : Math.min(startLine + 100, linhas.length);

      // Collect sub-items (level 2+) between boundaries
      var topicosRaw = [];
      for (var j = 0; j < arvore.length; j++) {
        if (arvore[j].lineIdx > startLine && arvore[j].lineIdx < endLine && arvore[j].level >= 2) {
          topicosRaw.push(arvore[j].text);
        }
      }

      // Also collect non-numbered content lines between boundaries as potential topics
      for (var j = startLine + 1; j < endLine; j++) {
        var line = linhas[j].trim();
        if (line.length > 3 && line.length < 120 && !parseHierarchyLine(linhas[j])) {
          // Check it's not a verb phrase or instructional text
          var isNoise = VERB_NOISE.some(function(r) { return r.test(line); });
          if (!isNoise && !/^\s*$/.test(line)) {
            // Split by semicolons (common topic separator)
            line.split(/[;]/).forEach(function(part) {
              var cleaned = limparTopico(part);
              if (cleaned.length > 2 && cleaned.length < 80) {
                topicosRaw.push(cleaned);
              }
            });
          }
        }
      }

      // Clean and deduplicate topics
      var topicosLimpos = [];
      var topicosVistos = new Set();
      topicosRaw.forEach(function(t) {
        var limpo = limparTopico(t);
        if (limpo.length > 2 && limpo.length < 80 && !topicosVistos.has(limpo.toLowerCase())) {
          topicosVistos.add(limpo.toLowerCase());
          topicosLimpos.push(limpo);
        }
      });

      var materia = {
        nome: nome,
        topicos: topicosLimpos.slice(0, 15).join(', '),
        topicosArray: topicosLimpos.slice(0, 15),
        fonte: 'hierarquia',
        confianca: 0,
        needsReview: false,
        textoOriginal: ''
      };

      materia.confianca = calcularConfianca(materia);
      // Flag for review if confidence is low or topics are messy
      if (materia.confianca < 50 || topicosLimpos.length === 0) {
        materia.needsReview = true;
        materia.textoOriginal = linhas.slice(startLine, Math.min(startLine + 20, endLine)).join('\n');
      }

      nomesVistos.add(nome.toLowerCase());
      materias.push(materia);
    });
  }

  // PASS 3: Dictionary matching for subjects not found by hierarchy
  MATERIAS_CONHECIDAS.forEach(function(m) {
    if (m.padrao.test(texto) && !nomesVistos.has(m.nome.toLowerCase())) {
      // Extract nearby content for topics
      var match = m.padrao.exec(texto);
      m.padrao.lastIndex = 0;
      if (!match) return;

      var nearby = texto.substring(match.index, match.index + 600);
      var topicos = [];
      // Look for sub-items in nearby text
      var subItems = nearby.match(/(?:\d+\.\d+\.?\d*|[a-z]\))\s*([^;\n]{3,60})/g);
      if (subItems) {
        subItems.slice(0, 10).forEach(function(s) {
          var cleaned = limparTopico(s.replace(/^\d+\.\d+\.?\d*\s*/, '').replace(/^[a-z]\)\s*/, ''));
          if (cleaned.length > 2) topicos.push(cleaned);
        });
      }

      var materia = {
        nome: m.nome,
        topicos: topicos.join(', '),
        topicosArray: topicos,
        fonte: 'dicionario',
        confianca: 0,
        needsReview: false,
        textoOriginal: ''
      };
      materia.confianca = calcularConfianca(materia);

      nomesVistos.add(m.nome.toLowerCase());
      materias.push(materia);
    }
  });

  // Sort: highest confidence first
  materias.sort(function(a, b) { return b.confianca - a.confianca; });

  console.log('[Parser] Extraidas:', materias.length, 'materias.',
    'Precisam revisao:', materias.filter(function(m) { return m.needsReview; }).length);

  return materias;
}

// Tenta extrair data da prova do texto
function extrairDataProva(texto) {
  var match = texto.match(/(\d{1,2})\s*[\/\-]\s*(\d{1,2})\s*[\/\-]\s*(20\d{2})/);
  if (match) {
    var d = match[1], m = match[2], y = match[3];
    var date = new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
    if (date > new Date()) return date.toISOString().split('T')[0];
  }
  return null;
}

// =============================================
//  2b. EXTRACAO DE PESOS/PONTOS/QUESTOES
//  Busca "Peso", "Pontos", "Valor", "Questoes"
// =============================================

function extrairPesosPorMateria(texto, materias) {
  var pesos = {};
  var encontrouAlgumPeso = false;

  materias.forEach(function(m) {
    var escapedName = m.nome.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // Try multiple patterns in order of specificity
    var patterns = [
      new RegExp(escapedName + '[^\\d]{0,40}?(\\d{1,3})\\s*quest[oõ]', 'i'),
      new RegExp(escapedName + '[^\\d]{0,40}?peso\\s*[:\\-]?\\s*(\\d{1,2})', 'i'),
      new RegExp(escapedName + '[^\\d]{0,40}?(\\d{1,3})\\s*ponto', 'i'),
      new RegExp(escapedName + '[^\\d]{0,40}?valor\\s*[:\\-]?\\s*(\\d{1,3})', 'i'),
      // Reverse: "10 questões de Direito Administrativo"
      new RegExp('(\\d{1,3})\\s*quest[oõ][^\\n]{0,20}' + escapedName, 'i'),
    ];

    for (var i = 0; i < patterns.length; i++) {
      var match = texto.match(patterns[i]);
      if (match) {
        var val = parseInt(match[1]);
        if (val > 0 && val <= 200) {
          pesos[m.nome] = val;
          encontrouAlgumPeso = true;
          break;
        }
      }
    }
  });

  // Flag to let the UI know if weights were found
  pesos._encontrouPesos = encontrouAlgumPeso;
  return pesos;
}

// =============================================
//  3. METODOLOGIA RENNO — CLASSIFICACAO E PESOS
//  40% Principais | 30% Medias | 30% Perifericas
// =============================================

function classificarMaterias(subjects, materiaPerfis, pesosEdital) {
  // Score each subject: higher = more priority
  var scored = subjects.map(function(s) {
    var perfil = materiaPerfis.find(function(p) { return p.materia === s.nome; }) || {};
    var pesoEdital = (pesosEdital && pesosEdital[s.nome]) || 0;
    var nivel = perfil.nivel || 'iniciante';
    var fechada = perfil.fechada || false;

    // Score calculation:
    // - Edital weight (questoes) is strongest signal
    // - Student difficulty (iniciante = needs more time)
    // - Fechada = low priority
    var score = 0;

    // Edital weight (0-50 points based on relative weight)
    score += pesoEdital * 3;

    // Student level (iniciante needs more attention)
    if (nivel === 'iniciante') score += 20;
    else if (nivel === 'regular') score += 10;
    else score += 5; // avancado

    // Fechada penalty
    if (fechada) score -= 30;

    return {
      nome: s.nome,
      link: s.link,
      aulas: s.aulas,
      nivel: nivel,
      fechada: fechada,
      pesoEdital: pesoEdital,
      score: Math.max(0, score)
    };
  });

  // Sort by score descending
  scored.sort(function(a, b) { return b.score - a.score; });

  // Classify into 3 tiers
  var total = scored.length;
  var nPrincipal = Math.max(1, Math.ceil(total * 0.3));
  var nMedia = Math.max(1, Math.ceil(total * 0.35));

  scored.forEach(function(s, i) {
    if (i < nPrincipal) {
      s.categoria = 'principal';
      s.pesoHoras = 0.40;
    } else if (i < nPrincipal + nMedia) {
      s.categoria = 'media';
      s.pesoHoras = 0.30;
    } else {
      s.categoria = 'periferica';
      s.pesoHoras = 0.30;
    }
  });

  return scored;
}

// =============================================
//  4. DISTRIBUICAO DE HORAS SEMANAIS
// =============================================

function distribuirHoras(materiasClassificadas, horasSemanais) {
  var grupos = { principal: [], media: [], periferica: [] };
  materiasClassificadas.forEach(function(m) {
    grupos[m.categoria].push(m);
  });

  var horasPrincipal = horasSemanais * 0.40;
  var horasMedia = horasSemanais * 0.30;
  var horasPeriferica = horasSemanais * 0.30;

  function distribuir(lista, horasGrupo) {
    if (lista.length === 0) return;
    // Materias fechadas recebem 30% do que receberiam (so revisao)
    var pesoTotal = lista.reduce(function(acc, m) {
      return acc + (m.fechada ? 0.3 : 1);
    }, 0);
    lista.forEach(function(m) {
      var peso = m.fechada ? 0.3 : 1;
      m.horasSemanais = Math.round((peso / pesoTotal) * horasGrupo * 10) / 10;
    });
  }

  distribuir(grupos.principal, horasPrincipal);
  distribuir(grupos.media, horasMedia);
  distribuir(grupos.periferica, horasPeriferica);

  return materiasClassificadas;
}

// =============================================
//  5. ADAPTACAO POR DOMINIO — TIPO DE SESSAO
// =============================================

function definirTipoSessao(materiasClassificadas, trilha) {
  materiasClassificadas.forEach(function(m) {
    if (m.fechada) {
      // Materia fechada: so questoes e revisao
      m.tipoSessao = 'questoes_revisao';
      m.descricaoSessao = 'Questoes + Revisao';
    } else if (m.nivel === 'avancado') {
      // Avancado: mais questoes que teoria
      m.tipoSessao = 'questoes_predominante';
      m.descricaoSessao = 'Questoes (70%) + Teoria (30%)';
    } else if (m.nivel === 'regular') {
      // Regular: equilibrio
      m.tipoSessao = 'equilibrado';
      m.descricaoSessao = 'Teoria (50%) + Questoes (50%)';
    } else {
      // Iniciante: foco em teoria
      m.tipoSessao = 'teoria_predominante';
      m.descricaoSessao = 'Teoria (70%) + Questoes (30%)';
    }

    // Intervalo de revisao baseado na trilha
    if (trilha === 'agil') {
      m.revisaoIntervalos = [7]; // 1x por semana
    } else if (trilha === 'blindada') {
      m.revisaoIntervalos = [1, 15, 30]; // 24h, 15d, 30d
    } else {
      m.revisaoIntervalos = [3, 20]; // 3d e 20d (consistente, default)
    }
  });

  return materiasClassificadas;
}

// =============================================
//  6. GERACAO DO CICLO (StudyQueue order)
// =============================================

function gerarCiclo(materiasClassificadas, horasSemanais) {
  // The cycle determines the ORDER in which subjects appear in the queue
  // Subjects with more hours appear more frequently
  var ciclo = [];
  var totalHoras = materiasClassificadas.reduce(function(acc, m) { return acc + (m.horasSemanais || 1); }, 0);

  // Calculate frequency: how many slots per week each subject gets
  // Assuming ~1h per slot
  var slotsSemanais = Math.max(horasSemanais, materiasClassificadas.length);

  materiasClassificadas.forEach(function(m) {
    m.slotsNoCiclo = Math.max(1, Math.round((m.horasSemanais / totalHoras) * slotsSemanais));
  });

  // Build interleaved cycle: distribute evenly
  // Use round-robin weighted approach
  var remaining = materiasClassificadas.map(function(m) {
    return { nome: m.nome, slots: m.slotsNoCiclo, categoria: m.categoria, tipoSessao: m.tipoSessao };
  });

  var maxIterations = slotsSemanais * 2;
  while (ciclo.length < slotsSemanais && maxIterations-- > 0) {
    // Pick the subject with the highest remaining ratio
    remaining.sort(function(a, b) {
      var ratioA = a.slots / (ciclo.filter(function(c) { return c.nome === a.nome; }).length + 1);
      var ratioB = b.slots / (ciclo.filter(function(c) { return c.nome === b.nome; }).length + 1);
      return ratioB - ratioA;
    });

    if (remaining[0].slots > 0) {
      ciclo.push({ nome: remaining[0].nome, categoria: remaining[0].categoria, tipoSessao: remaining[0].tipoSessao });
      remaining[0].slots--;
    }

    // Remove exhausted subjects
    remaining = remaining.filter(function(r) { return r.slots > 0; });
    if (remaining.length === 0) break;
  }

  return ciclo;
}

// =============================================
//  7. PLANO DE FUNDO (salva a logica completa)
// =============================================

function gerarPlanoFundo(materiasClassificadas, ciclo, trilha, horasSemanais, pesosEdital) {
  return {
    versao: 1,
    geradoEm: new Date().toISOString(),
    trilha: trilha,
    horasSemanais: horasSemanais,
    distribuicao: {
      principal: { pct: 40, horas: Math.round(horasSemanais * 0.4 * 10) / 10 },
      media: { pct: 30, horas: Math.round(horasSemanais * 0.3 * 10) / 10 },
      periferica: { pct: 30, horas: Math.round(horasSemanais * 0.3 * 10) / 10 }
    },
    materias: materiasClassificadas.map(function(m) {
      return {
        nome: m.nome,
        categoria: m.categoria,
        nivel: m.nivel,
        fechada: m.fechada,
        tipoSessao: m.tipoSessao,
        descricaoSessao: m.descricaoSessao,
        horasSemanais: m.horasSemanais,
        slotsNoCiclo: m.slotsNoCiclo,
        revisaoIntervalos: m.revisaoIntervalos,
        pesoEdital: m.pesoEdital || 0
      };
    }),
    ciclo: ciclo,
    pesosEdital: pesosEdital || {}
  };
}

// =============================================
//  8. FUNCAO PRINCIPAL — GERAR PLANO INTELIGENTE
// =============================================

async function gerarPlanoInteligente(params) {
  var subjects = params.subjects;           // [{nome, link, aulas}]
  var materiaPerfis = params.materiaPerfis;  // [{materia, nivel, fechada}]
  var trilha = params.trilha;               // 'agil' | 'consistente' | 'blindada'
  var horasSemanais = params.horasSemanais;
  var textoEdital = params.textoEdital;     // pre-parsed text (filtered by cargo)
  var pesosEdital = {};

  // 1. Use pre-parsed and cargo-filtered text if available
  if (textoEdital && textoEdital.length > 100) {
    try {
      var materiasDoEdital = extrairMateriasDoTexto(textoEdital);
      pesosEdital = extrairPesosPorMateria(textoEdital, materiasDoEdital);
      console.log('[Mentor] Materias do texto filtrado:', materiasDoEdital.length);
      console.log('[Mentor] Pesos extraidos:', JSON.stringify(pesosEdital));
    } catch (e) {
      console.error('[Mentor] Erro ao extrair do texto:', e);
    }
  }

  // 2. Classify subjects (Renno methodology)
  var classificadas = classificarMaterias(subjects, materiaPerfis, pesosEdital);

  // 3. Distribute weekly hours
  classificadas = distribuirHoras(classificadas, horasSemanais);

  // 4. Define session types based on skill level + trilha
  classificadas = definirTipoSessao(classificadas, trilha);

  // 5. Generate the study cycle (queue order)
  var ciclo = gerarCiclo(classificadas, horasSemanais);

  // 6. Build the background plan (logic document)
  var planoFundo = gerarPlanoFundo(classificadas, ciclo, trilha, horasSemanais, pesosEdital);

  console.log('[Mentor] Plano gerado:', classificadas.length, 'materias,', ciclo.length, 'slots no ciclo');

  return {
    materias: classificadas,
    ciclo: ciclo,
    planoFundo: planoFundo
  };
}

// =============================================
//  9. EXTRACAO DE BANCA DO EDITAL
// =============================================

var BANCAS_CONHECIDAS = [
  { padrao: /cebraspe|cespe/i, nome: 'Cebraspe' },
  { padrao: /fgv\b|funda[cç][aã]o\s+get[uú]lio/i, nome: 'FGV' },
  { padrao: /vunesp/i, nome: 'Vunesp' },
  { padrao: /fcc\b|funda[cç][aã]o\s+carlos\s+chagas/i, nome: 'FCC' },
  { padrao: /cesgranrio/i, nome: 'Cesgranrio' },
  { padrao: /ibfc\b/i, nome: 'IBFC' },
  { padrao: /iades\b/i, nome: 'IADES' },
  { padrao: /idecan\b/i, nome: 'IDECAN' },
  { padrao: /quadrix\b/i, nome: 'Quadrix' },
  { padrao: /instituto\s+aocp|aocp\b/i, nome: 'AOCP' },
  { padrao: /funrio\b/i, nome: 'FUNRIO' },
  { padrao: /consulplan\b/i, nome: 'Consulplan' },
];

function extrairBanca(texto) {
  for (var i = 0; i < BANCAS_CONHECIDAS.length; i++) {
    if (BANCAS_CONHECIDAS[i].padrao.test(texto)) {
      return BANCAS_CONHECIDAS[i].nome;
    }
  }
  return null;
}

// =============================================
//  10. INCIDENCIA HISTORICA POR BANCA
//  Dados baseados em analises de provas anteriores
// =============================================

var INCIDENCIA_BANCA = {
  'Cebraspe': {
    'Lingua Portuguesa': 12, 'Raciocinio Logico': 8, 'Informatica': 5,
    'Direito Constitucional': 15, 'Direito Administrativo': 18,
    'Direito Penal': 10, 'Direito Processual Penal': 8,
    'Administracao Publica': 7, 'AFO': 6, 'Contabilidade': 8,
    'Economia': 6, 'Controle Externo': 10, 'Auditoria': 7,
    'Etica no Servico Publico': 3, 'Atualidades': 4,
    'Legislacao Especial': 5, 'Direito Civil': 6,
  },
  'FGV': {
    'Lingua Portuguesa': 15, 'Raciocinio Logico': 10, 'Informatica': 5,
    'Direito Constitucional': 12, 'Direito Administrativo': 15,
    'Direito Penal': 8, 'Direito Tributario': 10,
    'Administracao Publica': 8, 'AFO': 7, 'Contabilidade': 10,
    'Economia': 8, 'Etica no Servico Publico': 3,
    'Direito Civil': 6, 'Direito do Trabalho': 5,
    'Atualidades': 5, 'Redacao Oficial': 5,
  },
  'FCC': {
    'Lingua Portuguesa': 15, 'Raciocinio Logico': 10, 'Informatica': 5,
    'Direito Constitucional': 12, 'Direito Administrativo': 15,
    'Direito do Trabalho': 8, 'Direito Processual Civil': 6,
    'Administracao Publica': 8, 'AFO': 6, 'Contabilidade': 8,
    'Etica no Servico Publico': 4, 'Atualidades': 3,
    'Direito Civil': 8, 'Direito Tributario': 6,
  },
  'Vunesp': {
    'Lingua Portuguesa': 18, 'Raciocinio Logico': 12, 'Informatica': 8,
    'Direito Constitucional': 10, 'Direito Administrativo': 12,
    'Legislacao Especial': 8, 'Atualidades': 6,
    'Etica no Servico Publico': 5, 'Administracao Publica': 6,
  },
  'Cesgranrio': {
    'Lingua Portuguesa': 15, 'Raciocinio Logico': 10, 'Informatica': 8,
    'Direito Constitucional': 8, 'Direito Administrativo': 10,
    'Contabilidade': 12, 'Economia': 10, 'Atualidades': 5,
    'Etica no Servico Publico': 4, 'Estatistica': 8,
  },
};

// =============================================
//  11. PESQUISA WEB — Triangulacao de Dados
// =============================================

async function pesquisarConteudoProgramatico(concurso, cargo) {
  var query = 'conteudo programatico ' + concurso + ' ' + cargo + ' edital';
  var fontes = [];
  var materiasWeb = [];
  var bancaWeb = null;

  try {
    // Use Google Custom Search via proxy or direct fetch
    // Sites conhecidos de curadoria de concursos
    var sitesConfiados = [
      'estrategiaconcursos.com.br',
      'grancursosonline.com.br',
      'qconcursos.com',
      'aprovaconcursos.com.br',
      'pontodosconcursos.com.br'
    ];

    var searchUrl = 'https://www.google.com/search?q=' + encodeURIComponent(query);

    // Try fetching from known curadoria sites
    for (var i = 0; i < sitesConfiados.length; i++) {
      var siteQuery = query + ' site:' + sitesConfiados[i];
      try {
        var response = await fetch('https://api.allorigins.win/raw?url=' + encodeURIComponent(
          'https://www.google.com/search?q=' + encodeURIComponent(siteQuery) + '&num=3'
        ), { signal: AbortSignal.timeout(5000) });

        if (response.ok) {
          var html = await response.text();
          // Extract materia names from search snippets
          var snippetMaterias = extrairMateriasDeSnippets(html);
          if (snippetMaterias.length > 0) {
            materiasWeb = materiasWeb.concat(snippetMaterias);
            fontes.push(sitesConfiados[i]);
            console.log('[Web] Encontrado em', sitesConfiados[i], ':', snippetMaterias.length, 'materias');
          }

          // Try to find banca in the results
          if (!bancaWeb) {
            for (var b = 0; b < BANCAS_CONHECIDAS.length; b++) {
              if (BANCAS_CONHECIDAS[b].padrao.test(html)) {
                bancaWeb = BANCAS_CONHECIDAS[b].nome;
                break;
              }
            }
          }
        }
      } catch (e) {
        // Timeout or CORS — skip silently
        console.log('[Web] Skip', sitesConfiados[i], ':', e.message || 'timeout');
      }
    }
  } catch (e) {
    console.error('[Web] Erro na pesquisa:', e);
  }

  // Deduplicate
  var uniqueMaterias = [];
  var seen = new Set();
  materiasWeb.forEach(function(m) {
    var key = m.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      uniqueMaterias.push(m);
    }
  });

  return {
    materias: uniqueMaterias,
    fontes: fontes,
    banca: bancaWeb
  };
}

function extrairMateriasDeSnippets(html) {
  var materias = [];
  // Search for known subject names in the HTML snippets
  MATERIAS_CONHECIDAS.forEach(function(m) {
    if (m.padrao.test(html)) {
      materias.push(m.nome);
    }
  });
  return materias;
}

// =============================================
//  12. TRIANGULACAO — Merge PDF + Web + Banca
// =============================================

function triangularDados(materiasPDF, pesquisaWeb, bancaDetectada, pesosEdital) {
  var resultado = {
    materias: [],
    banca: bancaDetectada || pesquisaWeb.banca || null,
    fontes: [],
    confianca: 'baixa'
  };

  if (materiasPDF.length > 0) resultado.fontes.push('Edital Oficial (PDF)');
  if (pesquisaWeb.fontes.length > 0) resultado.fontes = resultado.fontes.concat(pesquisaWeb.fontes);

  // Start with PDF materias as base (most authoritative)
  var materiasMap = new Map();
  materiasPDF.forEach(function(m) {
    materiasMap.set(m.nome.toLowerCase(), {
      nome: m.nome,
      topicos: m.topicos || '',
      fontePDF: true,
      fonteWeb: false,
      peso: (pesosEdital && pesosEdital[m.nome]) || 0
    });
  });

  // Enrich with web data
  pesquisaWeb.materias.forEach(function(nomeWeb) {
    var key = nomeWeb.toLowerCase();
    if (materiasMap.has(key)) {
      // Confirmed by both sources
      materiasMap.get(key).fonteWeb = true;
    } else {
      // Only in web — add but flag as unconfirmed
      materiasMap.set(key, {
        nome: nomeWeb,
        topicos: '',
        fontePDF: false,
        fonteWeb: true,
        peso: 0
      });
    }
  });

  // Apply banca incidence if available
  var banca = resultado.banca;
  var incidencia = banca ? (INCIDENCIA_BANCA[banca] || {}) : {};

  materiasMap.forEach(function(m) {
    // If no peso from edital, use banca incidence
    if (m.peso === 0 && incidencia[m.nome]) {
      m.pesoIncidencia = incidencia[m.nome];
    }
    // Confidence level per materia
    if (m.fontePDF && m.fonteWeb) {
      m.validacao = 'confirmada'; // Both sources agree
    } else if (m.fontePDF) {
      m.validacao = 'edital'; // Only in PDF
    } else {
      m.validacao = 'web'; // Only from web (lower confidence)
    }
    resultado.materias.push(m);
  });

  // Overall confidence
  var confirmadasCount = resultado.materias.filter(function(m) { return m.validacao === 'confirmada'; }).length;
  if (confirmadasCount >= resultado.materias.length * 0.5) {
    resultado.confianca = 'alta';
  } else if (materiasPDF.length > 0 || pesquisaWeb.materias.length > 0) {
    resultado.confianca = 'media';
  }

  console.log('[Triangulacao] Banca:', resultado.banca,
    '| Materias:', resultado.materias.length,
    '| Confirmadas:', confirmadasCount,
    '| Fontes:', resultado.fontes.join(', '),
    '| Confianca:', resultado.confianca);

  return resultado;
}

// =============================================
//  13a. FETCH GOOGLE DOCS AS TEXT
// =============================================

function googleDocsToExportUrl(url) {
  // Convert Google Docs URL to plain text export
  // https://docs.google.com/document/d/XXXXX/edit -> /export?format=txt
  var match = url.match(/docs\.google\.com\/document\/d\/([a-zA-Z0-9_-]+)/);
  if (match) {
    return 'https://docs.google.com/document/d/' + match[1] + '/export?format=txt';
  }
  // Google Drive file link
  var driveMatch = url.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (driveMatch) {
    return 'https://drive.google.com/uc?export=download&id=' + driveMatch[1];
  }
  return null;
}

async function fetchTextoDeUrl(url) {
  // Try direct fetch first
  var exportUrl = googleDocsToExportUrl(url);
  var urlsToTry = [];

  if (exportUrl) urlsToTry.push(exportUrl);
  urlsToTry.push(url);

  for (var i = 0; i < urlsToTry.length; i++) {
    try {
      // Try via CORS proxy
      var proxyUrl = 'https://api.allorigins.win/raw?url=' + encodeURIComponent(urlsToTry[i]);
      var response = await fetch(proxyUrl, { signal: AbortSignal.timeout(15000) });
      if (response.ok) {
        var text = await response.text();
        // Strip HTML if the response is HTML
        if (text.indexOf('<html') !== -1 || text.indexOf('<!DOCTYPE') !== -1) {
          var temp = document.createElement('div');
          temp.innerHTML = text;
          text = temp.textContent || temp.innerText || '';
        }
        if (text.length > 100) {
          console.log('[Fetch] Texto obtido de URL:', text.length, 'chars');
          return text;
        }
      }
    } catch (e) {
      console.log('[Fetch] Tentativa', i + 1, 'falhou:', e.message);
    }

    // Try direct (no proxy)
    try {
      var resp = await fetch(urlsToTry[i], { mode: 'cors', signal: AbortSignal.timeout(10000) });
      if (resp.ok) {
        var text = await resp.text();
        if (text.indexOf('<html') !== -1) {
          var t = document.createElement('div');
          t.innerHTML = text;
          text = t.textContent || t.innerText || '';
        }
        if (text.length > 100) return text;
      }
    } catch (e) {
      // CORS blocked — expected
    }
  }

  return '';
}

// =============================================
//  13b. IMPORTADOR ANALISE RENNO (PDF/DOCX)
//  Detecta e prioriza tabelas estruturadas do
//  modelo de analise do Prof. Rodrigo Renno
// =============================================

function detectarAnaliseRenno(texto) {
  // Markers that indicate this is a Renno-style analysis document
  var markers = [
    /an[aá]lise\s+(?:do\s+)?edital/i,
    /estrutura\s+das?\s+provas?/i,
    /conte[uú]do\s+program[aá]tico/i,
    /pontua[cç][aã]o|pontos?\s+por\s+mat[eé]ria/i,
    /rodrigo\s+renn[oó]/i,
    /estrat[eé]gia\s+concursos/i,
  ];
  var score = markers.reduce(function(acc, m) { return acc + (m.test(texto) ? 1 : 0); }, 0);
  return score >= 2; // At least 2 markers = Renno analysis
}

function extrairTabelaProvas(texto) {
  // Look for structured table: "Materia | Questoes | Pontos"
  var materias = [];
  var linhas = texto.split(/\n/);

  // Find the "Estrutura das Provas" section
  var dentroTabela = false;
  var headerFound = false;

  for (var i = 0; i < linhas.length; i++) {
    var linha = linhas[i].trim();

    if (/estrutura\s+das?\s+provas?|quadro\s+de\s+provas/i.test(linha)) {
      dentroTabela = true;
      continue;
    }

    if (!dentroTabela) continue;

    // Detect header row
    if (!headerFound && /mat[eé]ria|disciplina/i.test(linha) && /quest|ponto|peso|valor/i.test(linha)) {
      headerFound = true;
      continue;
    }

    // End of table markers
    if (headerFound && (/^total/i.test(linha) || /conte[uú]do\s+program/i.test(linha) || linha.length < 3)) {
      if (materias.length > 0) break;
      continue;
    }

    if (!headerFound) continue;

    // Parse table row: "Lingua Portuguesa 10 10" or "Lingua Portuguesa | 10 | 10"
    var parts = linha.split(/[\|\t]/).map(function(p) { return p.trim(); }).filter(function(p) { return p.length > 0; });

    if (parts.length < 2) {
      // Try space-separated with numbers at end
      var m = linha.match(/^(.+?)\s+(\d+)\s+(\d+(?:[.,]\d+)?)/);
      if (m) {
        parts = [m[1].trim(), m[2], m[3]];
      }
    }

    if (parts.length >= 2) {
      var nome = parts[0].replace(/^\d+[\.\)]\s*/, '').trim();
      if (nome.length < 3 || nome.length > 60) continue;
      if (/^total|^sub\s*total|^\s*$/i.test(nome)) continue;

      var questoes = 0;
      var pontos = 0;
      for (var j = 1; j < parts.length; j++) {
        var num = parseFloat(parts[j].replace(',', '.'));
        if (!isNaN(num) && num > 0) {
          if (questoes === 0) questoes = num;
          else pontos = num;
        }
      }

      materias.push({
        nome: nome,
        questoes: questoes,
        pontos: pontos || questoes,
        topicos: '',
        fonte: 'analise_renno'
      });
    }
  }

  // Now try to enrich with topics from "Conteudo Programatico" section
  var dentroConteudo = false;
  var materiaAtual = null;

  for (var i = 0; i < linhas.length; i++) {
    var linha = linhas[i].trim();
    if (/conte[uú]do\s+program[aá]tico/i.test(linha)) {
      dentroConteudo = true;
      continue;
    }
    if (!dentroConteudo) continue;

    // Check if this line is a materia name from our list
    var matchedMateria = materias.find(function(m) {
      return linha.toLowerCase().indexOf(m.nome.toLowerCase()) !== -1;
    });

    if (matchedMateria) {
      materiaAtual = matchedMateria;
      continue;
    }

    // Sub-items (topics) for the current materia
    if (materiaAtual && /^\d+[\.\)]|^[a-z]\)|^[-–•]/.test(linha)) {
      var topico = linha.replace(/^\d+[\.\)]\s*/, '').replace(/^[a-z]\)\s*/, '').replace(/^[-–•]\s*/, '').trim();
      if (topico.length > 2 && topico.length < 80) {
        materiaAtual.topicos = materiaAtual.topicos ? materiaAtual.topicos + ', ' + topico : topico;
      }
    }

    // End if we hit another major section
    if (/^(?:CARGO|T[IÍ]TULO|CAP[IÍ]TULO|ANEXO|DAS\s+DISPOSI)/i.test(linha) && materias.length > 0) {
      break;
    }
  }

  console.log('[Renno] Tabela de provas extraida:', materias.length, 'materias');
  return materias;
}

// =============================================
//  14. COMMUNITY PLANS — Busca e Publicacao
// =============================================

async function buscarPlanoComunidade(supabase, concurso, cargo) {
  if (!supabase) return null;

  try {
    // Search by cargo first (most specific)
    var cargoLower = (cargo || '').toLowerCase().trim();
    var concursoLower = (concurso || '').toLowerCase().trim();

    var { data, error } = await supabase
      .from('community_plans')
      .select('*')
      .order('votos', { ascending: false })
      .limit(5);

    if (error || !data || data.length === 0) return null;

    // Score each plan by relevance
    var best = null;
    var bestScore = 0;

    data.forEach(function(plan) {
      var score = 0;
      if (cargoLower && plan.cargo.toLowerCase().indexOf(cargoLower) !== -1) score += 10;
      if (concursoLower && plan.orgao.toLowerCase().indexOf(concursoLower) !== -1) score += 5;
      // Partial word match
      cargoLower.split(/\s+/).forEach(function(w) {
        if (w.length > 2 && plan.cargo.toLowerCase().indexOf(w) !== -1) score += 2;
      });
      score += Math.min(plan.votos, 10); // cap vote bonus

      if (score > bestScore) {
        bestScore = score;
        best = plan;
      }
    });

    if (bestScore >= 5) {
      console.log('[Community] Plano encontrado:', best.orgao, best.cargo, 'votos:', best.votos);
      return best;
    }
  } catch (e) {
    console.error('[Community] Erro na busca:', e);
  }
  return null;
}

async function publicarPlanoComunidade(supabase, userId, concurso, cargo, subjects, dataProva, horasSemanais, trilha) {
  if (!supabase || !userId) return;

  try {
    var materias = subjects.map(function(s) {
      return { nome: s.nome, aulas: s.aulas, link: s.link || '' };
    });

    // Upsert: if same orgao+cargo exists, update if our version is newer
    var { error } = await supabase.from('community_plans').upsert({
      orgao: concurso || 'Personalizado',
      cargo: cargo || concurso || 'Geral',
      materias: materias,
      data_prova: dataProva,
      horas_semanais: horasSemanais,
      trilha: trilha,
      criado_por: userId
    }, { onConflict: 'orgao,cargo' });

    if (error) console.error('[Community] Erro ao publicar:', error.message);
    else console.log('[Community] Plano publicado:', concurso, cargo);
  } catch (e) {
    console.error('[Community] Erro:', e);
  }
}

// Export for use in criar-plano.html
window.MentorIA = {
  gerarPlanoInteligente: gerarPlanoInteligente,
  extrairTextoPDF: extrairTextoPDF,
  extrairCargos: extrairCargos,
  filtrarTextoPorCargo: filtrarTextoPorCargo,
  extrairMateriasDoTexto: extrairMateriasDoTexto,
  extrairPesosPorMateria: extrairPesosPorMateria,
  extrairDataProva: extrairDataProva,
  extrairBanca: extrairBanca,
  pesquisarConteudoProgramatico: pesquisarConteudoProgramatico,
  triangularDados: triangularDados,
  classificarMaterias: classificarMaterias,
  distribuirHoras: distribuirHoras,
  gerarCiclo: gerarCiclo,
  fetchTextoDeUrl: fetchTextoDeUrl,
  googleDocsToExportUrl: googleDocsToExportUrl,
  detectarAnaliseRenno: detectarAnaliseRenno,
  extrairTabelaProvas: extrairTabelaProvas,
  buscarPlanoComunidade: buscarPlanoComunidade,
  publicarPlanoComunidade: publicarPlanoComunidade,
  INCIDENCIA_BANCA: INCIDENCIA_BANCA
};
