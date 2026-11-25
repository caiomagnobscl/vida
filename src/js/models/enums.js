/**
 * Enumerações do domínio do VIDA (nomes idênticos aos do modelo de classes do P2).
 * @req RF004 RF005 RN06
 */
const enumeracao = (...nomes) => Object.freeze(Object.fromEntries(nomes.map((n) => [n, n])));

export const ModoDeSatisfacao = enumeracao('TODOS', 'AO_MENOS_UM');
export const CaraterDaExigencia = enumeracao('OBRIGATORIA', 'SE_DISPONIVEL');
export const TipoDeExigencia = enumeracao('CAMPO_CLINICO', 'EXAME', 'DOCUMENTO');
export const Abrangencia = enumeracao('GERAL', 'ESPECIALIDADE');
export const SituacaoDoCID = enumeracao('VALIDO', 'FORMATO_INVALIDO', 'GENERICO', 'SEM_REGRA');
/** Estado da interpretação de uma regra; regra sem `status` é transcrição direta do protocolo. */
export const StatusDaRegra = enumeracao('PROVISORIA', 'VALIDADA');
export const TipoDeAchado = enumeracao(
  'CID_GENERICO',
  'CID_SEM_REGRA',
  'REGRA_PROVISORIA',
  'REGRA_SEM_EXIGENCIA',
  'EXIGENCIA_NAO_ATENDIDA',
  'RECOMENDACAO_NAO_ATENDIDA',
);
export const SituacaoDoRelatorio = enumeracao('SEM_PENDENCIAS', 'COM_PENDENCIAS');
