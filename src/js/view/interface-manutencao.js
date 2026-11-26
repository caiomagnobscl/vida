/**
 * Interface de manutenção do catálogo em texto (UC-05): valida um arquivo de regras e relata o
 * resultado linha a linha. A manutenção pelo navegador fica na área de gestão (views/gestao/,
 * ADR-10), que usa o mesmo esquema.
 * @req RF011 RNF003 RNF006
 */
import { CatalogoInvalidoError } from '../models/erros.js';

export class InterfaceManutencao {
  constructor(carregador, saida = () => {}) {
    this.carregador = carregador;
    this.saida = saida;
  }

  async validarCatalogo(caminho) {
    try {
      const catalogo = await this.carregador.carregar(caminho);
      const regras = catalogo.regras.length;
      const exigencias = catalogo.regras.reduce((n, r) => n + r.exigencias().length, 0);
      this.saida(
        `Catálogo válido: versão ${catalogo.versao}, ${regras} regras, ${exigencias} exigências.`,
      );
      return { ok: true, erros: [], regras, exigencias };
    } catch (erro) {
      if (!(erro instanceof CatalogoInvalidoError)) throw erro;
      this.saida(`Catálogo inválido (${erro.erros.length} erro(s)):`);
      erro.erros.forEach((e) => this.saida(`  - ${e}`));
      return { ok: false, erros: erro.erros, regras: 0, exigencias: 0 };
    }
  }
}
