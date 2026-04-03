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
//  1c. EXTRAIR TEXTO POR SECAO DE CARGO
//  Filtra o texto do PDF para a secao do cargo
// =============================================

function filtrarTextoPorCargo(textoCompleto, cargoSelecionado) {
  var linhas = textoCompleto.split(/\n/);
  var cargoLower = cargoSelecionado.toLowerCase();
  var dentroDoBloco = false;
  var textoFiltrado = '';
  var linhasCapturadas = 0;
  var maxLinhas = 500; // Capture up to 500 lines after the cargo header

  for (var i = 0; i < linhas.length; i++) {
    var linha = linhas[i].toLowerCase();

    if (!dentroDoBloco) {
      // Look for the cargo name in the text
      if (linha.indexOf(cargoLower) !== -1) {
        dentroDoBloco = true;
        textoFiltrado += linhas[i] + '\n';
        linhasCapturadas = 1;
      }
    } else {
      // Check if we hit a DIFFERENT cargo section (end of our block)
      var isNewCargoSection = /^\s*(?:cargo|especialidade|area)\s*(?:\d+)?[:\s-]/i.test(linhas[i]);
      if (isNewCargoSection && linhasCapturadas > 10) {
        // Check it's not the same cargo repeated
        if (linha.indexOf(cargoLower) === -1) break;
      }

      textoFiltrado += linhas[i] + '\n';
      linhasCapturadas++;
      if (linhasCapturadas >= maxLinhas) break;
    }
  }

  // If filtered text is too short, fall back to searching around the cargo mention
  if (textoFiltrado.length < 200) {
    textoFiltrado = '';
    for (var i = 0; i < linhas.length; i++) {
      if (linhas[i].toLowerCase().indexOf(cargoLower) !== -1) {
        var start = Math.max(0, i - 5);
        var end = Math.min(linhas.length, i + 200);
        textoFiltrado = linhas.slice(start, end).join('\n');
        break;
      }
    }
  }

  // If still too short, return the full text (better than nothing)
  return textoFiltrado.length > 100 ? textoFiltrado : textoCompleto;
}

// =============================================
//  2. EXTRACAO DE MATERIAS DO EDITAL
// =============================================

// Dicionario de materias comuns em concursos brasileiros
var MATERIAS_CONHECIDAS = [
  { padrao: /l[ií]ngua\s+portugu[eê]sa|portugu[eê]s/i, nome: 'Lingua Portuguesa', topicos: 'Interpretacao, Gramatica, Redacao' },
  { padrao: /l[ií]ngua\s+inglesa|ingl[eê]s/i, nome: 'Lingua Inglesa', topicos: 'Interpretacao de textos em ingles' },
  { padrao: /racioc[ií]nio\s+l[oó]gico|matem[aá]tica|RLM/i, nome: 'Raciocinio Logico', topicos: 'Logica, Probabilidade, Estatistica' },
  { padrao: /direito\s+administrativo/i, nome: 'Direito Administrativo', topicos: 'Atos, Poderes, Licitacoes, Contratos, Lei 14.133' },
  { padrao: /direito\s+constitucional/i, nome: 'Direito Constitucional', topicos: 'CF/88, Direitos Fundamentais, Organizacao do Estado' },
  { padrao: /direito\s+penal/i, nome: 'Direito Penal', topicos: 'Parte Geral, Crimes contra a Administracao' },
  { padrao: /direito\s+processual\s+penal/i, nome: 'Direito Processual Penal', topicos: 'Inquerito, Acao Penal, Provas' },
  { padrao: /direito\s+civil/i, nome: 'Direito Civil', topicos: 'Pessoas, Obrigacoes, Contratos' },
  { padrao: /direito\s+tribut[aá]rio/i, nome: 'Direito Tributario', topicos: 'CTN, Tributos, Credito Tributario' },
  { padrao: /direito\s+do\s+trabalho|direito\s+trabalhista/i, nome: 'Direito do Trabalho', topicos: 'CLT, Contrato, Rescisao' },
  { padrao: /administra[cç][aã]o\s+(p[uú]blica|geral)|gest[aã]o\s+p[uú]blica/i, nome: 'Administracao Publica', topicos: 'Gestao, Planejamento, Governanca' },
  { padrao: /contabilidade|contabil/i, nome: 'Contabilidade', topicos: 'Balancos, DRE, Custos' },
  { padrao: /economia|macroeconomia|microeconomia/i, nome: 'Economia', topicos: 'Micro, Macro, Politica Fiscal' },
  { padrao: /inform[aá]tica|computa[cç][aã]o|TI/i, nome: 'Informatica', topicos: 'SO, Redes, Seguranca, Office' },
  { padrao: /controle\s+externo|auditoria\s+govern/i, nome: 'Controle Externo', topicos: 'Fiscalizacao, TCU, Lei Organica' },
  { padrao: /auditoria(?!\s+govern)/i, nome: 'Auditoria', topicos: 'Normas, Procedimentos, Relatorios' },
  { padrao: /legisla[cç][aã]o\s+(penal\s+)?especial/i, nome: 'Legislacao Especial', topicos: 'Leis Especiais, Estatutos' },
  { padrao: /administra[cç][aã]o\s+financeira|AFO|or[cç]ament/i, nome: 'AFO', topicos: 'LOA, LDO, PPA, Creditos' },
  { padrao: /estat[ií]stica/i, nome: 'Estatistica', topicos: 'Descritiva, Probabilidade, Inferencia' },
  { padrao: /atualidades|conhecimentos\s+gerais/i, nome: 'Atualidades', topicos: 'Cenario politico, economico e social' },
  { padrao: /regimento\s+interno/i, nome: 'Regimento Interno', topicos: 'Normas internas do orgao' },
  { padrao: /[eé]tica|c[oó]digo\s+de\s+conduta/i, nome: 'Etica no Servico Publico', topicos: 'Decreto 1.171, Lei 8.112' },
  { padrao: /redacao|reda[cç][aã]o\s+oficial|discursiva/i, nome: 'Redacao Oficial', topicos: 'Manual de Redacao, Padroes' },
];

