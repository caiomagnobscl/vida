/** RNF006 (determinismo) e RNF002 (desempenho): ensaios repetidos sobre o catálogo piloto real. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { GERAIS, declarar, novoControlador, prepararFluxo } from '../helpers/fabrica.js';

const CENARIOS = [
  ['Cardiologia', 'R07.1', ['G1', 'G2', 'G3', 'G4']],
  ['Cardiologia', 'Q21', [...GERAIS, 'CAR-03.1']],
  ['Gastroenterologia', 'C26.9', [...GERAIS, 'GAS-01.2']],
  ['Gastroenterologia', 'K27.3', GERAIS],
  ['Cardiologia', 'R68', GERAIS],
];

async function executar([esp, cid, declaradas]) {
  const c = await novoControlador();
  prepararFluxo(c, esp, cid);
  declarar(c, declaradas);
  const rel = c.verificar();
  return c.servicoExportacao.gerarTexto(rel, { incluirData: false });
}

test('[RNF006] mesma entrada → mesmo resultado em 30 execuções, para cada cenário', async () => {
  for (const cenario of CENARIOS) {
    const saidas = new Set();
    for (let i = 0; i < 30; i += 1) saidas.add(await executar(cenario));
    assert.equal(saidas.size, 1, `resultado variou para ${cenario[0]} ${cenario[1]}`);
  }
});

test('[RNF002] verificar + exportar: p95 de 30 execuções ≤ 2 s (medido no motor, sem renderização)', async () => {
  const tempos = [];
  for (let i = 0; i < 30; i += 1) {
    const c = await novoControlador();
    prepararFluxo(c, 'Gastroenterologia', 'C26.9');
    declarar(c, GERAIS);
    const inicio = performance.now();
    c.verificar();
    c.exportar();
    tempos.push(performance.now() - inicio);
  }
  tempos.sort((a, b) => a - b);
  const p95 = tempos[Math.ceil(0.95 * tempos.length) - 1];
  assert.ok(p95 <= 2000, `p95=${p95.toFixed(2)} ms`);
});
