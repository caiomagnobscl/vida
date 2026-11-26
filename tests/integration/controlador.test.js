import test from 'node:test';
import assert from 'node:assert/strict';
import { Etapa } from '../../src/js/controllers/controlador-verificacao.js';
import {
  GERAIS,
  catalogoSinteticoBruto,
  declarar,
  novoControlador,
  prepararFluxo,
} from '../helpers/fabrica.js';

test('[RF001] iniciar rejeita especialidade fora do catálogo piloto e operações exigem fluxo iniciado', async () => {
  const c = await novoControlador();
  assert.throws(() => c.iniciar('Dermatologia'), /fora do catálogo piloto/);
  assert.throws(() => c.informarCID('R07.1'), /Selecione a especialidade/);
  assert.throws(() => c.registrarAtendimento('ITEM-G1', true), /Selecione a especialidade/);
  assert.equal(c.estado(), 'Inicial');
});

test('[RF002,RF008] checklist = exigências gerais + da especialidade, na ordem das regras', async () => {
  const c = await novoControlador();
  prepararFluxo(c, 'Cardiologia', 'r07.1');
  assert.deepEqual(
    c.encaminhamento.itens.map((i) => i.exigencia.idExigencia),
    ['G1', 'G2', 'G3', 'G4', 'G5', 'CAR-01.1'],
  );
  assert.equal(c.encaminhamento.cid, 'R07.1', 'CID normalizado');
});

test('[RF002] GAS-03 (sem pré-requisito específico) → só exigências gerais, CID válido', async () => {
  const c = await novoControlador();
  assert.equal(prepararFluxo(c, 'Gastroenterologia', 'K29.7'), 'VALIDO');
  assert.equal(c.encaminhamento.itens.length, 5);
});

test('[RF005,ST-01] verificar leva a Verificado; qualquer alteração volta à preparação e invalida o relatório', async () => {
  const c = await novoControlador();
  prepararFluxo(c, 'Cardiologia', 'R07.1');
  assert.equal(c.estado(), 'EmPreparacao.CIDValido');
  declarar(c, [...GERAIS, 'CAR-01.1']);
  c.verificar();
  assert.equal(c.estado(), 'Verificado.SemPendencias');
  c.registrarAtendimento('ITEM-CAR-01.1', false);
  assert.equal(c.estado(), 'EmPreparacao.CIDValido');
  assert.throws(() => c.exportar(), /Não há relatório válido/);
  c.verificar();
  assert.equal(c.estado(), 'Verificado.ComPendencias');
  c.informarCID('I10');
  assert.equal(c.relatorio, null, 'trocar o CID invalida o relatório');
});

test('[RF008] estados de preparação por situação do CID', async () => {
  const c = await novoControlador();
  c.iniciar('Gastroenterologia');
  assert.equal(c.estado(), 'EmPreparacao.AguardandoCID');
  c.informarCID('R50');
  assert.equal(c.estado(), 'EmPreparacao.CIDGenerico');
  c.informarCID('K27.8');
  assert.equal(c.estado(), 'EmPreparacao.CIDSemRegra');
  c.informarCID('zz');
  assert.equal(c.estado(), 'EmPreparacao.AguardandoCID');
});

test('[RF005] verificar exige CID válido e checklist gerado', async () => {
  const c = await novoControlador();
  c.iniciar('Cardiologia');
  assert.throws(() => c.verificar(), /CID com formato válido/);
  c.informarCID('R07.1');
  assert.throws(() => c.verificar(), /Gere o checklist/);
});

test('[RF009] trocar a especialidade reinicia o encaminhamento; trocar o CID preserva declarações comuns', async () => {
  const c = await novoControlador();
  prepararFluxo(c, 'Cardiologia', 'R07.1');
  declarar(c, ['G1', 'G2']);
  c.informarCID('I10');
  c.obterChecklist();
  assert.equal(
    c.encaminhamento.atendeu('G1'),
    true,
    'G1 preservado ao trocar de CAR-01 para CAR-02',
  );
  c.iniciar('Gastroenterologia');
  assert.equal(c.encaminhamento.itens.length, 0);
});

test('[RF010] obterFundamentacao delega ao catálogo', async () => {
  const c = await novoControlador();
  assert.match(c.obterFundamentacao('GAS-01.1'), /p\. 58/);
});

test('[RF007,RN07] exportar devolve o texto do relatório vigente, com contexto e aviso de alcance', async () => {
  const c = await novoControlador();
  prepararFluxo(c, 'Cardiologia', 'R07.1');
  declarar(c, GERAIS);
  c.verificar();
  const texto = c.exportar();
  assert.match(texto, /Especialidade: Cardiologia · CID: R07\.1/);
  assert.match(texto, /Protocolo SES-SE e SMS Aracaju, 4ª edição \(2025\)/);
  assert.match(texto, /ECG \(eletrocardiograma\) anexado|Pendente: ECG/);
});

test('[RF008] listarOpcoesDeCID exige a especialidade escolhida e devolve as indicações dela', async () => {
  const c = await novoControlador(catalogoSinteticoBruto());
  assert.throws(() => c.listarOpcoesDeCID(), /Selecione a especialidade/);
  c.iniciar('Alfa');
  assert.deepEqual(
    c.listarOpcoesDeCID().map((g) => g.codigoDaRegra),
    ['ALF-1', 'ALF-2', 'ALF-3'],
  );
  c.iniciar('Beta');
  assert.deepEqual(
    c.listarOpcoesDeCID().map((g) => g.codigoDaRegra),
    ['BET-1'],
  );
});

test('[M-11,ST-01] etapaMaxima: seleção sempre; checklist com CID válido; relatório depois de verificar', async () => {
  const c = await novoControlador();
  assert.equal(c.etapaMaxima(), Etapa.SELECAO, 'sem encaminhamento');
  c.iniciar('Cardiologia');
  assert.equal(c.etapaMaxima(), Etapa.SELECAO, 'sem CID');
  c.informarCID('zz');
  assert.equal(c.etapaMaxima(), Etapa.SELECAO, 'CID com formato inválido');
  c.informarCID('R50'); // genérico: há checklist (só as exigências gerais)
  assert.equal(c.etapaMaxima(), Etapa.CHECKLIST);
  c.informarCID('C26.9'); // sem regra: idem
  assert.equal(c.etapaMaxima(), Etapa.CHECKLIST);
  c.informarCID('R07.1');
  c.obterChecklist();
  assert.equal(c.etapaMaxima(), Etapa.CHECKLIST);
  c.verificar();
  assert.equal(c.etapaMaxima(), Etapa.RELATORIO);
  c.registrarAtendimento('ITEM-G1', true); // qualquer alteração invalida o relatório
  assert.equal(c.etapaMaxima(), Etapa.CHECKLIST);
});

test('[B-02,ST-01] reiniciar descarta encaminhamento e relatório e volta ao estado inicial', async () => {
  const c = await novoControlador();
  prepararFluxo(c, 'Cardiologia', 'R07.1');
  c.verificar();
  c.reiniciar();
  assert.equal(c.encaminhamento, null);
  assert.equal(c.relatorio, null);
  assert.equal(c.estado(), 'Inicial');
  assert.equal(c.etapaMaxima(), Etapa.SELECAO);
  c.reiniciar(); // repetir não faz mal
  assert.equal(c.estado(), 'Inicial');
});
