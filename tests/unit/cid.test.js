import test from 'node:test';
import assert from 'node:assert/strict';
import {
  casaComAlgum,
  casaComPadrao,
  expandirPadrao,
  formatoValido,
  normalizarCID,
} from '../../src/js/models/cid.js';

test('[RF008] formato de CID: aceita letra + 2 dígitos + subcategoria opcional', () => {
  for (const ok of ['R07.1', 'I20', 'K27.8', 'C26.9', 'r07.1', ' Q21 ', 'A00.12']) {
    assert.equal(formatoValido(ok), true, ok);
  }
});

test('[RF008] formato de CID: rejeita entradas malformadas', () => {
  for (const ruim of [
    '7X',
    'R7',
    'R071',
    'R07.',
    'R07.123',
    'RR07',
    '',
    '   ',
    null,
    undefined,
    'R07,1',
  ]) {
    assert.equal(formatoValido(ruim), false, String(ruim));
  }
});

test('[RF008] normalizarCID remove espaços e usa maiúsculas', () => {
  assert.equal(normalizarCID('  r07.1 '), 'R07.1');
  assert.equal(normalizarCID(null), '');
});

test('[RN03] padrão de categoria casa a categoria e suas subcategorias', () => {
  assert.equal(casaComPadrao('I20', 'I20'), true);
  assert.equal(casaComPadrao('I20.9', 'I20'), true);
  assert.equal(casaComPadrao('I21', 'I20'), false);
});

test('[RN03] padrão com ponto casa apenas o código exato', () => {
  assert.equal(casaComPadrao('R07.1', 'R07.1'), true);
  assert.equal(casaComPadrao('R07.2', 'R07.1'), false);
  assert.equal(casaComPadrao('R07', 'R07.1'), false);
});

test('[RN03] faixa Q20-Q26 inclui limites e exclui fora e outras letras', () => {
  for (const dentro of ['Q20', 'Q21', 'Q26', 'Q26.9'])
    assert.equal(casaComPadrao(dentro, 'Q20-Q26'), true, dentro);
  for (const fora of ['Q19', 'Q27', 'R21', 'P23'])
    assert.equal(casaComPadrao(fora, 'Q20-Q26'), false, fora);
});

test('[RN04] exceções excluem códigos que o padrão geral cobriria (K27 exceto K27.8)', () => {
  assert.equal(casaComAlgum('K27.3', ['K27'], ['K27.8']), true);
  assert.equal(casaComAlgum('K27.8', ['K27'], ['K27.8']), false);
});

test('[RF008] código inválido nunca casa com padrão algum', () => {
  assert.equal(casaComPadrao('7X', 'I20'), false);
  assert.equal(casaComAlgum('', ['I20']), false);
});

test('[RF008] expandirPadrao: faixa vira lista de categorias; demais padrões não mudam', () => {
  assert.deepEqual(expandirPadrao('Q20-Q26'), ['Q20', 'Q21', 'Q22', 'Q23', 'Q24', 'Q25', 'Q26']);
  assert.deepEqual(expandirPadrao('q05-q06'), ['Q05', 'Q06']);
  assert.deepEqual(expandirPadrao('R07.1'), ['R07.1']);
  assert.deepEqual(expandirPadrao('I20'), ['I20']);
  assert.deepEqual(expandirPadrao('Q26-Q20'), [], 'faixa invertida não gera opções');
});
