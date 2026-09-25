const test = require('node:test');
const assert = require('node:assert/strict');
const M = require('./motor.js');

const semExcecoes = {
  datas: {
    natal: { ativo: false }, pascoa: { ativo: false }, carnaval: { ativo: false },
    diaMaes: false, diaPais: false, aniversarioGenitores: false
  },
  ferias: { ativo: false }
};

function dia(dias, data) { return dias.find((d) => d.data === data); }

test('Páscoa calculada corretamente', () => {
  assert.equal(M.pascoa(2024), '2024-03-31');
  assert.equal(M.pascoa(2025), '2025-04-20');
  assert.equal(M.pascoa(2026), '2026-04-05');
  assert.equal(M.pascoa(2027), '2027-03-28');
});

test('calendário cobre o ano inteiro, inclusive bissexto', () => {
  assert.equal(M.gerarCalendario({ ano: 2027 }).length, 365);
  assert.equal(M.gerarCalendario({ ano: 2028 }).length, 366);
});

test('fins de semana alternados: visitante tem sexta e sábado alternados e pernoite de quarta', () => {
  const dias = M.gerarCalendario({ ...semExcecoes, ano: 2027, dataInicio: '2027-01-04', residenciaBase: 'A', pernoiteMeioSemana: 3 });
  // Semana de 04/01/2027 (segunda): primeiro fim de semana do visitante (B).
  assert.equal(dia(dias, '2027-01-08').genitor, 'B'); // sexta
  assert.equal(dia(dias, '2027-01-09').genitor, 'B'); // sábado
  assert.equal(dia(dias, '2027-01-10').genitor, 'A'); // domingo volta à base
  assert.equal(dia(dias, '2027-01-15').genitor, 'A'); // sexta seguinte: base
  assert.equal(dia(dias, '2027-01-22').genitor, 'B');
  assert.equal(dia(dias, '2027-01-06').genitor, 'B'); // quarta
  assert.equal(dia(dias, '2027-01-07').genitor, 'A'); // quinta
});

test('semanas alternadas trocam no dia configurado', () => {
  const dias = M.gerarCalendario({ ...semExcecoes, ano: 2027, regime: 'semanas_alternadas', dataInicio: '2027-01-01', diaTroca: 5, iniciaCom: 'A' });
  // 01/01/2027 é sexta: começa bloco de A até quinta 07/01.
  assert.equal(dia(dias, '2027-01-01').genitor, 'A');
  assert.equal(dia(dias, '2027-01-07').genitor, 'A');
  assert.equal(dia(dias, '2027-01-08').genitor, 'B');
  assert.equal(dia(dias, '2027-01-14').genitor, 'B');
  assert.equal(dia(dias, '2027-01-15').genitor, 'A');
  const st = M.estatisticas(dias);
  assert.ok(Math.abs(st.A.noites - st.B.noites) <= 7);
  assert.equal(st.A.maiorAfastamento, 7);
});

test('2-2-5-5 mantém dias fixos e alterna fins de semana', () => {
  const dias = M.gerarCalendario({ ...semExcecoes, ano: 2027, regime: '2-2-5-5', dataInicio: '2027-01-04', iniciaCom: 'A' });
  assert.equal(dia(dias, '2027-01-04').genitor, 'A'); // seg
  assert.equal(dia(dias, '2027-01-06').genitor, 'B'); // qua
  assert.equal(dia(dias, '2027-01-08').genitor, 'A'); // sex
  assert.equal(dia(dias, '2027-01-10').genitor, 'A'); // dom
  assert.equal(dia(dias, '2027-01-11').genitor, 'A'); // seg seguinte
  assert.equal(dia(dias, '2027-01-15').genitor, 'B'); // sex seguinte
  const st = M.estatisticas(dias);
  assert.equal(st.A.maiorAfastamento, 5);
  assert.equal(st.B.maiorAfastamento, 5);
});

test('2-2-3 inverte os papéis a cada semana', () => {
  const dias = M.gerarCalendario({ ...semExcecoes, ano: 2027, regime: '2-2-3', dataInicio: '2027-01-04', iniciaCom: 'A' });
  assert.deepEqual(
    ['04', '05', '06', '07', '08', '09', '10'].map((d) => dia(dias, `2027-01-${d}`).genitor).join(''),
    'AABBAAA'
  );
  assert.deepEqual(
    ['11', '12', '13', '14', '15', '16', '17'].map((d) => dia(dias, `2027-01-${d}`).genitor).join(''),
    'BBAABBB'
  );
});

test('Natal e Réveillon alternam por paridade do ano', () => {
  const cfg = { ano: 2026, datas: { natal: { ativo: true, anosPares: 'A' } } };
  const d26 = M.gerarCalendario(cfg, 2026);
  assert.equal(dia(d26, '2026-12-24').genitor, 'A');
  assert.equal(dia(d26, '2026-12-25').genitor, 'A');
  assert.equal(dia(d26, '2026-12-31').genitor, 'B');
  const d27 = M.gerarCalendario(cfg, 2027);
  assert.equal(dia(d27, '2027-01-01').genitor, 'B'); // continuação do réveillon de 2026
  assert.equal(dia(d27, '2027-12-24').genitor, 'B');
  assert.equal(dia(d27, '2027-12-31').genitor, 'A');
});

