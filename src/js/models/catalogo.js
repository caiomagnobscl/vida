/**
 * Entidades do catálogo de regras (ADR-01: regras como dados) — Protocolo, Especialidade,
 * Exigencia, GrupoDeExigencias, RegraDoProtocolo e CatalogoDeRegras.
 * @req RF001 RF002 RF003 RF004 RF008 RF010 RN01 RN02 RN03 RN04 RN06
 */
import { Abrangencia, CaraterDaExigencia, StatusDaRegra } from './enums.js';
import { casaComAlgum, casaComPadrao, expandirPadrao } from './cid.js';

export class Protocolo {
  constructor({ nome, edicao, ano, orgaoEmissor }) {
    Object.assign(this, { nome, edicao, ano, orgaoEmissor });
  }
}

export class Especialidade {
  constructor(nome) {
    this.nome = nome;
  }
}

export class Exigencia {
  constructor({ idExigencia, descricao, tipo, carater, trechoDoProtocolo }) {
    Object.assign(this, { idExigencia, descricao, tipo, carater, trechoDoProtocolo });
  }
}

export class GrupoDeExigencias {
  constructor({ modo, exigencias }) {
    this.modo = modo;
    this.exigencias = exigencias.map((e) => (e instanceof Exigencia ? e : new Exigencia(e)));
  }
}

/** Campos que registram se a interpretação da regra foi confirmada (A-01); todos nulos se não houver. */
const estadoDaInterpretacao = ({ status = null, validadaEm = null, validadaPor = null }) => ({
  status,
  validadaEm,
  validadaPor,
});

export class RegraDoProtocolo {
  constructor(dados) {
    const { codigo, indicacao, abrangencia, cidsAbrangidos = [], excecoes = [] } = dados;
    Object.assign(this, { codigo, indicacao, abrangencia, cidsAbrangidos, excecoes });
    this.paginaNoProtocolo = dados.paginaNoProtocolo;
    this.observacao = dados.observacao ?? null;
    Object.assign(this, estadoDaInterpretacao(dados));
    this.especialidade = dados.especialidade ? new Especialidade(dados.especialidade) : null;
    this.grupos = (dados.grupos ?? []).map((g) => new GrupoDeExigencias(g));
    for (const grupo of this.grupos) {
      for (const exigencia of grupo.exigencias) {
        // navegação inversa (não enumerável): usada pela interface para agrupar itens por regra
        Object.defineProperty(exigencia, 'regra', { value: this, enumerable: false });
        Object.defineProperty(exigencia, 'grupo', { value: grupo, enumerable: false });
      }
    }
  }

  aplicaA(cid) {
    if (this.abrangencia === Abrangencia.GERAL) return true;
    return casaComAlgum(cid, this.cidsAbrangidos, this.excecoes);
  }

  exigencias() {
    return this.grupos.flatMap((g) => g.exigencias);
  }

  /** Interpretação ainda não confirmada com a regulação (hipótese da equipe). */
  ehProvisoria() {
    return this.status === StatusDaRegra.PROVISORIA;
  }

  /** Regra de especialidade que o protocolo não acompanha de exigência própria (só valem as gerais). */
  semExigenciaEspecifica() {
    return this.abrangencia === Abrangencia.ESPECIALIDADE && this.grupos.length === 0;
  }

  /** Frase sobre a situação da interpretação, ou null quando a regra é transcrição direta. */
  notaDeStatus() {
    if (this.ehProvisoria())
      return 'interpretação provisória, ainda não confirmada com a regulação';
    if (this.status !== StatusDaRegra.VALIDADA) return null;
    const data = this.validadaEm.split('-').reverse().join('/');
    return `interpretação validada em ${data} por ${this.validadaPor}`;
  }
}

/** Texto de uma opção da lista de CIDs: categoria cobre subcategorias; exceções aparecem no rótulo. */
function rotuloDaOpcao(codigo, excecoes) {
  const excluidos = excecoes.filter((e) => casaComPadrao(e, codigo));
  const base = codigo.includes('.') ? codigo : `${codigo} e subcategorias`;
  return excluidos.length ? `${base} (exceto ${excluidos.join(', ')})` : base;
}

function opcoesDaRegra(regra) {
  return regra.cidsAbrangidos
    .flatMap(expandirPadrao)
    .map((codigo) => ({ codigo, rotulo: rotuloDaOpcao(codigo, regra.excecoes) }));
}

