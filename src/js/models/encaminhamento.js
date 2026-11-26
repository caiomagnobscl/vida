/**
 * Encaminhamento em preparação e seus itens de checklist. Não contém dados de paciente (RNF004).
 * @req RF001 RF002 RF009
 */
export class ItemDoChecklist {
  constructor(exigencia) {
    this.idItem = `ITEM-${exigencia.idExigencia}`;
    this.exigencia = exigencia;
    this.atendido = false;
  }
}

export class Encaminhamento {
  constructor(especialidade) {
    this.especialidade = especialidade;
    this.cid = null;
    this.situacaoDoCID = null;
    this.itens = [];
  }

  definirItens(exigencias) {
    const anteriores = new Map(this.itens.map((i) => [i.exigencia.idExigencia, i.atendido]));
    const vistos = new Set();
    this.itens = [];
    for (const exigencia of exigencias) {
      if (vistos.has(exigencia.idExigencia)) continue;
      vistos.add(exigencia.idExigencia);
      const item = new ItemDoChecklist(exigencia);
      item.atendido = anteriores.get(exigencia.idExigencia) ?? false;
      this.itens.push(item);
    }
  }

  registrarAtendimento(idItem, atendido) {
    const item = this.itens.find((i) => i.idItem === idItem);
    if (!item) throw new Error(`Item inexistente no checklist: ${idItem}`);
    item.atendido = Boolean(atendido);
  }

  atendeu(idExigencia) {
    return this.itens.some((i) => i.exigencia.idExigencia === idExigencia && i.atendido);
  }
}
