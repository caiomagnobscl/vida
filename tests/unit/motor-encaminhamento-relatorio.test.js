import test from 'node:test';
import assert from 'node:assert/strict';
import { GrupoDeExigencias } from '../../src/js/models/catalogo.js';
import { Encaminhamento } from '../../src/js/models/encaminhamento.js';
import { MotorDeRegras } from '../../src/js/models/motor-de-regras.js';
import { Achado, RelatorioDeCompletude } from '../../src/js/models/relatorio.js';
import { ServicoExportacao } from '../../src/js/models/servico-exportacao.js';
import { Especialidade } from '../../src/js/models/catalogo.js';
import { carregarCatalogoPiloto } from '../helpers/fabrica.js';

const exig = (id, carater) => ({
  idExigencia: id,
  descricao: `Item ${id}`,
  tipo: 'EXAME',
  carater,
  trechoDoProtocolo: 't',
});
const grupo = (modo, carater, ...ids) =>
  new GrupoDeExigencias({ modo, exigencias: ids.map((i) => exig(i, carater)) });
function encaminhamentoCom(grupos, atendidas = []) {
  const enc = new Encaminhamento(new Especialidade('X'));
  enc.definirItens(grupos.flatMap((g) => g.exigencias));
  for (const id of atendidas) enc.registrarAtendimento(`ITEM-${id}`, true);
  return enc;
}
const motor = async () => new MotorDeRegras(await carregarCatalogoPiloto());

test('[RN06] TODOS + OBRIGATORIA: cada exigência não atendida gera achado bloqueante', async () => {
  const g = grupo('TODOS', 'OBRIGATORIA', 'A', 'B', 'C');
  const achados = (await motor()).avaliarGrupo(g, encaminhamentoCom([g], ['A']));
  assert.deepEqual(
    achados.map((a) => a.idExigencia),
    ['B', 'C'],
  );
  assert.ok(achados.every((a) => a.bloqueante && a.tipo === 'EXIGENCIA_NAO_ATENDIDA'));
});

test('[RN06] TODOS + SE_DISPONIVEL: gera recomendação, nunca bloqueia', async () => {
  const g = grupo('TODOS', 'SE_DISPONIVEL', 'A');
  const [a] = (await motor()).avaliarGrupo(g, encaminhamentoCom([g]));
  assert.equal(a.tipo, 'RECOMENDACAO_NAO_ATENDIDA');
  assert.equal(a.bloqueante, false);
});

test('[RN06] AO_MENOS_UM: nenhuma atendida gera UM achado agregado; uma atendida não gera nada', async () => {
  const g = grupo('AO_MENOS_UM', 'OBRIGATORIA', 'A', 'B', 'C');
  const m = await motor();
  const vazio = m.avaliarGrupo(g, encaminhamentoCom([g]));
  assert.equal(vazio.length, 1);
  assert.deepEqual(vazio[0].idsDeItens, ['ITEM-A', 'ITEM-B', 'ITEM-C']);
  assert.match(vazio[0].mensagem, /ao menos um dos itens/);
  assert.equal(m.avaliarGrupo(g, encaminhamentoCom([g], ['B'])).length, 0);
});

test('[RN06] AO_MENOS_UM + SE_DISPONIVEL: achado agregado é recomendação', async () => {
  const g = grupo('AO_MENOS_UM', 'SE_DISPONIVEL', 'A', 'B');
  const [a] = (await motor()).avaliarGrupo(g, encaminhamentoCom([g]));
  assert.equal(a.tipo, 'RECOMENDACAO_NAO_ATENDIDA');
});

test('[RF009] encaminhamento: definirItens preserva declarações e remove duplicatas; item inexistente falha', () => {
  const g = grupo('TODOS', 'OBRIGATORIA', 'A', 'B');
  const enc = encaminhamentoCom([g], ['A']);
  enc.definirItens([...g.exigencias, ...g.exigencias]);
  assert.equal(enc.itens.length, 2);
  assert.equal(enc.atendeu('A'), true);
  assert.equal(enc.atendeu('B'), false);
  assert.throws(() => enc.registrarAtendimento('ITEM-ZZ', true), /Item inexistente/);
  enc.registrarAtendimento('ITEM-A', false);
  assert.equal(enc.atendeu('A'), false);
});