test('Dia das Mães e Dia dos Pais seguem o papel de cada genitor', () => {
  const dias = M.gerarCalendario({
    ano: 2027,
    genitores: { A: { nome: 'Ana', papel: 'mae' }, B: { nome: 'Bruno', papel: 'pai' } }
  });
  const maes = dia(dias, '2027-05-09');
  assert.equal(maes.genitor, 'A');
  assert.equal(maes.rotulo, 'Dia das Mães');
  assert.equal(dia(dias, '2027-08-08').genitor, 'B');
});

test('Dia das Mães é ignorado quando nenhum ou ambos são mães', () => {
  const dias = M.gerarCalendario({
    ...semExcecoes, datas: { ...semExcecoes.datas, diaMaes: true }, ano: 2027,
    genitores: { A: { nome: 'Ana', papel: 'mae' }, B: { nome: 'Carla', papel: 'mae' } }
  });
  assert.equal(dia(dias, '2027-05-09').tipo, 'base');
});

test('férias são divididas em metades alternadas por ano', () => {
  const cfg = {
    ...semExcecoes,
    ferias: { ativo: true, primeiraMetadeAnosPares: 'A', periodos: [{ nome: 'férias de julho', inicio: '01/07', fim: '30/07' }] }
  };
  const d26 = M.gerarCalendario(cfg, 2026);
  assert.equal(dia(d26, '2026-07-01').genitor, 'A');
  assert.equal(dia(d26, '2026-07-15').genitor, 'A');
  assert.equal(dia(d26, '2026-07-16').genitor, 'B');
  const d27 = M.gerarCalendario(cfg, 2027);
  assert.equal(dia(d27, '2027-07-01').genitor, 'B');
  assert.equal(dia(d27, '2027-07-30').genitor, 'A');
});

test('datas especiais prevalecem sobre férias', () => {
  const dias = M.gerarCalendario({
    ano: 2026,
    datas: { natal: { ativo: true, anosPares: 'A' } },
    ferias: { ativo: true, primeiraMetadeAnosPares: 'B', periodos: [{ nome: 'recesso', inicio: '20/12', fim: '31/12' }] }
  });
  assert.equal(dia(dias, '2026-12-24').genitor, 'A');
  assert.equal(dia(dias, '2026-12-24').tipo, 'natal');
  assert.equal(dia(dias, '2026-12-20').tipo, 'ferias');
});

test('aniversário da criança aparece como marcador', () => {
  const dias = M.gerarCalendario({ ano: 2027, criancas: [{ nome: 'Laura', nascimento: '2019-03-14' }] });
  assert.deepEqual(dia(dias, '2027-03-14').marcadores, ['Aniversário de Laura']);
});

test('estatísticas somam o total de noites', () => {
  const st = M.estatisticas(M.gerarCalendario({ ano: 2027 }));
  assert.equal(st.A.noites + st.B.noites, 365);
  assert.ok(st.trocas > 0);
});

test('minuta contém cláusulas essenciais e nomes das partes', () => {
  const texto = M.gerarMinuta({
    ano: 2027,
    genitores: { A: { nome: 'Ana Souza', papel: 'mae' }, B: { nome: 'Bruno Lima', papel: 'pai' } },
    criancas: [{ nome: 'Laura', nascimento: '2019-03-14' }],
    cidadeBase: 'Belo Horizonte',
    alimentos: { ativo: true, devedor: 'B', valor: '30% do salário mínimo' }
  });
  assert.match(texto, /PLANO DE CONVIVÊNCIA/);
  assert.match(texto, /Ana Souza \(genitora\) e Bruno Lima \(genitor\)/);
  assert.match(texto, /Laura, nascida\(o\) em 14\/03\/2019/);
  assert.match(texto, /art\. 1\.583, § 3º/);
  assert.match(texto, /DOS ALIMENTOS/);
  assert.match(texto, /Belo Horizonte, ____/);
  assert.doesNotMatch(texto, /undefined|NaN/);
});

test('minuta de cada regime não contém valores indefinidos', () => {
  Object.keys(M.REGIMES).forEach((regime) => {
    const texto = M.gerarMinuta({ ano: 2027, regime, pernoiteMeioSemana: null });
    assert.doesNotMatch(texto, /undefined|NaN/, regime);
  });
});

test('minuta usa contrações corretas ("dos filhos", "da criança")', () => {
  const uma = M.gerarMinuta({ ano: 2027, criancas: [{ nome: 'Laura', nascimento: '2019-03-14' }] });
  const duas = M.gerarMinuta({ ano: 2027, criancas: [{ nome: 'Laura' }, { nome: 'Pedro' }] });
  const nenhuma = M.gerarMinuta({ ano: 2027 });
  for (const t of [uma, duas, nenhuma]) {
    assert.doesNotMatch(t, /\b(de|a) (os filhos|a criança|a\(s\) criança\(s\))/);
  }
  assert.match(uma, /A guarda da criança/);
  assert.match(duas, /A guarda dos filhos/);
  assert.match(duas, /relativos aos filhos/);
  assert.match(uma, /relativos à criança/);
  assert.match(nenhuma, /A guarda da\(s\) criança\(s\)/);
});

test('minuta concorda os verbos com o número de filhos', () => {
  const uma = M.gerarMinuta({ ano: 2027, criancas: [{ nome: 'Laura' }] });
  const duas = M.gerarMinuta({ ano: 2027, criancas: [{ nome: 'Laura' }, { nome: 'Pedro' }] });
  assert.match(uma, /\nA criança residirá com .* e conviverá com /);
  assert.match(duas, /\nOs filhos residirão com .* e conviverão com /);
  assert.match(duas, /os filhos pernoitarão com o aniversariante/);
  assert.doesNotMatch(uma + duas, /\(ão\)/);
});
