/**
 * Carregador do catálogo: lê, valida o esquema e instancia o CatalogoDeRegras (RF011, ADR-01).
 * O leitor é injetado (fetch no navegador, fs em Node), mantendo o módulo livre de E/S própria.
 * @req RF011 RNF003 RNF006
 */
import { CatalogoDeRegras } from '../models/catalogo.js';
import { validarEsquema } from '../models/esquema-catalogo.js';
import { CatalogoInvalidoError } from '../models/erros.js';

export class CarregadorCatalogo {
  constructor(leitor) {
    this.leitor = leitor;
  }

  validarEsquema(conteudo) {
    return validarEsquema(conteudo);
  }

  async carregar(caminho) {
    const texto = await this.leitor(caminho);
    let conteudo;
    try {
      conteudo = JSON.parse(texto);
    } catch (erro) {
      throw new CatalogoInvalidoError([`$: JSON inválido (${erro.message})`]);
    }
    const erros = this.validarEsquema(conteudo);
    if (erros.length > 0) throw new CatalogoInvalidoError(erros);
    return CatalogoDeRegras.deObjeto(conteudo);
  }
}
