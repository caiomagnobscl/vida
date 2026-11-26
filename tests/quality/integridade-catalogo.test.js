/**
 * RNF006: guarda de regressão da fonte das regras. O conteúdo conferido no protocolo oficial
 * (4ª ed., 2025) fica num único instantâneo (tests/quality/instantaneo-catalogo.json), atualizado
 * por comando; os demais testes não dependem das regras reais (M-05).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { CAMINHO_INSTANTANEO, lerResumoAtual } from '../helpers/instantaneo-catalogo.js';
import { carregarCatalogoPiloto } from '../helpers/fabrica.js';

test('[RNF006,RN01,RN03,RN04] o conteúdo do catálogo piloto é o instantâneo conferido', async () => {
  const guardado = JSON.parse(await readFile(CAMINHO_INSTANTANEO, 'utf8'));
  assert.deepEqual(
    await lerResumoAtual(),
    guardado,
    'O catálogo piloto mudou. Se foi de propósito: rode `node tests/helpers/instantaneo-catalogo.js`, revise o ' +
      'diff, aumente a versão do catálogo e registre a dupla conferência das regras.',
  );
});

test('[RNF006,RN04,A-01] GAS-01 e GAS-02 são hipóteses (Q05): estão marcadas PROVISORIA, com a explicação', async () => {
  const c = await carregarCatalogoPiloto();
  for (const codigo of ['GAS-01', 'GAS-02']) {
    const regra = c.regras.find((r) => r.codigo === codigo);
    assert.equal(regra.ehProvisoria(), true, codigo);
    assert.match(regra.observacao, /Q05/, codigo);
  }
});

test('[RNF006,A-01] toda regra provisória tem observação e toda regra validada diz quando e por quem', async () => {
  const c = await carregarCatalogoPiloto();
  for (const regra of c.regras) {
    if (regra.status === 'PROVISORIA') assert.ok(regra.observacao, regra.codigo);
    if (regra.status === 'VALIDADA') assert.ok(regra.validadaEm && regra.validadaPor, regra.codigo);
  }
});
