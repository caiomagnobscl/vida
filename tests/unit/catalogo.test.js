import test from 'node:test';
import assert from 'node:assert/strict';
import { CatalogoDeRegras } from '../../src/js/models/catalogo.js';
import {
  carregarCatalogoDe,
  carregarCatalogoPiloto,
  catalogoSinteticoBruto,
  lerCatalogoBruto,
} from '../helpers/fabrica.js';

const codigos = (regras) => regras.map((r) => r.codigo);

test('[RF001] catálogo piloto expõe exatamente as duas especialidades do MVP', async () => {
  const catalogo = await carregarCatalogoPiloto();
  assert.deepEqual(catalogo.especialidades().sort(), ['Cardiologia', 'Gastroenterologia']);
});

test('[RF001,M-03] as especialidades seguem a ordem declarada no catálogo, não a das regras', async () => {
  const bruto = catalogoSinteticoBruto();
  bruto.especialidades = ['Beta', 'Alfa'];
  assert.deepEqual((await carregarCatalogoDe(bruto)).especialidades(), ['Beta', 'Alfa']);
});

test('[RN03] buscarRegras encontra a regra certa por especialidade e CID', async () => {
  const c = await carregarCatalogoPiloto();
  assert.deepEqual(codigos(c.buscarRegras('Cardiologia', 'R07.1')), ['CAR-01']);
  assert.deepEqual(codigos(c.buscarRegras('Cardiologia', 'I10')), ['CAR-02']);
  assert.deepEqual(codigos(c.buscarRegras('Cardiologia', 'Q23.4')), ['CAR-03']);
  assert.deepEqual(codigos(c.buscarRegras('Gastroenterologia', 'C26.0')), ['GAS-01']);
  assert.deepEqual(codigos(c.buscarRegras('Gastroenterologia', 'K27.3')), ['GAS-02']);
  assert.deepEqual(codigos(c.buscarRegras('Gastroenterologia', 'K59.0')), ['GAS-03']);
});

test('[RN04] CID fora das regras da especialidade não casa (inclusive entre especialidades)', async () => {
  const c = await carregarCatalogoPiloto();
  assert.equal(c.buscarRegras('Gastroenterologia', 'K27.8').length, 0);
  assert.equal(c.buscarRegras('Cardiologia', 'C26.9').length, 0);
  assert.equal(c.buscarRegras('Gastroenterologia', 'R07.1').length, 0);
});

test('[RN01] há uma regra geral com 5 exigências (G1–G4 obrigatórias, G5 se disponível)', async () => {
  const c = await carregarCatalogoPiloto();
  const [geral, ...outras] = c.regrasGerais();
  assert.equal(outras.length, 0);
  const caraters = Object.fromEntries(geral.exigencias().map((e) => [e.idExigencia, e.carater]));
  assert.deepEqual(caraters, {
    G1: 'OBRIGATORIA',
    G2: 'OBRIGATORIA',
    G3: 'OBRIGATORIA',
    G4: 'OBRIGATORIA',
    G5: 'SE_DISPONIVEL',
  });
});

test('[RN02] ehGenerico reconhece Z00, R50 e R68 (e subcategorias) e não os demais', async () => {
  const c = await carregarCatalogoPiloto();
  for (const g of ['Z00', 'R50', 'R68', 'R50.9']) assert.equal(c.ehGenerico(g), true, g);
  for (const e of ['R07.1', 'C26.9', 'R51']) assert.equal(c.ehGenerico(e), false, e);
});

test('[RF010,RNF006] fundamentar cita regra, trecho e página do protocolo', async () => {
  const c = await carregarCatalogoPiloto();
  const texto = c.fundamentar('CAR-01.1');
  assert.match(texto, /Regra CAR-01 — Dor torácica e precordialgia/);
  assert.match(texto, /ECG/);
  assert.match(texto, /4ª edição \(2025\), p\. 32/);
});

test('[RF010,RN02] fundamentar CID_GENERICO cita o trecho e a página 17', async () => {
  const c = await carregarCatalogoPiloto();
  const texto = c.fundamentar('CID_GENERICO');
  assert.match(texto, /Z00, R50, R68/);
  assert.match(texto, /p\. 17/);
});

test('[RF010] fundamentar de id desconhecido informa ausência em vez de falhar', async () => {
  const c = await carregarCatalogoPiloto();
  assert.match(c.fundamentar('XYZ'), /Sem fundamentação cadastrada/);
});

test('[RNF006] toda regra do catálogo piloto tem página positiva e toda exigência tem trecho', async () => {
  const c = await carregarCatalogoPiloto();
  for (const regra of c.regras) {
    assert.ok(
      Number.isInteger(regra.paginaNoProtocolo) && regra.paginaNoProtocolo > 0,
      regra.codigo,
    );
    for (const e of regra.exigencias()) assert.ok(e.trechoDoProtocolo.length > 5, e.idExigencia);
  }
});

