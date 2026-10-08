// Detector de fala por energia (VAD). Recebe o volume (RMS 0..1) a cada quadro e diz
// quando a fala começa, quando há uma pausa curta (fecha um trecho) e quando a fala acabou.
// Puro (sem áudio) para dar para testar.

export type EventoVad = 'inicio' | 'trecho' | 'fim';

export interface OpcoesVad {
  /** silêncio que fecha um trecho (a transcrição dele já começa) */
  pausaTrechoMs: number;
  /** silêncio que encerra a sua vez de falar */
  silencioFimMs: number;
  /** fala mínima para valer (tosse/estalo não conta) */
  falaMinimaMs: number;
  /** quanto o volume precisa passar do ruído de fundo */
  margem: number;
  /** piso absoluto do limiar */
  limiarMinimo: number;
  /** primeiros ms só aprendem o ruído do ambiente */
  calibracaoMs: number;
  /** teto de uma fala (ruído que nunca acaba não prende o microfone) */
  falaMaximaMs: number;
}

export const VAD_PADRAO: OpcoesVad = { pausaTrechoMs: 350, silencioFimMs: 600, falaMinimaMs: 180, margem: 2.6, limiarMinimo: 0.02, calibracaoMs: 400, falaMaximaMs: 30000 };

export class DetectorFala {
  readonly o: OpcoesVad;
  private ruido = 0.01;
  private falando = false;
  private ativoDesde = -1; // início do som acima do limiar
  private ultimoSom = -1;
  private trechoAberto = false;
  private t0 = -1;
  private picoCalibracao = 0;
  /** pausas no meio da fala atual (silêncio de um trecho e você retomou) */
  pausas = 0;
  inicioFala = -1;
  fimFala = -1;
  /** multiplica o limiar (sobe enquanto o personagem fala, para o eco não disparar) */
  sensibilidade = 1;

  constructor(o: Partial<OpcoesVad> = {}) {
    this.o = { ...VAD_PADRAO, ...o };
  }

  get limiar(): number {
    return Math.max(this.o.limiarMinimo, this.ruido * this.o.margem) * this.sensibilidade;
  }

  get emFala(): boolean {
    return this.falando;
  }

  /** Um quadro de áudio: volume RMS e instante em ms. Devolve os eventos deste quadro. */
  quadro(rms: number, t: number): EventoVad[] {
    const ev: EventoVad[] = [];
    if (this.t0 < 0) this.t0 = t;
    if (t - this.t0 < this.o.calibracaoMs) {
      // calibração: o ruído é o volume típico do ambiente nos primeiros instantes
      this.picoCalibracao = Math.max(this.picoCalibracao * 0.9, rms);
      this.ruido = Math.max(this.ruido * 0.8 + rms * 0.2, this.picoCalibracao * 0.8);
      return ev;
    }
    const som = rms > this.limiar;
    // aprende o ruído no silêncio, mas não o eco do personagem (sensibilidade alta)
    if (!som && !this.falando && this.sensibilidade <= 1) this.ruido = this.ruido * 0.97 + rms * 0.03;
    if (som && this.falando && t - this.inicioFala >= this.o.falaMaximaMs) {
      // fala longa demais: provavelmente ruído contínuo — encerra e passa a considerar esse nível como fundo
      this.ruido = Math.max(this.ruido, rms);
      this.falando = false;
      this.trechoAberto = false;
      this.ativoDesde = -1;
      this.fimFala = t;
      ev.push('trecho', 'fim');
      return ev;
    }
    if (som) {
      if (this.ativoDesde < 0) this.ativoDesde = t;
      this.ultimoSom = t;
      if (!this.falando && t - this.ativoDesde >= this.o.falaMinimaMs) {
        this.falando = true;
        this.trechoAberto = true;
        this.inicioFala = this.ativoDesde;
        this.pausas = 0;
        ev.push('inicio');
      } else if (this.falando && !this.trechoAberto) {
        this.trechoAberto = true;
        this.pausas++;
      }
      return ev;
    }
    if (!this.falando) {
      // som curto demais: zera
      if (this.ativoDesde >= 0 && t - this.ativoDesde > this.o.falaMinimaMs * 2) this.ativoDesde = -1;
      return ev;
    }
    const quieto = t - this.ultimoSom;
    if (this.trechoAberto && quieto >= this.o.pausaTrechoMs && quieto < this.o.silencioFimMs) {
      this.trechoAberto = false;
      ev.push('trecho');
    }
    if (quieto >= this.o.silencioFimMs) {
      this.falando = false;
      this.trechoAberto = false;
      this.ativoDesde = -1;
      this.fimFala = this.ultimoSom;
      ev.push('fim');
    }
    return ev;
  }

  reiniciar() {
    this.falando = false;
    this.ativoDesde = -1;
    this.ultimoSom = -1;
    this.trechoAberto = false;
    this.pausas = 0;
  }
}
