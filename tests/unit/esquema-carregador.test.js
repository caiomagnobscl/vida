import test from 'node:test';
import assert from 'node:assert/strict';
import { CarregadorCatalogo } from '../../src/js/controllers/carregador-catalogo.js';
import { CatalogoInvalidoError } from '../../src/js/models/erros.js';
import { validarEsquema } from '../../src/js/models/esquema-catalogo.js';
import { InterfaceManutencao } from '../../src/js/views/interface-manutencao.js';
import { CatalogoDeRegras } from '../../src/js/models/catalogo.js';
import { catalogoSinteticoBruto, lerCatalogoBruto } from '../helpers/fabrica.js';

const clonar = (o) => structuredClone(o);

test('[RF011] catálogo piloto real é válido (nenhum erro de esquema)', async () => {
  assert.deepEqual(validarEsquema(await lerCatalogoBruto()), []);
});

test('[RF011] não-objeto é rejeitado de imediato', () => {
  assert.deepEqual(validarEsquema(null), ['$: o catálogo deve ser um objeto JSON']);
  assert.deepEqual(validarEsquema('texto'), ['$: o catálogo deve ser um objeto JSON']);
});

test('[RF011,RNF006] regra sem página é rejeitada com mensagem apontando o campo', async () => {
  const c = clonar(await lerCatalogoBruto());
  delete c.regras[1].paginaNoProtocolo;
  const erros = validarEsquema(c);
  assert.ok(
    erros.some((e) => e.startsWith('$.regras[1].paginaNoProtocolo')),
    erros.join('\n'),
  );
});

test('[RF011] ids duplicados (regra e exigência) são rejeitados', async () => {
  const c = clonar(await lerCatalogoBruto());
  c.regras[2].codigo = c.regras[1].codigo;
  c.regras[2].grupos[0].exigencias[0].idExigencia = 'G1';
  const erros = validarEsquema(c);
  assert.ok(erros.some((e) => e.includes('codigo: duplicado')));
  assert.ok(erros.some((e) => e.includes('idExigencia: duplicado "G1"')));
});

test('[RF011,RN06] grupo com carateres diferentes é rejeitado', async () => {
  const c = clonar(await lerCatalogoBruto());
  c.regras[0].grupos[0].exigencias[0].carater = 'SE_DISPONIVEL';
  assert.ok(validarEsquema(c).some((e) => e.includes('mesmo caráter')));
});

test('[RF011] padrão de CID inválido, modo inválido e versão inválida são rejeitados', async () => {
  const c = clonar(await lerCatalogoBruto());
  c.versao = '1.0';
  c.regras[1].cidsAbrangidos.push('XX');
  c.regras[1].grupos[0].modo = 'ALGUM';
  const erros = validarEsquema(c);
  assert.ok(erros.some((e) => e.startsWith('$.versao')));
  assert.ok(erros.some((e) => e.includes('padrão de CID inválido "XX"')));
  assert.ok(erros.some((e) => e.endsWith('.modo: valor inválido')));
});

test('[RF011] regra sem grupos exige observação; regra de especialidade exige CIDs', async () => {
  const c = clonar(await lerCatalogoBruto());
  const gas03 = c.regras.find((r) => r.codigo === 'GAS-03');
  delete gas03.observacao;
  gas03.cidsAbrangidos = [];
  const erros = validarEsquema(c);
  assert.ok(erros.some((e) => e.includes('observacao: obrigatória')));
  assert.ok(erros.some((e) => e.includes('cidsAbrangidos: lista não vazia')));
});

test('[RF011] regras vazias, protocolo incompleto e grupos ausentes geram erros', async () => {
  const c = clonar(await lerCatalogoBruto());
  c.protocolo = { nome: '' };
  c.cidsGenericos = [];
  c.fundamentoCidGenerico = {};
  c.regras[1].grupos = 'nenhum';
  c.regras[0].grupos[0].exigencias = [];
  const erros = validarEsquema(c);
  for (const trecho of [
    '$.protocolo.nome',
    '$.protocolo.ano',
    '$.cidsGenericos',
    'fundamentoCidGenerico.paginaNoProtocolo',
    'grupos: lista obrigatória',
    'exigencias: lista não vazia',
  ]) {
    assert.ok(
      erros.some((e) => e.includes(trecho)),
      trecho,
    );
  }
  assert.ok(
    validarEsquema({ ...clonar(await lerCatalogoBruto()), regras: [] }).some((e) =>
      e.startsWith('$.regras'),
    ),
  );
});

