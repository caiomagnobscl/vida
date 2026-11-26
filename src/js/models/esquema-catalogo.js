/**
 * Validação do esquema do catálogo de regras (RF011, RNF006). Retorna a lista de mensagens
 * de erro (vazia quando o catálogo é válido). O validador nunca lança exceção por causa do
 * conteúdo: qualquer forma inesperada vira uma mensagem com o caminho do campo.
 * @req RF011 RNF006
 */
import { problemaDoPadrao } from './cid.js';
import {
  Abrangencia,
  CaraterDaExigencia,
  ModoDeSatisfacao,
  StatusDaRegra,
  TipoDeExigencia,
} from './enums.js';

const textoNaoVazio = (v) => typeof v === 'string' && v.trim() !== '';
const inteiroPositivo = (v) => Number.isInteger(v) && v > 0;
const pertenceA = (enumeracao) => (v) => Object.values(enumeracao).includes(v);
const ehObjeto = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
/** Data AAAA-MM-DD que existe no calendário (2026-02-30 e 2026-13-01 não existem). */
function dataValida(v) {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const data = new Date(`${v}T00:00:00Z`);
  return !Number.isNaN(data.getTime()) && data.toISOString().slice(0, 10) === v;
}

/** Cada verificação é [campo, predicado, mensagem]; o laço único mantém a complexidade baixa. */
const CAMPOS_DA_EXIGENCIA = [
  ['descricao', textoNaoVazio, 'texto obrigatório'],
  ['tipo', pertenceA(TipoDeExigencia), 'valor inválido'],
  ['carater', pertenceA(CaraterDaExigencia), 'valor inválido'],
  ['trechoDoProtocolo', textoNaoVazio, 'texto obrigatório'],
];
const CAMPOS_DA_REGRA = [
  ['indicacao', textoNaoVazio, 'texto obrigatório'],
  ['abrangencia', pertenceA(Abrangencia), 'valor inválido'],
  ['paginaNoProtocolo', inteiroPositivo, 'inteiro positivo obrigatório (RNF006)'],
];
const CAMPOS_DO_PROTOCOLO = [
  ['nome', textoNaoVazio, 'texto obrigatório'],
  ['edicao', textoNaoVazio, 'texto obrigatório'],
  ['orgaoEmissor', textoNaoVazio, 'texto obrigatório'],
  ['ano', inteiroPositivo, 'inteiro positivo obrigatório'],
];

/** Chaves aceitas em cada nível. Chave desconhecida é erro: ignorá-la em silêncio esconde erro de digitação (M-03). */
const CHAVES = {
  raiz: [
    'versao',
    'transcricao',
    'protocolo',
    'especialidades',
    'cidsGenericos',
    'fundamentoCidGenerico',
    'regras',
  ],
  protocolo: ['nome', 'edicao', 'ano', 'orgaoEmissor'],
  fundamento: ['trechoDoProtocolo', 'paginaNoProtocolo', 'listaCompleta'],
  regra: [
    'codigo',
    'indicacao',
    'abrangencia',
    'especialidade',
    'cidsAbrangidos',
    'excecoes',
    'paginaNoProtocolo',
    'observacao',
    'status',
    'validadaEm',
    'validadaPor',
    'grupos',
  ],
  grupo: ['modo', 'exigencias'],
  exigencia: ['idExigencia', 'descricao', 'tipo', 'carater', 'trechoDoProtocolo'],
};
/** Campos que só fazem sentido numa regra de especialidade; numa regra GERAL seriam ignorados. */
const CAMPOS_DE_ESPECIALIDADE = ['especialidade', 'cidsAbrangidos', 'excecoes'];

const simplificar = (texto) => String(texto).normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

/** Distância de edição (Levenshtein) entre duas cadeias curtas. */
function distancia(a, b) {
  let linha = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i += 1) {
    const nova = [i];
    for (let j = 1; j <= b.length; j += 1) {
      const troca = a[i - 1] === b[j - 1] ? 0 : 1;
      nova.push(Math.min(linha[j] + 1, nova[j - 1] + 1, linha[j - 1] + troca));
    }
    linha = nova;
  }
  return linha[b.length];
}

/** Sugestão de grafia para um valor digitado errado (maiúsculas, acentos ou até 2 letras trocadas). */
function sugerir(valor, opcoes) {
  const alvo = simplificar(valor);
  const [melhor] = opcoes
    .map((opcao) => [opcao, distancia(alvo, simplificar(opcao))])
    .sort((x, y) => x[1] - y[1]);
  return melhor && melhor[1] <= 2 ? ` (você quis dizer "${melhor[0]}"?)` : '';
}