const ROTULO_DO_CARATER = {
  [CaraterDaExigencia.OBRIGATORIA]: 'Obrigatória',
  [CaraterDaExigencia.SE_DISPONIVEL]: 'Recomendada (se disponível)',
};

export class CatalogoDeRegras {
  constructor({ versao, protocolo, especialidades, cidsGenericos, fundamentoCidGenerico, regras }) {
    this.versao = versao;
    this.protocolo = new Protocolo(protocolo);
    this.nomesDeEspecialidades = [...especialidades];
    this.cidsGenericos = [...cidsGenericos];
    this.fundamentoCidGenerico = fundamentoCidGenerico;
    this.regras = regras.map((r) => new RegraDoProtocolo(r));
  }

  static deObjeto(objeto) {
    return new CatalogoDeRegras(objeto);
  }

  /** Especialidades declaradas no catálogo (em $.especialidades), na ordem em que aparecem na T1. */
  especialidades() {
    return [...this.nomesDeEspecialidades];
  }

  buscarRegras(esp, cid) {
    return this.regras.filter(
      (r) =>
        r.abrangencia === Abrangencia.ESPECIALIDADE &&
        r.especialidade?.nome === esp &&
        r.aplicaA(cid),
    );
  }

  /** Indicações e CIDs da especialidade, na ordem do catálogo — alimenta a caixa de seleção da T1. */
  opcoesDeCID(esp) {
    return this.regras
      .filter((r) => r.abrangencia === Abrangencia.ESPECIALIDADE && r.especialidade?.nome === esp)
      .map((r) => ({ codigoDaRegra: r.codigo, indicacao: r.indicacao, opcoes: opcoesDaRegra(r) }));
  }

  regrasGerais() {
    return this.regras.filter((r) => r.abrangencia === Abrangencia.GERAL);
  }

  ehGenerico(cid) {
    return casaComAlgum(cid, this.cidsGenericos);
  }

  /**
   * Limites conhecidos da verificação, para o relatório não parecer mais completo do que é. O
   * protocolo só dá exemplos de CID genérico ("etc."): enquanto a regulação não confirmar a lista
   * inteira (fundamentoCidGenerico.listaCompleta), a checagem da RN02 é parcial (M-10).
   */
  limitesDaVerificacao() {
    const { listaCompleta, paginaNoProtocolo } = this.fundamentoCidGenerico;
    if (listaCompleta === true) return [];
    const lista = this.cidsGenericos.join(', ');
    return [
      `Limite da verificação: a checagem de CID genérico (RN02) reconhece só os CIDs da lista do catálogo (${lista}). O protocolo (p. ${paginaNoProtocolo}) cita apenas exemplos, sem a lista completa; outro CID genérico pode passar sem alerta.`,
    ];
  }

  fundamentar(idExigencia) {
    if (idExigencia === 'CID_GENERICO') return this.#fundamentarCidGenerico();
    const exigencia = this.regras
      .flatMap((r) => r.exigencias())
      .find((e) => e.idExigencia === idExigencia);
    if (!exigencia) return `Sem fundamentação cadastrada para "${idExigencia}".`;
    const { regra } = exigencia;
    const abrangidos = regra.cidsAbrangidos.length
      ? regra.cidsAbrangidos.join(', ')
      : 'todas as indicações';
    const situacao = regra.notaDeStatus();
    return [
      `Exigência: ${exigencia.descricao}`,
      `Regra ${regra.codigo} — ${regra.indicacao}`,
      `CIDs abrangidos: ${abrangidos}`,
      `Caráter: ${ROTULO_DO_CARATER[exigencia.carater]}`,
      situacao ? `Situação da regra: ${situacao}.` : null,
      regra.observacao ? `Observação: ${regra.observacao}` : null,
      `Trecho do protocolo: “${exigencia.trechoDoProtocolo}”`,
      this.#fonte(regra.paginaNoProtocolo),
    ]
      .filter(Boolean)
      .join('\n');
  }

  #fundamentarCidGenerico() {
    const { trechoDoProtocolo, paginaNoProtocolo } = this.fundamentoCidGenerico;
    return [
      'CID genérico não aceito (RN02)',
      `CIDs citados como exemplo: ${this.cidsGenericos.join(', ')}`,
      `Trecho do protocolo: “${trechoDoProtocolo}”`,
      this.#fonte(paginaNoProtocolo),
    ].join('\n');
  }

  #fonte(pagina) {
    const { nome, edicao, ano } = this.protocolo;
    return `Fonte: ${nome}, ${edicao} (${ano}), p. ${pagina}.`;
  }
}
