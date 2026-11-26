/**
 * Casos de teste CT01–CT09 do P2 (seção 6.3), automatizados sobre o catálogo piloto real.
 * Cada caso exercita o caminho completo: controlador → catálogo → motor → relatório.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { GERAIS, declarar, novoControlador, prepararFluxo } from '../helpers/fabrica.js';

const tipos = (rel) => rel.listarAchados().map((a) => a.tipo);

test('CT01 [RF004,RF005,RN03] Cardiologia · R07.1 com G1–G5 e ECG atendidos → SEM_PENDENCIAS, 0 achados', async () => {
  const c = await novoControlador();
  prepararFluxo(c, 'Cardiologia', 'R07.1');
  declarar(c, [...GERAIS, 'CAR-01.1']);
  const rel = c.verificar();
  assert.equal(rel.situacao, 'SEM_PENDENCIAS');
  assert.equal(rel.listarAchados().length, 0);
});

test('CT02 [RF004,RF005,RN03] Cardiologia · R07.1 sem ECG e sem G5 → 1 pendência (ECG) e 1 recomendação (G5)', async () => {
  const c = await novoControlador();
  prepararFluxo(c, 'Cardiologia', 'R07.1');
  declarar(c, ['G1', 'G2', 'G3', 'G4']);
  const rel = c.verificar();
  assert.equal(rel.situacao, 'COM_PENDENCIAS');
  assert.deepEqual(
    rel.pendencias().map((a) => a.idExigencia),
    ['CAR-01.1'],
  );
  assert.deepEqual(
    rel.recomendacoes().map((a) => a.idExigencia),
    ['G5'],
  );
});

test('CT03 [RF004,RN03,RN06] Cardiologia · Q21 com ECG e sem ECO → 1 pendência (ECO), grupo TODOS', async () => {
  const c = await novoControlador();
  prepararFluxo(c, 'Cardiologia', 'Q21');
  declarar(c, [...GERAIS, 'CAR-03.1']);
  const rel = c.verificar();
  assert.equal(rel.situacao, 'COM_PENDENCIAS');
  assert.deepEqual(
    rel.pendencias().map((a) => a.idExigencia),
    ['CAR-03.2'],
  );
});

test('CT04 [RF004,RN04,RN06] Gastroenterologia · C26.9 sem nenhum exame → 1 única pendência de grupo (GAS-01)', async () => {
  const c = await novoControlador();
  prepararFluxo(c, 'Gastroenterologia', 'C26.9');
  declarar(c, GERAIS);
  const rel = c.verificar();
  assert.equal(rel.situacao, 'COM_PENDENCIAS');
  assert.equal(rel.pendencias().length, 1);
  assert.equal(rel.pendencias()[0].idsDeItens.length, 4);
});

test('CT05 [RF004,RN04,RN06] Gastroenterologia · C26.9 só com colonoscopia → SEM_PENDENCIAS (AO_MENOS_UM)', async () => {
  const c = await novoControlador();
  prepararFluxo(c, 'Gastroenterologia', 'C26.9');
  declarar(c, [...GERAIS, 'GAS-01.3']);
  const rel = c.verificar();
  assert.equal(rel.situacao, 'SEM_PENDENCIAS');
  assert.equal(rel.pendencias().length, 0);
  assert.deepEqual(
    tipos(rel),
    ['REGRA_PROVISORIA'],
    'o único achado é o aviso de que a interpretação "ao menos um" ainda é provisória (A-01)',
  );
});

test('CT06 [RF004,RN04,RN06] Gastroenterologia · K27.3 sem EDA e sem H. pylori → SEM_PENDENCIAS com 2 recomendações', async () => {
  const c = await novoControlador();
  prepararFluxo(c, 'Gastroenterologia', 'K27.3');
  declarar(c, GERAIS);
  const rel = c.verificar();
  assert.equal(rel.situacao, 'SEM_PENDENCIAS');
  assert.equal(rel.recomendacoes().length, 2);
  assert.equal(rel.pendencias().length, 0);
});

test('CT07 [RF003,RN02] Qualquer especialidade · R68 → COM_PENDENCIAS com 1 pendência CID_GENERICO', async () => {
  const c = await novoControlador();
  const situacao = prepararFluxo(c, 'Cardiologia', 'R68');
  declarar(c, GERAIS);
  const rel = c.verificar();
  assert.equal(situacao, 'GENERICO');
  assert.equal(c.obterChecklist().length, 5, 'CID genérico: só exigências gerais');
  assert.equal(rel.situacao, 'COM_PENDENCIAS');
  assert.deepEqual(
    rel.pendencias().map((a) => a.tipo),
    ['CID_GENERICO'],
  );
});

test('CT08 [RF004,RN06] Gastroenterologia · K27.8 → SEM_PENDENCIAS com aviso CID_SEM_REGRA', async () => {
  const c = await novoControlador();
  const situacao = prepararFluxo(c, 'Gastroenterologia', 'K27.8');
  declarar(c, GERAIS);
  const rel = c.verificar();
  assert.equal(situacao, 'SEM_REGRA');
  assert.equal(rel.situacao, 'SEM_PENDENCIAS');
  assert.deepEqual(tipos(rel), ['CID_SEM_REGRA']);
});

test('CT09 [RF008] Cardiologia · "7X" → FORMATO_INVALIDO e checklist não é gerado', async () => {
  const c = await novoControlador();
  c.iniciar('Cardiologia');
  assert.equal(c.informarCID('7X'), 'FORMATO_INVALIDO');
  assert.throws(() => c.obterChecklist(), /CID com formato válido/);
});
