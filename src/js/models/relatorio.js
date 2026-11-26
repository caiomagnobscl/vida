/**
 * Relatório de completude e seus achados. O rótulo SEM_PENDENCIAS nunca equivale a aprovação (RN07).
 * @req RF005 RN07
 */
import { SituacaoDoRelatorio, TipoDeAchado } from './enums.js';

/** Achados informativos, que nunca bloqueiam: aparecem em "Avisos" na tela e no texto exportado. */
const TIPOS_DE_AVISO = new Set([
  TipoDeAchado.CID_SEM_REGRA,
  TipoDeAchado.REGRA_PROVISORIA,
  TipoDeAchado.REGRA_SEM_EXIGENCIA,
]);

export class Achado {
  constructor({ tipo, bloqueante, mensagem, idExigencia = null, idsDeItens = [] }) {
    Object.assign(this, { tipo, bloqueante, mensagem, idExigencia, idsDeItens });
  }
}

export class RelatorioDeCompletude {
  constructor(achados = [], itens = [], contexto = {}) {
    this.achados = [...achados];
    this.itens = [...itens];
    this.contexto = contexto;
    this.situacao = null;
    this.geradoEm = new Date();
  }

  calcularSituacao() {
    const haBloqueante = this.achados.some((a) => a.bloqueante);
    this.situacao = haBloqueante
      ? SituacaoDoRelatorio.COM_PENDENCIAS
      : SituacaoDoRelatorio.SEM_PENDENCIAS;
    return this.situacao;
  }

  /**
   * Rótulo da situação, único para a tela e para o texto exportado. Só os dois valores conhecidos
   * têm rótulo: uma situação não calculada é erro, nunca "Sem pendências" — o VIDA não afirma que
   * está completo sem ter certeza (B-05, RN07).
   */
  rotuloDaSituacao() {
    if (this.situacao === SituacaoDoRelatorio.COM_PENDENCIAS) {
      return `Com pendências (${this.pendencias().length})`;
    }
    if (this.situacao === SituacaoDoRelatorio.SEM_PENDENCIAS) return 'Sem pendências';
    throw new Error('Situação do relatório não calculada: chame calcularSituacao() antes.');
  }

  listarAchados() {
    return [...this.achados];
  }

  pendencias() {
    return this.achados.filter((a) => a.bloqueante);
  }

  recomendacoes() {
    return this.achados.filter((a) => a.tipo === TipoDeAchado.RECOMENDACAO_NAO_ATENDIDA);
  }

  avisos() {
    return this.achados.filter((a) => TIPOS_DE_AVISO.has(a.tipo));
  }

  itensAtendidos() {
    return this.itens.filter((i) => i.atendido);
  }
}