function validarChaves(objeto, nivel, caminho, erros) {
  if (!ehObjeto(objeto)) return;
  for (const chave of Object.keys(objeto)) {
    if (!CHAVES[nivel].includes(chave)) {
      erros.push(`${caminho}.${chave}: chave desconhecida${sugerir(chave, CHAVES[nivel])}`);
    }
  }
}

function validarCampos(objeto, campos, caminho, erros) {
  for (const [campo, valido, mensagem] of campos) {
    if (!valido(objeto?.[campo])) erros.push(`${caminho}.${campo}: ${mensagem}`);
  }
}

function validarIdentificador(valor, caminho, vistos, erros) {
  if (!textoNaoVazio(valor)) erros.push(`${caminho}: texto obrigatório`);
  else if (vistos.has(valor)) erros.push(`${caminho}: duplicado "${valor}"`);
  else vistos.add(valor);
}

/** Lista de padrões de CID. Ausente só é aceito quando a lista é opcional; vazia só quando não é obrigatória. */
function validarPadroes(lista, caminho, obrigatoria, erros) {
  if (lista === undefined && !obrigatoria) return;
  if (!Array.isArray(lista) || (obrigatoria && lista.length === 0)) {
    erros.push(
      `${caminho}: ${obrigatoria ? 'lista não vazia obrigatória' : 'deve ser uma lista de padrões de CID'}`,
    );
    return;
  }
  lista.forEach((p, i) => {
    const problema = problemaDoPadrao(p);
    if (problema) erros.push(`${caminho}[${i}]: ${problema}`);
  });
}

function validarFundamentoGenerico(raiz, erros) {
  validarPadroes(raiz.cidsGenericos, '$.cidsGenericos', true, erros);
  const f = raiz.fundamentoCidGenerico;
  validarChaves(f, 'fundamento', '$.fundamentoCidGenerico', erros);
  if (!textoNaoVazio(f?.trechoDoProtocolo)) {
    erros.push('$.fundamentoCidGenerico.trechoDoProtocolo: texto obrigatório');
  }
  if (!inteiroPositivo(f?.paginaNoProtocolo)) {
    erros.push('$.fundamentoCidGenerico.paginaNoProtocolo: inteiro positivo obrigatório');
  }
  if (f?.listaCompleta !== undefined && typeof f.listaCompleta !== 'boolean') {
    erros.push('$.fundamentoCidGenerico.listaCompleta: deve ser verdadeiro ou falso');
  }
}

/** Especialidades declaradas; devolve o conjunto, ou null se a declaração em si é inválida. */
function validarEspecialidades(raiz, erros) {
  const lista = raiz.especialidades;
  if (!Array.isArray(lista) || lista.length === 0) {
    erros.push('$.especialidades: lista não vazia obrigatória');
    return null;
  }
  const nomes = new Set();
  lista.forEach((nome, i) => validarIdentificador(nome, `$.especialidades[${i}]`, nomes, erros));
  return nomes;
}

function validarEspecialidadesSemRegra(raiz, regras, erros) {
  const usadas = new Set(
    regras.filter((r) => r?.abrangencia === Abrangencia.ESPECIALIDADE).map((r) => r.especialidade),
  );
  raiz.especialidades.forEach((nome, i) => {
    if (textoNaoVazio(nome) && !usadas.has(nome)) {
      erros.push(`$.especialidades[${i}]: "${nome}" não tem nenhuma regra`);
    }
  });
}

function validarGrupo(g, caminho, ids, erros) {
  validarChaves(g, 'grupo', caminho, erros);
  if (!pertenceA(ModoDeSatisfacao)(g?.modo)) erros.push(`${caminho}.modo: valor inválido`);
  if (!Array.isArray(g?.exigencias) || g.exigencias.length === 0) {
    erros.push(`${caminho}.exigencias: lista não vazia obrigatória`);
    return;
  }
  g.exigencias.forEach((e, i) => {
    const local = `${caminho}.exigencias[${i}]`;
    validarChaves(e, 'exigencia', local, erros);
    validarIdentificador(e?.idExigencia, `${local}.idExigencia`, ids, erros);
    validarCampos(e, CAMPOS_DA_EXIGENCIA, local, erros);
  });
  if (new Set(g.exigencias.map((e) => e?.carater)).size > 1) {
    erros.push(`${caminho}: exigências de um mesmo grupo devem ter o mesmo caráter`);
  }
}

function validarEspecialidadeDaRegra(r, caminho, especialidades, erros) {
  if (!textoNaoVazio(r.especialidade)) {
    erros.push(`${caminho}.especialidade: texto obrigatório`);
  } else if (especialidades && !especialidades.has(r.especialidade)) {
    const sugestao = sugerir(r.especialidade, [...especialidades]);
    erros.push(
      `${caminho}.especialidade: "${r.especialidade}" não está em $.especialidades${sugestao}`,
    );
  }
}