test('[RF011] carregador: JSON malformado vira CatalogoInvalidoError', async () => {
  const carregador = new CarregadorCatalogo(async () => '{ não é json');
  await assert.rejects(
    () => carregador.carregar('x.json'),
    (e) => e instanceof CatalogoInvalidoError && e.erros[0].includes('JSON inválido'),
  );
});

test('[RF011] carregador: esquema inválido vira CatalogoInvalidoError com a lista de erros', async () => {
  const carregador = new CarregadorCatalogo(async () => JSON.stringify({ versao: '1.0.0' }));
  await assert.rejects(
    () => carregador.carregar('x.json'),
    (e) => e instanceof CatalogoInvalidoError && e.erros.length > 1,
  );
});

test('[RF011,RNF003] carregador: catálogo válido gera CatalogoDeRegras sem tocar no código', async () => {
  const bruto = await lerCatalogoBruto();
  const carregador = new CarregadorCatalogo(async () => JSON.stringify(bruto));
  assert.ok((await carregador.carregar('x.json')) instanceof CatalogoDeRegras);
});

test('[RF011,RNF003] adicionar uma regra nova só no JSON a torna aplicável (extensibilidade por dados)', async () => {
  const bruto = clonar(await lerCatalogoBruto());
  bruto.regras.push({
    codigo: 'CAR-99',
    indicacao: 'Regra de teste',
    abrangencia: 'ESPECIALIDADE',
    especialidade: 'Cardiologia',
    cidsAbrangidos: ['I50'],
    paginaNoProtocolo: 34,
    grupos: [
      {
        modo: 'TODOS',
        exigencias: [
          {
            idExigencia: 'CAR-99.1',
            descricao: 'Relatório médico',
            tipo: 'DOCUMENTO',
            carater: 'OBRIGATORIA',
            trechoDoProtocolo: 'Relatório Médico detalhado',
          },
        ],
      },
    ],
  });
  const catalogo = await new CarregadorCatalogo(async () => JSON.stringify(bruto)).carregar(
    'x.json',
  );
  assert.deepEqual(
    catalogo.buscarRegras('Cardiologia', 'I50.0').map((r) => r.codigo),
    ['CAR-99'],
  );
});

test('[RF011] interface de manutenção relata sucesso e erros e repassa falhas inesperadas', async () => {
  const saidas = [];
  const bruto = catalogoSinteticoBruto();
  const ok = await new InterfaceManutencao(
    new CarregadorCatalogo(async () => JSON.stringify(bruto)),
    (l) => saidas.push(l),
  ).validarCatalogo('x');
  assert.equal(ok.ok, true);
  assert.deepEqual([ok.regras, ok.exigencias], [5, 8]);
  assert.equal(saidas[0], 'Catálogo válido: versão 9.0.0, 5 regras, 8 exigências.');
  const ruim = await new InterfaceManutencao(new CarregadorCatalogo(async () => '{}'), (l) =>
    saidas.push(l),
  ).validarCatalogo('x');
  assert.equal(ruim.ok, false);
  assert.ok(saidas.some((l) => l.includes('Catálogo inválido')));
  const quebrado = new InterfaceManutencao(
    new CarregadorCatalogo(async () => {
      throw new Error('disco');
    }),
  );
  await assert.rejects(() => quebrado.validarCatalogo('x'), /disco/);
});

test('[RF011,RNF006] página do protocolo deve ser inteiro positivo: 0, negativo, decimal e texto são rejeitados', async () => {
  for (const invalida of [0, -3, 1.5, '58']) {
    const c = clonar(await lerCatalogoBruto());
    c.regras[1].paginaNoProtocolo = invalida;
    const erros = validarEsquema(c);
    assert.ok(
      erros.some((e) => e.startsWith('$.regras[1].paginaNoProtocolo')),
      `página ${JSON.stringify(invalida)} deveria ser rejeitada`,
    );
  }
});
