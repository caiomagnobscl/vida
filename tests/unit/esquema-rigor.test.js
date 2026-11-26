/**
 * Rigor do esquema do catálogo (M-02, M-03): o que o validador aprova tem de ser o que o motor
 * cumpre, e erro de edição não pode virar comportamento errado em silêncio. Cada teste parte de
 * um catálogo sintético válido e faz uma única alteração.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { validarEsquema } from '../../src/js/models/esquema-catalogo.js';
import { problemaDoPadrao } from '../../src/js/models/cid.js';
import { catalogoSinteticoBruto } from '../helpers/fabrica.js';

/** Aplica a alteração a uma cópia do catálogo sintético e devolve os erros do esquema. */
function errosApos(alteracao) {
  const bruto = catalogoSinteticoBruto();
  alteracao(bruto);
  return validarEsquema(bruto);
}
const regra = (bruto, codigo) => bruto.regras.find((r) => r.codigo === codigo);

test('[RF011] o catálogo sintético usado nestes testes é válido', () => {
  assert.deepEqual(validarEsquema(catalogoSinteticoBruto()), []);
});

test('[RF011,M-02] faixa entre letras (C00-D48) é rejeitada com o caminho do campo', () => {
  const erros = errosApos((c) => regra(c, 'ALF-1').cidsAbrangidos.push('C00-D48'));
  assert.deepEqual(erros, [
    '$.regras[1].cidsAbrangidos[2]: faixa de CID inválida "C00-D48": início e fim devem ter a mesma letra (faixa entre letras não é suportada)',
  ]);
});

test('[RF011,M-02] faixa invertida (Q26-Q20) é rejeitada; faixa de uma só categoria é aceita', () => {
  const erros = errosApos((c) => (regra(c, 'ALF-2').cidsAbrangidos = ['Q26-Q20']));
  assert.deepEqual(erros, [
    '$.regras[2].cidsAbrangidos[0]: faixa de CID inválida "Q26-Q20": o início deve ser menor ou igual ao fim',
  ]);
  assert.deepEqual(
    errosApos((c) => (regra(c, 'ALF-2').cidsAbrangidos = ['Q20-Q20'])),
    [],
  );
});

test('[RF011,M-02] a mesma regra vale para exceções e para os CIDs genéricos', () => {
  const excecoes = errosApos((c) => (regra(c, 'ALF-3').excecoes = ['C30.1-C30.9']));
  assert.match(excecoes[0], /^\$\.regras\[3\]\.excecoes\[0\]: padrão de CID inválido/);
  const genericos = errosApos((c) => c.cidsGenericos.push('R50-R10'));
  assert.match(genericos[0], /^\$\.cidsGenericos\[1\]: faixa de CID inválida "R50-R10"/);
});

test('[RF008,M-02] problemaDoPadrao: aceita código, categoria e faixa; recusa o resto', () => {
  for (const ok of ['R07.1', 'I20', 'Q20-Q26', 'Q20-Q20']) assert.equal(problemaDoPadrao(ok), null);
  for (const ruim of ['XX', 'q20', 'R07.123', 'Q20-26', 'Q20-R26', 'Q26-Q20']) {
    assert.ok(problemaDoPadrao(ruim), ruim);
  }
});

test('[RF011,M-03] chave desconhecida é erro e sugere a grafia certa (excessoes → excecoes)', () => {
  const erros = errosApos((c) => {
    const alfa3 = regra(c, 'ALF-3');
    alfa3.excessoes = alfa3.excecoes;
    delete alfa3.excecoes;
  });
  assert.deepEqual(erros, [
    '$.regras[3].excessoes: chave desconhecida (você quis dizer "excecoes"?)',
  ]);
});

test('[RF011,M-03] chave desconhecida é detectada em todos os níveis do catálogo', () => {
  const erros = errosApos((c) => {
    c.extra = 1;
    c.protocolo.extra = 1;
    c.fundamentoCidGenerico.extra = 1;
    regra(c, 'ALF-1').extra = 1;
    regra(c, 'ALF-1').grupos[0].extra = 1;
    regra(c, 'ALF-1').grupos[0].exigencias[0].extra = 1;
  });
  assert.deepEqual(
    erros.map((e) => e.split(':')[0]),
    [
      '$.extra',
      '$.protocolo.extra',
      '$.fundamentoCidGenerico.extra',
      '$.regras[1].extra',
      '$.regras[1].grupos[0].extra',
      '$.regras[1].grupos[0].exigencias[0].extra',
    ],
  );
});

test('[RF011,M-03] a chave de comentário "transcricao" continua permitida na raiz', () => {
  assert.deepEqual(
    errosApos((c) => (c.transcricao = 'Trechos transcritos do protocolo.')),
    [],
  );
});

test('[RF011,M-03] especialidade com grafia diferente da declarada é erro com sugestão', () => {
  const erros = errosApos((c) => (regra(c, 'ALF-1').especialidade = 'alfa'));
  assert.deepEqual(erros, [
    '$.regras[1].especialidade: "alfa" não está em $.especialidades (você quis dizer "Alfa"?)',
  ]);
});

test('[RF011,M-03] regra de especialidade sem o campo especialidade é erro', () => {
  assert.deepEqual(
    errosApos((c) => delete regra(c, 'ALF-1').especialidade),
    ['$.regras[1].especialidade: texto obrigatório'],
  );
});