test('[RF008] opcoesDeCID agrupa por regra, na ordem do catálogo, e só da especialidade pedida', async () => {
  const c = await carregarCatalogoDe(catalogoSinteticoBruto());
  const alfa = c.opcoesDeCID('Alfa');
  assert.deepEqual(
    alfa.map((g) => g.codigoDaRegra),
    ['ALF-1', 'ALF-2', 'ALF-3'],
  );
  assert.deepEqual(
    alfa[0].opcoes.map((o) => o.codigo),
    ['A10', 'A11.1'],
  );
  assert.deepEqual(
    alfa[1].opcoes.map((o) => o.codigo),
    ['B20', 'B21', 'B22'],
    'faixa B20-B22 expandida',
  );
  assert.deepEqual(
    c.opcoesDeCID('Beta').map((g) => g.codigoDaRegra),
    ['BET-1'],
  );
  assert.deepEqual(c.opcoesDeCID('Dermatologia'), []);
});

test('[RF008] no catálogo piloto, cada especialidade lista as regras dela na ordem do arquivo', async () => {
  const bruto = await lerCatalogoBruto();
  const c = await carregarCatalogoPiloto();
  for (const especialidade of c.especialidades()) {
    const esperado = bruto.regras
      .filter((r) => r.especialidade === especialidade)
      .map((r) => r.codigo);
    assert.deepEqual(
      c.opcoesDeCID(especialidade).map((g) => g.codigoDaRegra),
      esperado,
      especialidade,
    );
  }
});

test('[RF008] rótulos: código exato, categoria e subcategorias, e exceções', async () => {
  const c = await carregarCatalogoPiloto();
  const rotulos = Object.fromEntries(
    c.opcoesDeCID('Gastroenterologia').flatMap((g) => g.opcoes.map((o) => [o.codigo, o.rotulo])),
  );
  assert.equal(rotulos['C26.9'], 'C26.9');
  assert.equal(rotulos.K29, 'K29 e subcategorias');
  assert.equal(rotulos.K27, 'K27 e subcategorias (exceto K27.8)');
});

test('[RF008,RNF003] regra nova no catálogo aparece na lista de CIDs sem alterar código', async () => {
  const bruto = structuredClone(await lerCatalogoBruto());
  bruto.regras.push({
    codigo: 'CAR-99',
    indicacao: 'Insuficiência cardíaca',
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
  const grupos = CatalogoDeRegras.deObjeto(bruto).opcoesDeCID('Cardiologia');
  assert.deepEqual(grupos.at(-1).opcoes, [{ codigo: 'I50', rotulo: 'I50 e subcategorias' }]);
  assert.equal(grupos.at(-1).indicacao, 'Insuficiência cardíaca');
});

test('[RN04,A-01] regra provisória, validada e sem status: situação da interpretação', async () => {
  const c = await carregarCatalogoDe(catalogoSinteticoBruto());
  const regra = (codigo) => c.regras.find((r) => r.codigo === codigo);
  assert.equal(regra('ALF-1').ehProvisoria(), false);
  assert.equal(regra('ALF-1').notaDeStatus(), null, 'sem status = transcrição direta');
  assert.equal(regra('ALF-2').ehProvisoria(), true);
  assert.match(regra('ALF-2').notaDeStatus(), /interpretação provisória.*não confirmada/);
  assert.equal(regra('ALF-3').ehProvisoria(), false);
  assert.equal(
    regra('ALF-3').notaDeStatus(),
    'interpretação validada em 01/12/2026 por Regulação (teste)',
  );
  assert.equal(regra('BET-1').semExigenciaEspecifica(), true);
  assert.equal(regra('ALF-1').semExigenciaEspecifica(), false);
  assert.equal(regra('GER-T').semExigenciaEspecifica(), false, 'regra geral não conta');
});

test('[RF010,A-01] fundamentar mostra a situação da regra e a observação quando existem', async () => {
  const c = await carregarCatalogoDe(catalogoSinteticoBruto());
  const provisoria = c.fundamentar('ALF-2.1');
  assert.match(provisoria, /Situação da regra: interpretação provisória, ainda não confirmada/);
  assert.match(provisoria, /Observação: Hipótese de teste: basta um dos exames\./);
  assert.match(
    c.fundamentar('ALF-3.1'),
    /Situação da regra: interpretação validada em 01\/12\/2026/,
  );
  const comum = c.fundamentar('ALF-1.1');
  assert.doesNotMatch(comum, /Situação da regra|Observação/);
});
