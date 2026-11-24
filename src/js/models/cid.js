/**
 * Utilitários de CID-10: formato e correspondência com os padrões do catálogo.
 * Padrões aceitos: 'R07.1' (código exato), 'I20' (categoria e suas subcategorias)
 * e 'Q20-Q26' (faixa de categorias da mesma letra).
 * @req RF008 RN02
 */
const FORMATO = /^[A-Z]\d{2}(\.\d{1,2})?$/;

export const PADRAO_DE_CATALOGO = /^([A-Z]\d{2}(\.\d{1,2})?|[A-Z]\d{2}-[A-Z]\d{2})$/;

/**
 * Por que um padrão do catálogo é inaceitável, ou null se está correto. Além do formato, a faixa
 * precisa ser cumprível pelo motor: mesma letra nas pontas e início menor ou igual ao fim —
 * senão `casaComPadrao` e `expandirPadrao` cobririam menos CIDs do que o catálogo diz (M-02).
 */
export function problemaDoPadrao(padrao) {
  const texto = String(padrao);
  if (!PADRAO_DE_CATALOGO.test(texto)) return `padrão de CID inválido "${texto}"`;
  if (!texto.includes('-')) return null;
  const [inicio, fim] = texto.split('-');
  if (inicio.charAt(0) !== fim.charAt(0)) {
    return `faixa de CID inválida "${texto}": início e fim devem ter a mesma letra (faixa entre letras não é suportada)`;
  }
  if (inicio > fim) {
    return `faixa de CID inválida "${texto}": o início deve ser menor ou igual ao fim`;
  }
  return null;
}

export function normalizarCID(codigo) {
  return String(codigo ?? '')
    .trim()
    .toUpperCase();
}

export function formatoValido(codigo) {
  return FORMATO.test(normalizarCID(codigo));
}

const categoriaDe = (cid) => cid.slice(0, 3);

function dentroDaFaixa(cid, inicio, fim) {
  const categoria = categoriaDe(cid);
  return categoria.charAt(0) === inicio.charAt(0) && categoria >= inicio && categoria <= fim;
}

export function casaComPadrao(cid, padrao) {
  const codigo = normalizarCID(cid);
  const alvo = normalizarCID(padrao);
  if (!formatoValido(codigo)) return false;
  if (alvo.includes('-')) {
    const [inicio, fim] = alvo.split('-');
    return dentroDaFaixa(codigo, inicio, fim);
  }
  if (alvo.includes('.')) return codigo === alvo;
  return categoriaDe(codigo) === alvo;
}

export function casaComAlgum(cid, padroes = [], excecoes = []) {
  if (excecoes.some((e) => casaComPadrao(cid, e))) return false;
  return padroes.some((p) => casaComPadrao(cid, p));
}

/** Expande uma faixa ('Q20-Q26' → Q20…Q26); qualquer outro padrão volta como veio. */
export function expandirPadrao(padrao) {
  const alvo = normalizarCID(padrao);
  if (!alvo.includes('-')) return [alvo];
  const [inicio, fim] = alvo.split('-');
  const [de, ate] = [Number(inicio.slice(1)), Number(fim.slice(1))];
  return Array.from(
    { length: ate - de + 1 },
    (_, i) => `${inicio.charAt(0)}${String(de + i).padStart(2, '0')}`,
  );
}