test('[RF011,M-03] especialidade desconhecida, sem parecido na lista, é erro sem sugestão', () => {
  const erros = errosApos((c) => (regra(c, 'ALF-1').especialidade = 'Oncologia'));
  assert.deepEqual(erros, ['$.regras[1].especialidade: "Oncologia" não está em $.especialidades']);
});

test('[RF011,M-03] $.especialidades é obrigatória, sem repetição e sem especialidade vazia de regras', () => {
  assert.deepEqual(
    errosApos((c) => delete c.especialidades),
    ['$.especialidades: lista não vazia obrigatória'],
  );
  assert.deepEqual(
    errosApos((c) => c.especialidades.push('Alfa')),
    ['$.especialidades[2]: duplicado "Alfa"'],
  );
  assert.deepEqual(
    errosApos((c) => c.especialidades.push('Gama')),
    ['$.especialidades[2]: "Gama" não tem nenhuma regra'],
  );
});

test('[RF011,M-03] regra GERAL não pode trazer especialidade, CIDs nem exceções (seriam ignorados)', () => {
  const erros = errosApos((c) => {
    Object.assign(regra(c, 'GER-T'), {
      especialidade: 'Alfa',
      cidsAbrangidos: ['A10'],
      excecoes: ['A10.1'],
    });
  });
  assert.deepEqual(
    erros.map((e) => e.split(':')[0]),
    ['$.regras[0].especialidade', '$.regras[0].cidsAbrangidos', '$.regras[0].excecoes'],
  );
});

test('[RF011] listas com tipo errado geram erro com caminho, nunca exceção (excecoes: "K27.8")', () => {
  assert.deepEqual(
    errosApos((c) => (regra(c, 'ALF-3').excecoes = 'C30.5')),
    ['$.regras[3].excecoes: deve ser uma lista de padrões de CID'],
  );
  assert.deepEqual(
    errosApos((c) => (regra(c, 'ALF-1').cidsAbrangidos = 'A10')),
    ['$.regras[1].cidsAbrangidos: lista não vazia obrigatória'],
  );
  assert.deepEqual(
    errosApos((c) => (c.cidsGenericos = 'Z00')),
    ['$.cidsGenericos: lista não vazia obrigatória'],
  );
});

test('[RF011] formas inesperadas (null, texto, lista no lugar de objeto) não derrubam o validador', () => {
  const formas = [null, 'texto', 7, [], {}];
  for (const forma of formas) assert.ok(validarEsquema(forma).length > 0);
  for (const caminho of ['protocolo', 'fundamentoCidGenerico', 'regras', 'especialidades']) {
    for (const forma of formas) {
      const bruto = catalogoSinteticoBruto();
      bruto[caminho] = forma;
      assert.doesNotThrow(() => validarEsquema(bruto), `${caminho} = ${JSON.stringify(forma)}`);
      assert.ok(validarEsquema(bruto).length > 0, `${caminho} = ${JSON.stringify(forma)}`);
    }
  }
  const bruto = catalogoSinteticoBruto();
  bruto.regras = [null, 'x', [], { grupos: [null, 'y'] }];
  assert.doesNotThrow(() => validarEsquema(bruto));
  assert.equal(validarEsquema([]).length, 1, 'lista na raiz não é um objeto de catálogo');
});

test('[RF011,A-01] status inválido é erro; sem status a regra é transcrição direta e é válida', () => {
  assert.deepEqual(
    errosApos((c) => (regra(c, 'ALF-1').status = 'PENDENTE')),
    ['$.regras[1].status: valor inválido'],
  );
  assert.deepEqual(
    errosApos((c) => delete regra(c, 'ALF-2').status),
    [],
  );
});

test('[RF011,A-01] regra PROVISORIA exige observação dizendo o que falta confirmar', () => {
  const erros = errosApos((c) => delete regra(c, 'ALF-2').observacao);
  assert.deepEqual(erros, [
    '$.regras[2].observacao: obrigatória quando a regra é PROVISORIA (diga o que falta confirmar)',
  ]);
});

test('[RF011,A-01] regra VALIDADA exige data real (AAAA-MM-DD) e quem validou', () => {
  const faltando = errosApos((c) => {
    delete regra(c, 'ALF-3').validadaEm;
    delete regra(c, 'ALF-3').validadaPor;
  });
  assert.deepEqual(faltando, [
    '$.regras[3].validadaEm: data AAAA-MM-DD obrigatória quando a regra é VALIDADA',
    '$.regras[3].validadaPor: texto obrigatório quando a regra é VALIDADA',
  ]);
  for (const ruim of ['2026-02-30', '01/12/2026', '2026-13-01', 20261201]) {
    const erros = errosApos((c) => (regra(c, 'ALF-3').validadaEm = ruim));
    assert.match(erros[0], /validadaEm: data AAAA-MM-DD obrigatória/, String(ruim));
  }
});

test('[RF011,A-01] validadaEm e validadaPor só valem com status VALIDADA', () => {
  const erros = errosApos((c) => {
    Object.assign(regra(c, 'ALF-2'), { validadaEm: '2026-12-01', validadaPor: 'Alguém' });
  });
  assert.deepEqual(erros, [
    '$.regras[2].validadaEm: só se aplica a regra VALIDADA',
    '$.regras[2].validadaPor: só se aplica a regra VALIDADA',
  ]);
});
