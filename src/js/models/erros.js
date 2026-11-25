/**
 * Erros do domínio. O catálogo inválido carrega a lista de mensagens de validação (RF011).
 * @req RF011
 */
export class CatalogoInvalidoError extends Error {
  constructor(erros) {
    super(`Catálogo inválido (${erros.length} erro(s)): ${erros[0]}`);
    this.name = 'CatalogoInvalidoError';
    this.erros = erros;
  }
}
