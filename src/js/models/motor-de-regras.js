/**
 * Motor de regras: avalia um encaminhamento contra as regras aplicáveis (ADR-01, ADR-03).
 * Implementa o diagrama de atividades do P2 (AT-01): CID genérico, CID sem regra e laço por grupo.
 * @req RF003 RF004 RN02 RN03 RN04 RN06
 */
import { Abrangencia, CaraterDaExigencia, ModoDeSatisfacao, TipoDeAchado } from './enums.js';
import { Achado } from './relatorio.js';

const MSG_CID_GENERICO =
  'CID genérico não aceito (RN02): informe um CID específico compatível com o quadro clínico.';
const MSG_SEM_REGRA =
  'Sem regra específica no catálogo piloto para este CID: apenas as exigências gerais foram verificadas.';

const avisoDeRegraProvisoria = (regra) =>
  new Achado({
    tipo: TipoDeAchado.REGRA_PROVISORIA,
    bloqueante: false,
    mensagem:
      `Atenção: a regra ${regra.codigo} (${regra.indicacao}) usa interpretação provisória, ainda não confirmada com a regulação.` +
      (regra.observacao ? ` ${regra.observacao}` : ''),
    idExigencia: regra.exigencias()[0]?.idExigencia ?? null,
  });

const avisoDeRegraSemExigencia = (regra) =>
  new Achado({
    tipo: TipoDeAchado.REGRA_SEM_EXIGENCIA,
    bloqueante: false,
    mensagem: `A regra ${regra.codigo} (${regra.indicacao}) não tem exigência específica no protocolo: apenas as exigências gerais foram verificadas.`,
  });

export class MotorDeRegras {
  constructor(catalogo) {
    this.catalogo = catalogo;
  }

  avaliar(enc, regras) {
    const achados = [];
    // "Sem regra específica" só vale para CID não genérico (estado CIDSemRegra do P2). Para o
    // genérico a pendência já pede a troca do CID; um segundo aviso só sobrepõe mensagens (B-04).
    if (this.catalogo.ehGenerico(enc.cid)) {
      achados.push(
        new Achado({
          tipo: TipoDeAchado.CID_GENERICO,
          bloqueante: true,
          mensagem: MSG_CID_GENERICO,
          idExigencia: 'CID_GENERICO',
        }),
      );
    } else if (!regras.some((r) => r.abrangencia === Abrangencia.ESPECIALIDADE)) {
      achados.push(
        new Achado({
          tipo: TipoDeAchado.CID_SEM_REGRA,
          bloqueante: false,
          mensagem: MSG_SEM_REGRA,
        }),
      );
    }
    for (const regra of regras) {
      if (regra.ehProvisoria()) achados.push(avisoDeRegraProvisoria(regra));
      if (regra.semExigenciaEspecifica()) achados.push(avisoDeRegraSemExigencia(regra));
      for (const grupo of regra.grupos) achados.push(...this.avaliarGrupo(grupo, enc));
    }
    return achados;
  }

  avaliarGrupo(g, enc) {
    const naoAtendidas = g.exigencias.filter((e) => !enc.atendeu(e.idExigencia));
    if (g.modo === ModoDeSatisfacao.TODOS) {
      return naoAtendidas.map((e) => this.#achado([e], enc, e.descricao));
    }
    if (naoAtendidas.length < g.exigencias.length) return [];
    const lista = g.exigencias.map((e) => e.descricao).join('; ');
    return [this.#achado(g.exigencias, enc, `indique ao menos um dos itens — ${lista}`)];
  }

  #achado(exigencias, enc, texto) {
    const obrigatoria = exigencias[0].carater === CaraterDaExigencia.OBRIGATORIA;
    const idsDeItens = exigencias
      .map((e) => enc.itens.find((i) => i.exigencia.idExigencia === e.idExigencia)?.idItem)
      .filter(Boolean);
    return new Achado({
      tipo: obrigatoria
        ? TipoDeAchado.EXIGENCIA_NAO_ATENDIDA
        : TipoDeAchado.RECOMENDACAO_NAO_ATENDIDA,
      bloqueante: obrigatoria,
      mensagem: `${obrigatoria ? 'Pendente' : 'Recomendado (se disponível)'}: ${texto}.`,
      idExigencia: exigencias[0].idExigencia,
      idsDeItens,
    });
  }
}