function validarCobertura(r, caminho, especialidades, erros) {
  if (r?.abrangencia === Abrangencia.GERAL) {
    for (const campo of CAMPOS_DE_ESPECIALIDADE) {
      if (r[campo] !== undefined) {
        erros.push(`${caminho}.${campo}: não se aplica a uma regra GERAL (vale para qualquer CID)`);
      }
    }
    return;
  }
  const daEspecialidade = r?.abrangencia === Abrangencia.ESPECIALIDADE;
  if (daEspecialidade) validarEspecialidadeDaRegra(r, caminho, especialidades, erros);
  validarPadroes(r?.cidsAbrangidos, `${caminho}.cidsAbrangidos`, daEspecialidade, erros);
  validarPadroes(r?.excecoes, `${caminho}.excecoes`, false, erros);
}

function validarGrupos(r, caminho, ids, erros) {
  if (!Array.isArray(r?.grupos)) {
    erros.push(`${caminho}.grupos: lista obrigatória`);
    return;
  }
  if (r.grupos.length === 0 && !textoNaoVazio(r.observacao)) {
    erros.push(`${caminho}.observacao: obrigatória quando a regra não tem grupos de exigências`);
  }
  r.grupos.forEach((g, i) => validarGrupo(g, `${caminho}.grupos[${i}]`, ids, erros));
}

/** VALIDADA exige quando e por quem; nos demais casos esses campos não fazem sentido. */
function validarValidacao(r, caminho, erros) {
  if (r.status !== StatusDaRegra.VALIDADA) {
    for (const campo of ['validadaEm', 'validadaPor']) {
      if (r[campo] !== undefined) erros.push(`${caminho}.${campo}: só se aplica a regra VALIDADA`);
    }
    return;
  }
  if (!dataValida(r.validadaEm)) {
    erros.push(`${caminho}.validadaEm: data AAAA-MM-DD obrigatória quando a regra é VALIDADA`);
  }
  if (!textoNaoVazio(r.validadaPor)) {
    erros.push(`${caminho}.validadaPor: texto obrigatório quando a regra é VALIDADA`);
  }
}

/**
 * Estado da interpretação (A-01). Sem `status`, a regra é transcrição direta do protocolo.
 * PROVISORIA exige `observacao` (o que falta confirmar); VALIDADA exige quando e por quem.
 */
function validarStatus(r, caminho, erros) {
  if (!ehObjeto(r)) return;
  if (r.status !== undefined && !pertenceA(StatusDaRegra)(r.status)) {
    erros.push(`${caminho}.status: valor inválido`);
  }
  if (r.status === StatusDaRegra.PROVISORIA && !textoNaoVazio(r.observacao)) {
    erros.push(
      `${caminho}.observacao: obrigatória quando a regra é PROVISORIA (diga o que falta confirmar)`,
    );
  }
  validarValidacao(r, caminho, erros);
}

function validarRegra(r, caminho, contexto, erros) {
  validarChaves(r, 'regra', caminho, erros);
  validarIdentificador(r?.codigo, `${caminho}.codigo`, contexto.codigos, erros);
  validarCampos(r, CAMPOS_DA_REGRA, caminho, erros);
  validarStatus(r, caminho, erros);
  validarCobertura(r, caminho, contexto.especialidades, erros);
  validarGrupos(r, caminho, contexto.ids, erros);
}

export function validarEsquema(conteudo) {
  if (!ehObjeto(conteudo)) return ['$: o catálogo deve ser um objeto JSON'];
  const erros = [];
  validarChaves(conteudo, 'raiz', '$', erros);
  if (!/^\d+\.\d+\.\d+$/.test(String(conteudo.versao ?? ''))) {
    erros.push('$.versao: use o formato x.y.z');
  }
  validarChaves(conteudo.protocolo, 'protocolo', '$.protocolo', erros);
  validarCampos(conteudo.protocolo, CAMPOS_DO_PROTOCOLO, '$.protocolo', erros);
  validarFundamentoGenerico(conteudo, erros);
  const especialidades = validarEspecialidades(conteudo, erros);
  if (!Array.isArray(conteudo.regras) || conteudo.regras.length === 0) {
    erros.push('$.regras: lista não vazia obrigatória');
    return erros;
  }
  const contexto = { codigos: new Set(), ids: new Set(), especialidades };
  conteudo.regras.forEach((r, i) => validarRegra(r, `$.regras[${i}]`, contexto, erros));
  if (especialidades) validarEspecialidadesSemRegra(conteudo, conteudo.regras, erros);
  return erros;
}