test('[RF005,RN07] relatório: situação depende de haver achado bloqueante; avisos não bloqueiam', () => {
  const bloq = new Achado({ tipo: 'EXIGENCIA_NAO_ATENDIDA', bloqueante: true, mensagem: 'm' });
  const aviso = new Achado({ tipo: 'CID_SEM_REGRA', bloqueante: false, mensagem: 'a' });
  assert.equal(new RelatorioDeCompletude([aviso]).calcularSituacao(), 'SEM_PENDENCIAS');
  assert.equal(new RelatorioDeCompletude([aviso, bloq]).calcularSituacao(), 'COM_PENDENCIAS');
  const rel = new RelatorioDeCompletude([aviso, bloq]);
  rel.listarAchados().pop();
  assert.equal(rel.listarAchados().length, 2, 'listarAchados devolve cópia');
});

test('[RF007,RN07] exportação em texto: estrutura, aviso de alcance e determinismo sem data', async () => {
  const catalogo = await carregarCatalogoPiloto();
  const g = grupo('TODOS', 'OBRIGATORIA', 'A', 'B');
  const enc = encaminhamentoCom([g], ['A']);
  const achados = new MotorDeRegras(catalogo).avaliarGrupo(g, enc);
  const rel = new RelatorioDeCompletude(achados, enc.itens, {
    especialidade: 'X',
    cid: 'R07.1',
    versaoCatalogo: '1.0.0',
    protocolo: 'Protocolo Y',
  });
  rel.calcularSituacao();
  const servico = new ServicoExportacao();
  const texto = servico.gerarTexto(rel, { incluirData: false });
  assert.match(texto, /Situação: COM PENDÊNCIAS \(1\)/);
  assert.match(texto, /PENDÊNCIAS\n1\. Pendente: Item B\./);
  assert.match(texto, /ITENS ATENDIDOS \(1 de 2\)\n- Item A/);
  assert.match(texto, /Não é autorização, aprovação nem priorização/);
  assert.doesNotMatch(texto, /Gerado em/);
  assert.equal(texto, servico.gerarTexto(rel, { incluirData: false }));
  assert.match(servico.gerarTexto(rel), /Gerado em: \d{2}\/\d{2}\/\d{4} \d{2}:\d{2} \(GMT[^)]*\)/);
});

/** Relatório mínimo gerado num instante conhecido, para conferir só a linha "Gerado em". */
function relatorioGeradoEm(instante) {
  const rel = new RelatorioDeCompletude([], [], { especialidade: 'X', cid: 'R07.1' });
  rel.calcularSituacao();
  rel.geradoEm = new Date(instante);
  return rel;
}

const linhaGeradoEm = (texto) => texto.split('\n').find((l) => l.startsWith('Gerado em:'));

test('[B-11,RF007] "Gerado em" sai em horário de Brasília, no formato corrente, não em UTC/ISO', () => {
  const servico = new ServicoExportacao();
  // 00:00:45 UTC de 15/11 ainda é 14/11, 21h, em Brasília: o dia em UTC pareceria "do futuro".
  assert.equal(
    linhaGeradoEm(servico.gerarTexto(relatorioGeradoEm('2026-11-15T00:00:45.369Z'))),
    'Gerado em: 14/11/2026 21:00 (GMT-03:00)',
  );
  assert.equal(
    linhaGeradoEm(servico.gerarTexto(relatorioGeradoEm('2026-06-01T12:00:00Z'))),
    'Gerado em: 01/06/2026 09:00 (GMT-03:00)',
  );
});

