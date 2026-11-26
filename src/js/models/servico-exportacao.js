/**
 * Exportação do relatório em texto simples (RF007). Sem rede e sem persistência (ADR-02).
 * @req RF007 RN07
 */
export const AVISO_DE_ALCANCE =
  'O VIDA verifica a completude declarada pelo profissional. Não é autorização, aprovação nem priorização pela regulação (RN07).';

/** O VIDA atende a regulação de Sergipe: a hora do relatório é a de Brasília, não a de Greenwich. */
export const FUSO_PADRAO = 'America/Sao_Paulo';

const secao = (titulo, linhas) => (linhas.length ? ['', titulo, ...linhas] : []);

export class ServicoExportacao {
  /** `fusoHorario` é injetável para que os testes não dependam do relógio nem do fuso da máquina. */
  constructor({ fusoHorario = FUSO_PADRAO } = {}) {
    this.fusoHorario = fusoHorario;
    // Criado aqui para que um fuso inválido falhe na montagem da aplicação, não ao exportar.
    this.formatador = new Intl.DateTimeFormat('pt-BR', {
      timeZone: fusoHorario,
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
      timeZoneName: 'longOffset',
    });
  }

  /** "14/11/2026 21:00 (GMT-03:00)": montada por partes, para não variar com a versão do ICU (B-11). */
  #formatarDataHora(data) {
    const p = Object.fromEntries(this.formatador.formatToParts(data).map((x) => [x.type, x.value]));
    return `${p.day}/${p.month}/${p.year} ${p.hour}:${p.minute} (${p.timeZoneName})`;
  }

  gerarTexto(rel, { incluirData = true } = {}) {
    const ctx = rel.contexto ?? {};
    const pendencias = rel.pendencias();
    const linhas = [
      'VIDA — Relatório de completude',
      `Especialidade: ${ctx.especialidade ?? '—'} · CID: ${ctx.cid ?? '—'}`,
      `Catálogo piloto v${ctx.versaoCatalogo ?? '—'} · ${ctx.protocolo ?? '—'}`,
      `Situação: ${rel.rotuloDaSituacao().toUpperCase()}`,
      ...secao(
        'PENDÊNCIAS',
        pendencias.map((a, i) => `${i + 1}. ${a.mensagem}`),
      ),
      ...secao(
        'RECOMENDAÇÕES',
        rel.recomendacoes().map((a) => `- ${a.mensagem}`),
      ),
      ...secao(
        'AVISOS',
        rel.avisos().map((a) => `- ${a.mensagem}`),
      ),
      ...secao(
        `ITENS ATENDIDOS (${rel.itensAtendidos().length} de ${rel.itens.length})`,
        rel.itensAtendidos().map((i) => `- ${i.exigencia.descricao}`),
      ),
      '',
      `Aviso de alcance: ${AVISO_DE_ALCANCE}`,
      ...(ctx.limites ?? []),
    ];
    if (incluirData) linhas.push(`Gerado em: ${this.#formatarDataHora(rel.geradoEm)}`);
    return linhas.join('\n');
  }
}