function extrairMateriasDoTexto(texto) {
  var encontradas = [];
  var nomesJaAdicionados = new Set();

  MATERIAS_CONHECIDAS.forEach(function(m) {
    if (m.padrao.test(texto) && !nomesJaAdicionados.has(m.nome)) {
      encontradas.push({ nome: m.nome, topicos: m.topicos });
      nomesJaAdicionados.add(m.nome);
    }
  });

  return encontradas;
}

// Tenta extrair data da prova do texto
function extrairDataProva(texto) {
  // Patterns: DD/MM/YYYY, DD de MES de YYYY
  var match = texto.match(/(\d{1,2})\s*[\/\-]\s*(\d{1,2})\s*[\/\-]\s*(20\d{2})/);
  if (match) {
    var d = match[1], m = match[2], y = match[3];
    var date = new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
    if (date > new Date()) return date.toISOString().split('T')[0];
  }
  return null;
}

// Tenta extrair numero de questoes por materia
function extrairPesosPorMateria(texto, materias) {
  var pesos = {};
  materias.forEach(function(m) {
    // Look for patterns like "Direito Administrativo ... 10 questões" or "peso 2"
    var escapedName = m.nome.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    var pesoMatch = texto.match(new RegExp(escapedName + '[^\\d]*?(\\d+)\\s*quest', 'i'));
    if (pesoMatch) {
      pesos[m.nome] = parseInt(pesoMatch[1]);
    } else {
      var pesoMatch2 = texto.match(new RegExp(escapedName + '[^\\d]*?peso\\s*(\\d+)', 'i'));
      if (pesoMatch2) {
        pesos[m.nome] = parseInt(pesoMatch2[1]);
      }
    }
  });
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

// Export for use in criar-plano.html
window.MentorIA = {
  gerarPlanoInteligente: gerarPlanoInteligente,
  extrairTextoPDF: extrairTextoPDF,
  extrairCargos: extrairCargos,
  filtrarTextoPorCargo: filtrarTextoPorCargo,
  extrairMateriasDoTexto: extrairMateriasDoTexto,
  extrairPesosPorMateria: extrairPesosPorMateria,
  extrairDataProva: extrairDataProva,
  classificarMaterias: classificarMaterias,
  distribuirHoras: distribuirHoras,
  gerarCiclo: gerarCiclo
};
