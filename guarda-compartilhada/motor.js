/*
 * Motor de regras da guarda compartilhada.
 *
 * Convenção: cada dia do calendário indica com quem a criança PERNOITA
 * naquela noite. Datas são tratadas como números de dia (UTC) para evitar
 * problemas de fuso e horário de verão.
 *
 * Funciona no navegador (window.GuardaMotor) e no Node (require).
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.GuardaMotor = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var DIA_MS = 86400000;
  var DIAS_SEMANA = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];
  var MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

  var REGIMES = {
    fins_de_semana_alternados: 'Fins de semana alternados',
    semanas_alternadas: 'Semanas alternadas',
    '2-2-5-5': '2-2-5-5',
    '2-2-3': '2-2-3'
  };

  // Prioridade das exceções: a maior prevalece.
  var PRIORIDADE = { base: 0, ferias: 1, feriado: 2, comemorativa: 3, natal: 4 };

  // ---------- utilidades de data ----------

  function dn(ano, mes, dia) { return Date.UTC(ano, mes - 1, dia) / DIA_MS; }
  function parseISO(s) {
    var p = String(s).split('-').map(Number);
    return dn(p[0], p[1], p[2]);
  }
  function iso(n) { return new Date(n * DIA_MS).toISOString().slice(0, 10); }
  function partes(n) {
    var d = new Date(n * DIA_MS);
    return { ano: d.getUTCFullYear(), mes: d.getUTCMonth() + 1, dia: d.getUTCDate() };
  }
  function br(n) {
    var p = partes(n);
    return pad(p.dia) + '/' + pad(p.mes) + '/' + p.ano;
  }
  function pad(x) { return (x < 10 ? '0' : '') + x; }
  function mod(a, b) { return ((a % b) + b) % b; }
  function diaSemana(n) { return mod(n + 4, 7); } // 01/01/1970 foi quinta-feira
  function semanaSeg(n) { return Math.floor((n + 3) / 7); } // semana iniciada na segunda
  function outro(g) { return g === 'A' ? 'B' : 'A'; }

  /** Domingo de Páscoa (algoritmo de Meeus/Jones/Butcher). */
  function pascoa(ano) {
    var a = ano % 19, b = Math.floor(ano / 100), c = ano % 100;
    var d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
    var g = Math.floor((b - f + 1) / 3);
    var h = (19 * a + b - d - g + 15) % 30;
    var i = Math.floor(c / 4), k = c % 4;
    var l = (32 + 2 * e + 2 * i - h - k) % 7;
    var m = Math.floor((a + 11 * h + 22 * l) / 451);
    var mes = Math.floor((h + l - 7 * m + 114) / 31);
    var dia = ((h + l - 7 * m + 114) % 31) + 1;
    return dn(ano, mes, dia);
  }

  /** n-ésimo domingo de um mês (Dia das Mães = 2º de maio; Dia dos Pais = 2º de agosto). */
  function nDomingo(ano, mes, n) {
    var primeiro = dn(ano, mes, 1);
    return primeiro + mod(7 - diaSemana(primeiro), 7) + 7 * (n - 1);
  }

  /** Converte "dd/mm" em [dia, mês]. */
  function ddmm(s) {
    var p = String(s).split('/').map(Number);
    return [p[0], p[1]];
  }

  /** Genitor responsável em um ano, dada a regra "anos pares com X". */
  function porParidade(ano, anosPares) {
    return ano % 2 === 0 ? anosPares : outro(anosPares);
  }

  // ---------- configuração ----------

  function configPadrao() {
    return {
      ano: new Date().getFullYear() + 1,
      genitores: {
        A: { nome: 'Genitor A', papel: 'mae', nascimento: '' },
        B: { nome: 'Genitor B', papel: 'pai', nascimento: '' }
      },
      criancas: [],
      cidadeBase: '',
      residenciaBase: 'A',
      regime: 'fins_de_semana_alternados',
      dataInicio: '',
      iniciaCom: 'A',
      pernoiteMeioSemana: 3, // quarta-feira; null para desativar
      diaTroca: 5, // sexta-feira (semanas alternadas)
      horarioTroca: '18h',
      horarioRetorno: '18h',
      localTroca: 'na escola, ao término das aulas, ou, fora do período letivo, na residência do genitor que encerra o período',
      datas: {
        natal: { ativo: true, anosPares: 'A' },
        pascoa: { ativo: true, anosPares: 'B' },
        carnaval: { ativo: true, anosPares: 'A' },
        diaMaes: true,
        diaPais: true,
        aniversarioGenitores: true
      },
      ferias: {
        ativo: true,
        primeiraMetadeAnosPares: 'A',
        periodos: [
          { nome: 'férias de verão', inicio: '02/01', fim: '31/01' },
          { nome: 'férias de julho', inicio: '01/07', fim: '31/07' }
        ]
      },
      comunicacao: { canal: 'aplicativo de mensagens', videochamada: 'diariamente, entre 19h e 20h' },
      avisoMudancaDias: 60,
      avisoViagemDias: 15,
      alimentos: { ativo: false, devedor: 'B', valor: '', vencimento: 10 }
    };
  }

  function mesclar(base, extra) {
    if (!extra || typeof extra !== 'object' || Array.isArray(extra)) return extra === undefined ? base : extra;
    var out = Array.isArray(base) ? base.slice() : Object.assign({}, base);
    Object.keys(extra).forEach(function (k) {
      var v = extra[k];
      out[k] = (v && typeof v === 'object' && !Array.isArray(v) && base && typeof base[k] === 'object' && base[k] !== null)
        ? mesclar(base[k], v) : v;
    });
    return out;
  }

  function normalizar(cfg) {
    var c = mesclar(configPadrao(), cfg || {});
    if (!c.dataInicio) c.dataInicio = c.ano + '-01-01';
    return c;
  }

  // ---------- regime ordinário ----------

  function genitorBase(n, c) {
    var ancora = parseISO(c.dataInicio);
    var w = diaSemana(n);
    var ini = c.iniciaCom;
    var semanaPar = mod(semanaSeg(n) - semanaSeg(ancora), 2) === 0;

    switch (c.regime) {
      case 'fins_de_semana_alternados': {
        var base = c.residenciaBase, visitante = outro(base);
        // Noites de sexta e sábado; o primeiro fim de semana é do genitor visitante.
        if (w === 5 || w === 6) return semanaPar ? visitante : base;
        if (c.pernoiteMeioSemana !== null && c.pernoiteMeioSemana !== undefined && w === Number(c.pernoiteMeioSemana)) return visitante;
        return base;
      }
      case 'semanas_alternadas': {
        var k = mod(Number(c.diaTroca) - 4, 7); // um dia de referência com o dia da semana da troca
        var bloco = Math.floor((n - k) / 7) - Math.floor((ancora - k) / 7);
        return mod(bloco, 2) === 0 ? ini : outro(ini);
      }
      case '2-2-5-5': {
        if (w === 1 || w === 2) return ini;
        if (w === 3 || w === 4) return outro(ini);
        return semanaPar ? ini : outro(ini); // sexta, sábado e domingo alternados
      }
      case '2-2-3': {
        var p = semanaPar ? ini : outro(ini);
        if (w === 3 || w === 4) return outro(p);
        return p;
      }
      default:
        throw new Error('Regime desconhecido: ' + c.regime);
    }
  }

  // ---------- exceções (feriados, férias, datas comemorativas) ----------

  function construirExcecoes(c, ano) {
    var mapa = {};
    function marcar(n, g, tipo, rotulo) {
      if (!g) return;
      var atual = mapa[n];
      if (!atual || PRIORIDADE[tipo] >= PRIORIDADE[atual.tipo]) mapa[n] = { genitor: g, tipo: tipo, rotulo: rotulo };
    }
    var d = c.datas, G = c.genitores;

    // Ordem crescente de prioridade; o anterior do ano é considerado para o réveillon.
    if (c.ferias.ativo) {
      c.ferias.periodos.forEach(function (per) {
        var i = ddmm(per.inicio), f = ddmm(per.fim);
        var ini = dn(ano, i[1], i[0]), fim = dn(ano, f[1], f[0]);
        if (!(fim >= ini)) return;
        var total = fim - ini + 1, metade = Math.ceil(total / 2);
        var primeiro = porParidade(ano, c.ferias.primeiraMetadeAnosPares);
        for (var n = ini; n <= fim; n++) {
          var primeira = n - ini < metade;
          marcar(n, primeira ? primeiro : outro(primeiro), 'ferias',
            (primeira ? '1ª' : '2ª') + ' metade das ' + per.nome);
        }
      });
    }

    var pas = pascoa(ano);
    if (d.carnaval && d.carnaval.ativo) {
      var gc = porParidade(ano, d.carnaval.anosPares);
      for (var n1 = pas - 50; n1 <= pas - 47; n1++) marcar(n1, gc, 'feriado', 'Carnaval');
    }
    if (d.pascoa && d.pascoa.ativo) {
      var gp = porParidade(ano, d.pascoa.anosPares);
      marcar(pas - 2, gp, 'feriado', 'Páscoa (Sexta-feira Santa)');
      marcar(pas - 1, gp, 'feriado', 'Páscoa (Sábado de Aleluia)');
    }

    function papel(p) {
      var qs = ['A', 'B'].filter(function (g) { return G[g].papel === p; });
      return qs.length === 1 ? qs[0] : null;
    }
    if (d.diaMaes) marcar(nDomingo(ano, 5, 2), papel('mae'), 'comemorativa', 'Dia das Mães');
    if (d.diaPais) marcar(nDomingo(ano, 8, 2), papel('pai'), 'comemorativa', 'Dia dos Pais');
    if (d.aniversarioGenitores) {
      ['A', 'B'].forEach(function (g) {
        if (!G[g].nascimento) return;
        var p = partes(parseISO(G[g].nascimento));
        if (p.mes === 2 && p.dia === 29 && !(ano % 4 === 0 && (ano % 100 !== 0 || ano % 400 === 0))) p.dia = 28;
        marcar(dn(ano, p.mes, p.dia), g, 'comemorativa', 'Aniversário de ' + G[g].nome);
      });
    }

    if (d.natal && d.natal.ativo) {
      // Réveillon do ano anterior alcança a noite de 1º de janeiro.
      var gAnt = outro(porParidade(ano - 1, d.natal.anosPares));
      marcar(dn(ano, 1, 1), gAnt, 'natal', 'Ano-Novo');
      var gn = porParidade(ano, d.natal.anosPares);
      marcar(dn(ano, 12, 24), gn, 'natal', 'Véspera de Natal');
      marcar(dn(ano, 12, 25), gn, 'natal', 'Natal');
      marcar(dn(ano, 12, 31), outro(gn), 'natal', 'Réveillon');
    }
    return mapa;
  }

  // ---------- calendário e estatísticas ----------

  function gerarCalendario(cfg, ano) {
    var c = normalizar(cfg);
    ano = ano || c.ano;
    var exc = construirExcecoes(c, ano);
    var aniversarios = {};
    c.criancas.forEach(function (cr) {
      if (!cr.nascimento) return;
      var p = partes(parseISO(cr.nascimento));
      if (p.mes === 2 && p.dia === 29) p.dia = 28;
      aniversarios[dn(ano, p.mes, p.dia)] = (aniversarios[dn(ano, p.mes, p.dia)] || []).concat('Aniversário de ' + cr.nome);
    });

    var dias = [];
    for (var n = dn(ano, 1, 1); n <= dn(ano, 12, 31); n++) {
      var e = exc[n];
      dias.push({
        data: iso(n),
        n: n,
        diaSemana: diaSemana(n),
        genitor: e ? e.genitor : genitorBase(n, c),
        tipo: e ? e.tipo : 'base',
        rotulo: e ? e.rotulo : '',
        marcadores: aniversarios[n] || []
      });
    }
    return dias;
  }

  function estatisticas(dias) {
    var r = { A: { noites: 0, maiorAfastamento: 0 }, B: { noites: 0, maiorAfastamento: 0 }, trocas: 0, total: dias.length };
    var seq = 0;
    dias.forEach(function (d, i) {
      r[d.genitor].noites++;
      if (i > 0 && dias[i - 1].genitor !== d.genitor) { r.trocas++; seq = 0; }
      seq++;
      // Noites seguidas com um genitor = noites seguidas longe do outro.
      var longe = outro(d.genitor);
      if (seq > r[longe].maiorAfastamento) r[longe].maiorAfastamento = seq;
    });
    r.A.percentual = dias.length ? Math.round((r.A.noites / dias.length) * 1000) / 10 : 0;
    r.B.percentual = dias.length ? Math.round((r.B.noites / dias.length) * 1000) / 10 : 0;
    return r;
  }

  // ---------- minuta ----------

  function listaNatural(itens) {
    if (itens.length <= 1) return itens.join('');
    return itens.slice(0, -1).join(', ') + ' e ' + itens[itens.length - 1];
  }

  function papelTexto(p) { return p === 'mae' ? 'genitora' : p === 'pai' ? 'genitor' : 'genitor(a)'; }

  function descreverRegime(c, nomes, filhos, Filhos, fut) {
    var ancora = parseISO(c.dataInicio);
    var ini = nomes[c.iniciaCom], oIni = nomes[outro(c.iniciaCom)];
    switch (c.regime) {
      case 'fins_de_semana_alternados': {
        var base = nomes[c.residenciaBase], vis = nomes[outro(c.residenciaBase)];
        var primeiraSexta = ancora + mod(5 - diaSemana(ancora), 7);
        var t = Filhos + ' ' + fut('residirá') + ' com ' + base + ' e ' + fut('conviverá') + ' com ' + vis +
          ' em fins de semana alternados, de sexta-feira, às ' + c.horarioTroca + ', até domingo, às ' + c.horarioRetorno +
          ', iniciando-se o revezamento no fim de semana de ' + br(primeiraSexta) + ', que caberá a ' + vis + '.';
        if (c.pernoiteMeioSemana !== null && c.pernoiteMeioSemana !== undefined && c.pernoiteMeioSemana !== '') {
          var w = Number(c.pernoiteMeioSemana);
          t += ' Semanalmente, ' + vis + ' terá também o pernoite de ' + DIAS_SEMANA[w] + ' para ' + DIAS_SEMANA[mod(w + 1, 7)] +
            ', com busca após a escola e entrega na escola na manhã seguinte.';
        }
        return t;
      }
      case 'semanas_alternadas':
        return 'O tempo de convívio será dividido em semanas alternadas, com troca toda(o) ' + DIAS_SEMANA[Number(c.diaTroca)] +
          ', às ' + c.horarioTroca + '. O período em curso em ' + br(ancora) + ' caberá a ' + ini + ', alternando-se a partir de então.';
      case '2-2-5-5':
        return 'O tempo de convívio seguirá o modelo 2-2-5-5: ' + ini + ' terá as noites de segunda e terça-feira; ' + oIni +
          ', as de quarta e quinta-feira; os fins de semana (noites de sexta, sábado e domingo) serão alternados, cabendo o da semana de ' +
          br(ancora) + ' a ' + ini + '. Assim, cada genitor permanece com ' + filhos + ' por blocos de 2 e de 5 noites.';
      case '2-2-3':
        return 'O tempo de convívio seguirá o modelo 2-2-3: na semana de ' + br(ancora) + ', ' + ini +
          ' terá as noites de segunda e terça-feira, ' + oIni + ' as de quarta e quinta-feira, e ' + ini +
          ' as de sexta, sábado e domingo; na semana seguinte, os papéis se invertem, e assim sucessivamente.';
      default:
        return '';
    }
  }

  function gerarMinuta(cfg) {
    var c = normalizar(cfg);
    var G = c.genitores;
    var nomes = { A: G.A.nome, B: G.B.nome };
    var plural = c.criancas.length > 1;
    var filhos = c.criancas.length
      ? (plural ? 'os filhos' : 'a criança')
      : 'a(s) criança(s)';
    var Filhos = filhos.charAt(0).toUpperCase() + filhos.slice(1);
    // Contrações: "de" + "os filhos" = "dos filhos"; "a" + "a criança" = "à criança".
    var deFilhos = filhos.replace(/^os /, 'dos ').replace(/^a\(s\) /, 'da(s) ').replace(/^a /, 'da ');
    var aFilhos = filhos.replace(/^os /, 'aos ').replace(/^a\(s\) /, 'à(s) ').replace(/^a /, 'à ');
    // Futuro concordando com o número de filhos: "residirá" / "residirão" / "residirá(ão)".
    function fut(v) { return plural ? v.slice(0, -1) + 'ão' : c.criancas.length ? v : v + '(ão)'; }
    var pronome = plural ? 'eles' : c.criancas.length ? 'ela' : 'ela(s)';
    var st = estatisticas(gerarCalendario(c, c.ano));

    var clausulas = [];
    function cl(titulo, texto) { clausulas.push({ titulo: titulo, texto: texto }); }

    var identCriancas = c.criancas.length
      ? listaNatural(c.criancas.map(function (cr) { return cr.nome + (cr.nascimento ? ', nascida(o) em ' + br(parseISO(cr.nascimento)) : ''); }))
      : '[nome e data de nascimento das crianças]';

    cl('Da guarda compartilhada',
      'A guarda ' + deFilhos + ' será exercida de forma compartilhada, com responsabilização conjunta e exercício de direitos e deveres ' +
      'pelos genitores concernentes ao poder familiar (art. 1.583, § 1º, e art. 1.634 do Código Civil). As decisões relevantes, ' +
      'como escolha e mudança de escola, tratamentos de saúde não emergenciais, atividades extracurriculares, orientação religiosa, ' +
      'viagens internacionais e mudança de domicílio, serão tomadas em conjunto.');

    cl('Da base de moradia',
      'Fica fixada a cidade de ' + (c.cidadeBase || '[cidade]') + ' como base de moradia ' + deFilhos + ' (art. 1.583, § 3º, do Código Civil), ' +
      'e a residência de ' + nomes[c.residenciaBase] + ' como lar de referência para fins de endereço escolar e cadastral, ' +
      'sem prejuízo da divisão equilibrada do tempo de convívio (art. 1.583, § 2º).');

    cl('Do regime ordinário de convivência',
      descreverRegime(c, nomes, filhos, Filhos, fut) + ' Em projeção para o ano de ' + c.ano + ', o regime, somado às datas especiais e às férias, resulta em ' +
      st.A.noites + ' pernoites (' + st.A.percentual.toString().replace('.', ',') + '%) com ' + nomes.A + ' e ' +
      st.B.noites + ' pernoites (' + st.B.percentual.toString().replace('.', ',') + '%) com ' + nomes.B + '.');

    cl('Das entregas e buscas',
      'As trocas ocorrerão ' + c.localTroca + '. Caberá ao genitor que inicia o período buscar ' + filhos +
      ', admitida tolerância de 30 (trinta) minutos. Atrasos e impedimentos serão comunicados com a maior antecedência possível.');

    var especiais = [];
    var d = c.datas;
    if (d.natal && d.natal.ativo) {
      especiais.push('Natal (noites de 24 e 25 de dezembro): nos anos pares com ' + nomes[d.natal.anosPares] + ' e nos ímpares com ' +
        nomes[outro(d.natal.anosPares)] + '; o Réveillon (noites de 31 de dezembro e 1º de janeiro) caberá, no mesmo ciclo, ao outro genitor');
    }
    if (d.carnaval && d.carnaval.ativo) {
      especiais.push('Carnaval (de sábado à terça-feira de Carnaval): nos anos pares com ' + nomes[d.carnaval.anosPares] + ' e nos ímpares com ' + nomes[outro(d.carnaval.anosPares)]);
    }
    if (d.pascoa && d.pascoa.ativo) {
      especiais.push('Páscoa (de Sexta-feira Santa ao domingo de Páscoa, às ' + c.horarioRetorno + '): nos anos pares com ' + nomes[d.pascoa.anosPares] + ' e nos ímpares com ' + nomes[outro(d.pascoa.anosPares)]);
    }
    ['mae', 'pai'].forEach(function (p) {
      var ativo = p === 'mae' ? d.diaMaes : d.diaPais;
      var g = ['A', 'B'].filter(function (x) { return G[x].papel === p; });
      if (ativo && g.length === 1) {
        especiais.push((p === 'mae' ? 'Dia das Mães' : 'Dia dos Pais') + ': com ' + nomes[g[0]] + ', das 9h do domingo até a entrada na escola na segunda-feira');
      }
    });
    if (d.aniversarioGenitores) {
      especiais.push('Aniversário de cada genitor: ' + filhos + ' ' + fut('pernoitará') + ' com o aniversariante');
    }
    especiais.push('Aniversário ' + deFilhos + ': o genitor que não estiver com ' + filhos + ' na data poderá com ' + pronome + ' conviver por, no mínimo, 3 (três) horas, em horário a ser combinado');
    cl('Das datas especiais',
      'Independentemente do regime ordinário, observar-se-á:\n' + especiais.map(function (e, i) { return '  ' + String.fromCharCode(97 + i) + ') ' + e + ';'; }).join('\n'));

    if (c.ferias.ativo && c.ferias.periodos.length) {
      var p1 = nomes[c.ferias.primeiraMetadeAnosPares], p2 = nomes[outro(c.ferias.primeiraMetadeAnosPares)];
      cl('Das férias escolares',
        'Os períodos de férias escolares (' + listaNatural(c.ferias.periodos.map(function (p) { return p.nome + ', de ' + p.inicio + ' a ' + p.fim; })) +
        ', ou conforme o calendário escolar efetivo) serão divididos em duas metades: nos anos pares, a primeira metade caberá a ' + p1 +
        ' e a segunda a ' + p2 + '; nos anos ímpares, inverte-se a ordem.');
    }

    cl('Da precedência',
      'As datas especiais prevalecem sobre as férias escolares, que prevalecem sobre o regime ordinário. Encerrado o período excepcional, ' +
      'retoma-se o regime ordinário no ponto em que estiver, sem compensação de dias.');

    cl('Da comunicação',
      'Os genitores utilizarão ' + c.comunicacao.canal + ' como canal preferencial para assuntos relativos ' + aFilhos +
      ', respondendo em até 48 (quarenta e oito) horas, salvo urgência, que será comunicada de imediato. O genitor que não estiver com ' + filhos +
      ' terá assegurado contato por chamada de vídeo ou telefone ' + c.comunicacao.videochamada + '.');

    cl('Das informações escolares e de saúde',
      'Ambos os genitores têm direito de acesso direto às informações escolares, médicas e psicológicas ' + deFilhos +
      ' (art. 1.584, § 6º, do Código Civil), devendo manter-se mutuamente informados sobre reuniões, consultas e ocorrências relevantes.');

    cl('Das viagens',
      'Viagens nacionais poderão ser realizadas no período de convívio de cada genitor, mediante aviso com antecedência mínima de ' +
      c.avisoViagemDias + ' dias, informando destino, hospedagem e datas. Viagens internacionais dependem de autorização expressa de ambos os genitores (arts. 83 e 84 do ECA).');

    cl('Da mudança de domicílio',
      'Qualquer mudança de endereço será comunicada com antecedência mínima de ' + c.avisoMudancaDias +
      ' dias. A mudança para outra cidade que inviabilize o regime ora ajustado dependerá de novo acordo ou de decisão judicial.');

    if (c.alimentos && c.alimentos.ativo) {
      cl('Dos alimentos',
        'A guarda compartilhada não afasta o dever de prestar alimentos. ' + nomes[c.alimentos.devedor] + ' pagará, a título de alimentos, ' +
        (c.alimentos.valor || '[valor ou percentual]') + ', até o dia ' + c.alimentos.vencimento + ' de cada mês. Despesas extraordinárias ' +
        '(saúde não coberta por plano, material escolar e atividades previamente acordadas) serão divididas em partes iguais, mediante comprovação.');
    }

    cl('Da conduta dos genitores',
      'Os genitores se comprometem a tratar-se com respeito, a não desqualificar um ao outro perante ' + filhos +
      ' e a não praticar qualquer ato de alienação parental, nos termos da Lei nº 12.318/2010.');

    cl('Da revisão',
      'Este plano poderá ser revisto a qualquer tempo, por acordo ou judicialmente, conforme a idade e as necessidades ' + deFilhos +
      '. Antes de recorrer ao Judiciário, os genitores buscarão a mediação.');

    var linhas = [];
    linhas.push('PLANO DE CONVIVÊNCIA E EXERCÍCIO DA GUARDA COMPARTILHADA');
    linhas.push('');
    linhas.push(G.A.nome + ' (' + papelTexto(G.A.papel) + ') e ' + G.B.nome + ' (' + papelTexto(G.B.papel) + '), genitores de ' + identCriancas +
      ', ajustam o presente plano, nos termos dos arts. 1.583, 1.584 e 1.634 do Código Civil, com a redação dada pela Lei nº 13.058/2014, ' +
      'observado o melhor interesse da criança e do adolescente (art. 227 da Constituição Federal e Lei nº 8.069/1990).');
    clausulas.forEach(function (x, i) {
      linhas.push('');
      linhas.push('CLÁUSULA ' + (i + 1) + 'ª – ' + x.titulo.toUpperCase());
      linhas.push(x.texto);
    });
    linhas.push('');
    linhas.push((c.cidadeBase || '[cidade]') + ', ____ de ______________ de ______.');
    linhas.push('');
    linhas.push('_______________________________          _______________________________');
    linhas.push(G.A.nome + '          ' + G.B.nome);
    return linhas.join('\n');
  }

  return {
    REGIMES: REGIMES,
    DIAS_SEMANA: DIAS_SEMANA,
    MESES: MESES,
    configPadrao: configPadrao,
    normalizar: normalizar,
    pascoa: function (ano) { return iso(pascoa(ano)); },
    gerarCalendario: gerarCalendario,
    estatisticas: estatisticas,
    gerarMinuta: gerarMinuta
  };
});
