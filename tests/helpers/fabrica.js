import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CarregadorCatalogo } from '../../src/js/controllers/carregador-catalogo.js';
import { ControladorVerificacao } from '../../src/js/controllers/controlador-verificacao.js';
import { ServicoExportacao } from '../../src/js/models/servico-exportacao.js';
import { MotorDeRegras } from '../../src/js/models/motor-de-regras.js';

export const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const CAMINHO_CATALOGO = path.join(RAIZ, 'servidor', 'banco', 'catalogo-inicial.json');
export const leitorDeArquivo = (caminho) => readFile(caminho, 'utf8');

export async function carregarCatalogoPiloto() {
  return new CarregadorCatalogo(leitorDeArquivo).carregar(CAMINHO_CATALOGO);
}

export async function lerCatalogoBruto() {
  return JSON.parse(await readFile(CAMINHO_CATALOGO, 'utf8'));
}

/** Carrega (e valida pelo esquema) um catálogo a partir do objeto bruto, sem tocar em disco. */
export async function carregarCatalogoDe(bruto) {
  return new CarregadorCatalogo(async () => JSON.stringify(bruto)).carregar('memoria.json');
}

export function controladorDo(catalogo) {
  return new ControladorVerificacao(catalogo, new MotorDeRegras(catalogo), new ServicoExportacao());
}

export async function novoControlador(bruto = null) {
  return controladorDo(bruto ? await carregarCatalogoDe(bruto) : await carregarCatalogoPiloto());
}

/* --- Construtores de catálogos sintéticos ------------------------------------------------------
 * Os testes de comportamento (motor, controlador, telas) usam catálogos criados aqui, para não
 * depender do conteúdo do catálogo piloto (M-05): trocar uma regra real não deve exigir mexer
 * nesses testes. O conteúdo do piloto é conferido à parte (tests/quality/).
 */
export const exigenciaDe = (idExigencia, carater = 'OBRIGATORIA', extra = {}) => ({
  idExigencia,
  descricao: `Exigência ${idExigencia}`,
  tipo: 'EXAME',
  carater,
  trechoDoProtocolo: `Trecho de teste de ${idExigencia}`,
  ...extra,
});

export const grupoDe = (modo, ...exigencias) => ({ modo, exigencias });

export const regraDe = ({ codigo, grupos, ...resto }) => ({
  codigo,
  indicacao: `Indicação ${codigo}`,
  abrangencia: 'ESPECIALIDADE',
  paginaNoProtocolo: 10,
  grupos,
  ...resto,
});

/**
 * Catálogo válido e pequeno: uma regra geral; três regras da especialidade "Alfa" (TODOS sem status;
 * faixa com AO_MENOS_UM e status PROVISORIA; regra mista com exceção e status VALIDADA); uma regra
 * sem exigências na especialidade "Beta".
 */
export function catalogoSinteticoBruto() {
  return {
    versao: '9.0.0',
    protocolo: {
      nome: 'Protocolo de teste',
      edicao: '1ª edição',
      ano: 2000,
      orgaoEmissor: 'Órgão de teste',
    },
    especialidades: ['Alfa', 'Beta'],
    cidsGenericos: ['Z00'],
    fundamentoCidGenerico: {
      trechoDoProtocolo: 'Evitar CID genérico (teste).',
      paginaNoProtocolo: 1,
    },
    regras: [
      regraDe({
        codigo: 'GER-T',
        abrangencia: 'GERAL',
        grupos: [
          grupoDe('TODOS', exigenciaDe('GT1')),
          grupoDe('TODOS', exigenciaDe('GT2', 'SE_DISPONIVEL')),
        ],
      }),
      regraDe({
        codigo: 'ALF-1',
        especialidade: 'Alfa',
        cidsAbrangidos: ['A10', 'A11.1'],
        grupos: [grupoDe('TODOS', exigenciaDe('ALF-1.1'))],
      }),
      regraDe({
        codigo: 'ALF-2',
        especialidade: 'Alfa',
        cidsAbrangidos: ['B20-B22'],
        status: 'PROVISORIA',
        observacao: 'Hipótese de teste: basta um dos exames.',
        grupos: [grupoDe('AO_MENOS_UM', exigenciaDe('ALF-2.1'), exigenciaDe('ALF-2.2'))],
      }),
      regraDe({
        codigo: 'ALF-3',
        especialidade: 'Alfa',
        cidsAbrangidos: ['C30'],
        excecoes: ['C30.5'],
        status: 'VALIDADA',
        validadaEm: '2026-12-01',
        validadaPor: 'Regulação (teste)',
        grupos: [
          grupoDe('TODOS', exigenciaDe('ALF-3.1')),
          grupoDe('AO_MENOS_UM', exigenciaDe('ALF-3.2'), exigenciaDe('ALF-3.3')),
        ],
      }),
      regraDe({
        codigo: 'BET-1',
        especialidade: 'Beta',
        cidsAbrangidos: ['D40'],
        observacao: 'O protocolo não lista pré-requisito específico (teste).',
        grupos: [],
      }),
    ],
  };
}

/** Inicia o fluxo: especialidade, CID e checklist gerado. Retorna a situação do CID. */
export function prepararFluxo(controlador, especialidade, cid) {
  controlador.iniciar(especialidade);
  const situacao = controlador.informarCID(cid);
  if (situacao !== 'FORMATO_INVALIDO') controlador.obterChecklist();
  return situacao;
}

/** Declara como atendidas as exigências indicadas (por idExigencia). */
export function declarar(controlador, idsDeExigencia) {
  for (const id of idsDeExigencia) {
    const item = controlador.encaminhamento.itens.find((i) => i.exigencia.idExigencia === id);
    if (!item) throw new Error(`Exigência fora do checklist: ${id}`);
    controlador.registrarAtendimento(item.idItem, true);
  }
}

export const GERAIS = ['G1', 'G2', 'G3', 'G4', 'G5'];