test('[B-11] meia-noite é 00:00 (nunca 24:00) e o minuto 23:59 não vira o dia seguinte', () => {
  const servico = new ServicoExportacao();
  assert.match(
    linhaGeradoEm(servico.gerarTexto(relatorioGeradoEm('2026-11-15T03:00:00Z'))),
    /15\/11\/2026 00:00 /,
  );
  assert.match(
    linhaGeradoEm(servico.gerarTexto(relatorioGeradoEm('2026-11-15T02:59:59Z'))),
    /14\/11\/2026 23:59 /,
  );
});

test('[B-11] o fuso é injetável: o mesmo instante em outro fuso muda a hora, e fuso inválido falha cedo', () => {
  const rel = relatorioGeradoEm('2026-11-15T00:00:45Z');
  assert.match(
    linhaGeradoEm(new ServicoExportacao({ fusoHorario: 'UTC' }).gerarTexto(rel)),
    /^Gerado em: 15\/11\/2026 00:00 /,
  );
  assert.match(
    linhaGeradoEm(new ServicoExportacao({ fusoHorario: 'Asia/Tokyo' }).gerarTexto(rel)),
    /^Gerado em: 15\/11\/2026 09:00 \(GMT\+09:00\)$/,
  );
  assert.throws(() => new ServicoExportacao({ fusoHorario: 'Marte/Olympus' }), RangeError);
});

test('[B-11] a data não depende do fuso da máquina que roda o teste', () => {
  const antes = process.env.TZ;
  try {
    for (const tz of ['UTC', 'Asia/Tokyo', 'America/Los_Angeles']) {
      process.env.TZ = tz;
      assert.equal(
        linhaGeradoEm(
          new ServicoExportacao().gerarTexto(relatorioGeradoEm('2026-11-15T00:00:45Z')),
        ),
        'Gerado em: 14/11/2026 21:00 (GMT-03:00)',
        tz,
      );
    }
  } finally {
    if (antes === undefined) delete process.env.TZ;
    else process.env.TZ = antes;
  }
});

test('[B-05,RN07] rótulo da situação é único: os dois valores conhecidos têm texto, o resto é erro', () => {
  const bloq = new Achado({ tipo: 'EXIGENCIA_NAO_ATENDIDA', bloqueante: true, mensagem: 'm' });
  const com = new RelatorioDeCompletude([bloq, bloq]);
  com.calcularSituacao();
  assert.equal(com.rotuloDaSituacao(), 'Com pendências (2)');
  const sem = new RelatorioDeCompletude([]);
  sem.calcularSituacao();
  assert.equal(sem.rotuloDaSituacao(), 'Sem pendências');
  for (const invalida of [null, undefined, 'QUALQUER', '']) {
    const rel = new RelatorioDeCompletude([bloq]);
    rel.situacao = invalida;
    assert.throws(() => rel.rotuloDaSituacao(), /não calculada/, String(invalida));
  }
});

test('[B-05,RN07] situação não calculada nunca vira "SEM PENDÊNCIAS" no texto exportado', () => {
  const bloq = new Achado({ tipo: 'EXIGENCIA_NAO_ATENDIDA', bloqueante: true, mensagem: 'm' });
  const rel = new RelatorioDeCompletude([bloq]); // sem calcularSituacao()
  assert.throws(() => new ServicoExportacao().gerarTexto(rel), /não calculada/);
});

test('[B-05,RN07] o texto exportado e a tela usam o mesmo rótulo (em maiúsculas no .txt)', () => {
  const bloq = new Achado({ tipo: 'EXIGENCIA_NAO_ATENDIDA', bloqueante: true, mensagem: 'm' });
  const rel = new RelatorioDeCompletude([bloq], [], { especialidade: 'X', cid: 'R07.1' });
  rel.calcularSituacao();
  const texto = new ServicoExportacao().gerarTexto(rel, { incluirData: false });
  assert.ok(texto.includes(`Situação: ${rel.rotuloDaSituacao().toUpperCase()}`));
});
