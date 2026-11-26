/**
 * A-01 e B-03: regra provisória e regra sem exigência própria viram AVISOS no relatório e no texto
 * exportado — antes, a observação do catálogo era carregada e nunca mostrada.
 * B-04: o aviso "sem regra específica" não se soma à pendência de CID genérico.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  catalogoSinteticoBruto,
  declarar,
  novoControlador,
  prepararFluxo,
} from '../helpers/fabrica.js';

const novo = () => novoControlador(catalogoSinteticoBruto());

test('[A-01,RN07] regra provisória: relatório "sem pendências" traz o aviso de que ainda não foi confirmada', async () => {
  const c = await novo();
  prepararFluxo(c, 'Alfa', 'B21');
  declarar(c, ['GT1', 'ALF-2.1']);
  const rel = c.verificar();
  assert.equal(rel.situacao, 'SEM_PENDENCIAS');
  const [aviso, ...outros] = rel.avisos();
  assert.equal(outros.length, 0);
  assert.equal(aviso.tipo, 'REGRA_PROVISORIA');
  assert.equal(aviso.bloqueante, false);
  assert.equal(aviso.idExigencia, 'ALF-2.1', 'o botão "i" abre a fundamentação da regra');
  assert.match(aviso.mensagem, /a regra ALF-2 \(Indicação ALF-2\) usa interpretação provisória/);
  assert.match(aviso.mensagem, /ainda não confirmada com a regulação/);
  assert.match(aviso.mensagem, /Hipótese de teste: basta um dos exames\./);
});

test('[A-01,RF007] o texto exportado repete o aviso da regra provisória na seção AVISOS', async () => {
  const c = await novo();
  prepararFluxo(c, 'Alfa', 'B21');
  declarar(c, ['GT1', 'ALF-2.1']);
  c.verificar();
  const texto = c.exportar();
  assert.match(texto, /Situação: SEM PENDÊNCIAS/);
  assert.match(
    texto,
    /\nAVISOS\n- Atenção: a regra ALF-2 .*ainda não confirmada com a regulação\./,
  );
});

test('[A-01] regra validada ou sem status não gera aviso', async () => {
  const c = await novo();
  for (const [cid, atendidas] of [
    ['A10', ['GT1', 'ALF-1.1']],
    ['C30', ['GT1', 'ALF-3.1', 'ALF-3.2']],
  ]) {
    prepararFluxo(c, 'Alfa', cid);
    declarar(c, atendidas);
    assert.deepEqual(c.verificar().avisos(), [], cid);
  }
});

test('[B-03] regra sem exigência própria: só as gerais entram no checklist e o relatório explica', async () => {
  const c = await novo();
  assert.equal(prepararFluxo(c, 'Beta', 'D40'), 'VALIDO');
  assert.deepEqual(
    c.encaminhamento.itens.map((i) => i.exigencia.idExigencia),
    ['GT1', 'GT2'],
  );
  declarar(c, ['GT1', 'GT2']);
  const rel = c.verificar();
  assert.equal(rel.situacao, 'SEM_PENDENCIAS');
  assert.deepEqual(
    rel.avisos().map((a) => a.tipo),
    ['REGRA_SEM_EXIGENCIA'],
  );
  assert.match(
    rel.avisos()[0].mensagem,
    /regra BET-1 .* não tem exigência específica no protocolo/,
  );
  assert.equal(rel.avisos()[0].idExigencia, null);
});

test('[A-01] o controlador expõe as regras aplicáveis ao CID atual (gerais primeiro)', async () => {
  const c = await novo();
  prepararFluxo(c, 'Alfa', 'C30.1');
  assert.deepEqual(
    c.regrasAplicaveis().map((r) => r.codigo),
    ['GER-T', 'ALF-3'],
  );
  assert.deepEqual(
    c.regrasEspecificas().map((r) => r.codigo),
    ['ALF-3'],
  );
  c.iniciar('Alfa');
  assert.throws(() => c.regrasAplicaveis(), /CID com formato válido/);
});

test('[B-04,RN02] CID genérico: só a pendência pede a troca; não há aviso de "sem regra específica"', async () => {
  const c = await novo();
  assert.equal(prepararFluxo(c, 'Alfa', 'Z00'), 'GENERICO');
  declarar(c, ['GT1', 'GT2']);
  const rel = c.verificar();
  assert.equal(rel.situacao, 'COM_PENDENCIAS');
  assert.deepEqual(
    rel.listarAchados().map((a) => a.tipo),
    ['CID_GENERICO'],
    'um achado só: a pendência do CID genérico',
  );
  assert.deepEqual(rel.avisos(), []);
  assert.doesNotMatch(c.exportar(), /Sem regra específica/);
});

test('[B-04,RN06] CID não genérico sem regra continua com o aviso "sem regra específica"', async () => {
  const c = await novo();
  assert.equal(prepararFluxo(c, 'Alfa', 'E50'), 'SEM_REGRA');
  declarar(c, ['GT1', 'GT2']);
  const rel = c.verificar();
  assert.equal(rel.situacao, 'SEM_PENDENCIAS');
  assert.deepEqual(
    rel.avisos().map((a) => a.tipo),
    ['CID_SEM_REGRA'],
  );
  assert.match(c.exportar(), /\nAVISOS\n- Sem regra específica no catálogo piloto/);
});
