/**
 * Controlador do fluxo de verificação (UC-01 a UC-04). Coordena catálogo, motor e exportação
 * e mantém o encaminhamento em preparação. Qualquer alteração invalida o relatório (ST-01).
 * Avisa os observadores a cada relatório gerado (ex.: o registro anônimo da estatística, ADR-10).
 * @req RF001 RF002 RF003 RF004 RF005 RF007 RF008 RF009 RF010
 */
import { Encaminhamento } from '../models/encaminhamento.js';
import { Especialidade } from '../models/catalogo.js';
import { RelatorioDeCompletude } from '../models/relatorio.js';
import { Abrangencia, SituacaoDoCID, SituacaoDoRelatorio } from '../models/enums.js';
import { formatoValido, normalizarCID } from '../models/cid.js';

/** Telas do fluxo, da primeira à última; a navegação pelo histórico do navegador usa estes nomes. */
export const Etapa = Object.freeze({
  SELECAO: 'selecao',
  CHECKLIST: 'checklist',
  RELATORIO: 'relatorio',
});

const ESTADOS_DE_PREPARACAO = {
  [SituacaoDoCID.VALIDO]: 'EmPreparacao.CIDValido',
  [SituacaoDoCID.GENERICO]: 'EmPreparacao.CIDGenerico',
  [SituacaoDoCID.SEM_REGRA]: 'EmPreparacao.CIDSemRegra',
};

export class ControladorVerificacao {
  constructor(catalogo, motor, servicoExportacao) {
    this.catalogo = catalogo;
    this.motor = motor;
    this.servicoExportacao = servicoExportacao;
    this.encaminhamento = null;
    this.relatorio = null;
    this.observadores = [];
  }

  /**
   * Padrão Observer (ADR-10): quem assina é avisado de cada relatório gerado, sem que o controlador
   * ou o motor saibam o que ele faz (MOD-08). O observador implementa relatorioGerado(evento).
   */
  assinar(observador) {
    this.observadores.push(observador);
    return () => {
      this.observadores = this.observadores.filter((o) => o !== observador);
    };
  }

  iniciar(especialidade) {
    if (!this.catalogo.especialidades().includes(especialidade)) {
      throw new Error(`Especialidade fora do catálogo piloto: ${especialidade}`);
    }
    this.encaminhamento = new Encaminhamento(new Especialidade(especialidade));
    this.relatorio = null;
  }

  /** Descarta o encaminhamento e o relatório: o próximo atendimento parte do zero. */
  reiniciar() {
    this.encaminhamento = null;
    this.relatorio = null;
  }

  /**
   * Tela mais adiantada que o estado atual sustenta: a seleção sempre; o checklist com um CID de
   * formato válido; o relatório depois de verificar. Impede que o botão Voltar/Avançar do
   * navegador mostre uma tela cujo estado não existe mais (M-11).
   */
  etapaMaxima() {
    if (this.relatorio) return Etapa.RELATORIO;
    const enc = this.encaminhamento;
    const temCID = enc?.cid && enc.situacaoDoCID !== SituacaoDoCID.FORMATO_INVALIDO;
    return temCID ? Etapa.CHECKLIST : Etapa.SELECAO;
  }

  /** Indicações/CIDs do catálogo para a especialidade escolhida (caixa de seleção da T1). */
  listarOpcoesDeCID() {
    return this.catalogo.opcoesDeCID(this.#exigirEncaminhamento().especialidade.nome);
  }

  validarFormatoCID(codigo) {
    return formatoValido(codigo);
  }

  informarCID(codigo) {
    const enc = this.#exigirEncaminhamento();
    this.relatorio = null;
    if (!this.validarFormatoCID(codigo)) {
      enc.cid = null;
      enc.situacaoDoCID = SituacaoDoCID.FORMATO_INVALIDO;
      return enc.situacaoDoCID;
    }
    enc.cid = normalizarCID(codigo);
    if (this.catalogo.ehGenerico(enc.cid)) enc.situacaoDoCID = SituacaoDoCID.GENERICO;
    else if (this.catalogo.buscarRegras(enc.especialidade.nome, enc.cid).length === 0) {
      enc.situacaoDoCID = SituacaoDoCID.SEM_REGRA;
    } else enc.situacaoDoCID = SituacaoDoCID.VALIDO;
    return enc.situacaoDoCID;
  }

  obterChecklist() {
    const enc = this.#exigirCID();
    enc.definirItens(this.#regrasDe(enc).flatMap((r) => r.exigencias()));
    return enc.itens;
  }

  /** Regras gerais e da indicação que valem para o CID atual, na ordem do checklist. */
  regrasAplicaveis() {
    return this.#regrasDe(this.#exigirCID());
  }

  /** Só as regras da especialidade que casam com o CID atual (a T1 e a T2 avisam sobre elas). */
  regrasEspecificas() {
    return this.regrasAplicaveis().filter((r) => r.abrangencia === Abrangencia.ESPECIALIDADE);
  }

  registrarAtendimento(idItem, atendido) {
    this.#exigirEncaminhamento().registrarAtendimento(idItem, atendido);
    this.relatorio = null;
  }

  verificar() {
    const enc = this.#exigirCID();
    if (enc.itens.length === 0) throw new Error('Gere o checklist antes de verificar.');
    const regras = this.#regrasDe(enc);
    const achados = this.motor.avaliar(enc, regras);
    const { protocolo, versao } = this.catalogo;
    const contexto = {
      especialidade: enc.especialidade.nome,
      cid: enc.cid,
      versaoCatalogo: versao,
      protocolo: `Protocolo ${protocolo.orgaoEmissor}, ${protocolo.edicao} (${protocolo.ano})`,
      limites: this.catalogo.limitesDaVerificacao(),
    };
    const relatorio = new RelatorioDeCompletude(achados, enc.itens, contexto);
    relatorio.calcularSituacao();
    this.relatorio = relatorio;
    this.#notificar({ encaminhamento: enc, relatorio, regras });
    return relatorio;
  }

  /** Um observador com defeito não impede o profissional de ver o relatório. */
  #notificar(evento) {
    for (const observador of this.observadores) {
      try {
        observador.relatorioGerado(evento);
      } catch {
        // o relatório já foi gerado; a falha do observador é problema só dele
      }
    }
  }

  obterFundamentacao(idExigencia) {
    return this.catalogo.fundamentar(idExigencia);
  }

  exportar() {
    if (!this.relatorio) throw new Error('Não há relatório válido: execute a verificação.');
    return this.servicoExportacao.gerarTexto(this.relatorio);
  }

  /** Estado observável (máquina de estados ST-01 do P2). */
  estado() {
    const enc = this.encaminhamento;
    if (!enc) return 'Inicial';
    if (this.relatorio) {
      return this.relatorio.situacao === SituacaoDoRelatorio.SEM_PENDENCIAS
        ? 'Verificado.SemPendencias'
        : 'Verificado.ComPendencias';
    }
    return ESTADOS_DE_PREPARACAO[enc.situacaoDoCID] ?? 'EmPreparacao.AguardandoCID';
  }

  #regrasDe(enc) {
    return [
      ...this.catalogo.regrasGerais(),
      ...this.catalogo.buscarRegras(enc.especialidade.nome, enc.cid),
    ];
  }

  #exigirEncaminhamento() {
    if (!this.encaminhamento) throw new Error('Selecione a especialidade primeiro.');
    return this.encaminhamento;
  }

  #exigirCID() {
    const enc = this.#exigirEncaminhamento();
    if (!enc.cid || enc.situacaoDoCID === SituacaoDoCID.FORMATO_INVALIDO) {
      throw new Error('Informe um CID com formato válido.');
    }
    return enc;
  }
}
