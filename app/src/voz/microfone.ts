// Microfone contínuo (modo mãos-livres da Edição Local): capta PCM, detecta a fala (VAD),
// fecha trechos nas pausas e manda cada trecho ao Whisper do gateway enquanto você ainda fala.
import { DetectorFala, type OpcoesVad } from './vad';

const TAXA = 16000;
const PRE_ROLL_MS = 300; // guarda um pouco antes do início para não cortar a 1ª sílaba

export interface FalaOuvida {
  texto: string;
  duracao_s: number;
  pausas: number;
  /** ms do fim do seu som até o texto pronto */
  espera_stt_ms: number;
  /** instante (performance.now) em que você começou a falar */
  inicio: number;
}

export interface EventosMicrofone {
  /** você começou a falar (para interromper o personagem) */
  aoComecar?: () => void;
  /** volume 0..1 para animar o botão */
  aoVolume?: (v: number) => void;
  /** texto parcial (trechos já transcritos) */
  aoParcial?: (t: string) => void;
  /** sua vez acabou: texto completo */
  aoFalar: (f: FalaOuvida) => void;
  aoErro?: (e: Error) => void;
}

/** Codifica float32 mono em WAV PCM 16 bits. */
export function wav16(amostras: Float32Array, taxa = TAXA): Blob {
  const buf = new ArrayBuffer(44 + amostras.length * 2);
  const v = new DataView(buf);
  const txt = (o: number, s: string) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  txt(0, 'RIFF');
  v.setUint32(4, 36 + amostras.length * 2, true);
  txt(8, 'WAVE');
  txt(12, 'fmt ');
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 1, true);
  v.setUint32(24, taxa, true);
  v.setUint32(28, taxa * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  txt(36, 'data');
  v.setUint32(40, amostras.length * 2, true);
  for (let i = 0; i < amostras.length; i++) v.setInt16(44 + i * 2, Math.max(-1, Math.min(1, amostras[i])) * 0x7fff, true);
  return new Blob([buf], { type: 'audio/wav' });
}

/** Reamostragem simples (média por janela) para 16 kHz. */
export function reamostrar(x: Float32Array, de: number, para = TAXA): Float32Array {
  if (de === para) return x;
  const r = de / para;
  const n = Math.floor(x.length / r);
  const y = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const a = Math.floor(i * r);
    const b = Math.min(x.length, Math.floor((i + 1) * r));
    let s = 0;
    for (let j = a; j < b; j++) s += x[j];
    y[i] = s / Math.max(1, b - a);
  }
  return y;
}

const PROCESSADOR = `
class Capta extends AudioWorkletProcessor {
  process(ins) { const c = ins[0] && ins[0][0]; if (c) this.port.postMessage(c.slice(0)); return true; }
}
registerProcessor('tc-capta', Capta);`;

async function transcrever(audio: Float32Array): Promise<string> {
  const fd = new FormData();
  fd.append('audio', wav16(audio), 'trecho.wav');
  fd.append('palavras', 'false');
  const r = await fetch('api/stt', { method: 'POST', body: fd });
  if (!r.ok) throw new Error(`transcrição falhou (HTTP ${r.status})`);
  return ((await r.json()) as { texto: string }).texto.trim();
}

export class MicrofoneContinuo {
  readonly vad: DetectorFala;
  private ctx: AudioContext | null = null;
  private stream: MediaStream | null = null;
  private no: AudioWorkletNode | null = null;
  private preRoll: Float32Array[] = [];
  private trecho: Float32Array[] = [];
  private pendentes: Promise<string>[] = [];
  private amostrasFala = 0;
  private pausado = false;

  constructor(
    private ev: EventosMicrofone,
    vad: Partial<OpcoesVad> = {},
  ) {
    this.vad = new DetectorFala(vad);
  }

  async ligar() {
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
    this.ctx = new AudioContext();
    const url = URL.createObjectURL(new Blob([PROCESSADOR], { type: 'text/javascript' }));
    await this.ctx.audioWorklet.addModule(url);
    URL.revokeObjectURL(url);
    const fonte = this.ctx.createMediaStreamSource(this.stream);
    this.no = new AudioWorkletNode(this.ctx, 'tc-capta');
    const taxa = this.ctx.sampleRate;
    const maxPre = Math.ceil((PRE_ROLL_MS / 1000) * TAXA);
    this.no.port.onmessage = (m: MessageEvent<Float32Array>) => this.quadro(reamostrar(m.data, taxa), maxPre);
    fonte.connect(this.no);
  }

  /** Para de ouvir sem desligar (enquanto avalia, por exemplo). */
  pausar(p: boolean) {
    this.pausado = p;
    if (p) {
      this.vad.reiniciar();
      this.trecho = [];
      this.pendentes = [];
      this.amostrasFala = 0;
    }
  }

  private quadro(x: Float32Array, maxPre: number) {
    if (this.pausado) return;
    let s = 0;
    for (const a of x) s += a * a;
    const rms = Math.sqrt(s / Math.max(1, x.length));
    this.ev.aoVolume?.(Math.min(1, rms * 6));
    const estava = this.vad.emFala;
    const eventos = this.vad.quadro(rms, performance.now());
    if (this.vad.emFala || estava || eventos.length) {
      this.trecho.push(x);
      this.amostrasFala += x.length;
    } else {
      this.preRoll.push(x);
      let n = this.preRoll.reduce((a, b) => a + b.length, 0);
      while (n > maxPre && this.preRoll.length > 1) n -= this.preRoll.shift()!.length;
    }
    for (const e of eventos) {
      if (e === 'inicio') {
        this.trecho = [...this.preRoll, ...this.trecho];
        this.amostrasFala = this.trecho.reduce((a, b) => a + b.length, 0);
        this.preRoll = [];
        this.ev.aoComecar?.();
      } else if (e === 'trecho') {
        this.fecharTrecho();
      } else if (e === 'fim') {
        this.fecharTrecho();
        this.concluir();
      }
    }
  }

  private fecharTrecho() {
    const n = this.trecho.reduce((a, b) => a + b.length, 0);
    if (n < TAXA * 0.15) {
      this.trecho = [];
      return;
    }
    const audio = new Float32Array(n);
    let o = 0;
    for (const p of this.trecho) {
      audio.set(p, o);
      o += p.length;
    }
    this.trecho = [];
    const p = transcrever(audio);
    this.pendentes.push(p);
    const ate = [...this.pendentes];
    p.then(() => Promise.all(ate).then((ts) => this.ev.aoParcial?.(ts.filter(Boolean).join(' ')))).catch(() => {});
  }

  private concluir() {
    const pendentes = this.pendentes;
    const inicio = this.vad.inicioFala;
    const fimSom = this.vad.fimFala;
    const pausas = this.vad.pausas;
    const duracao_s = Math.max(0, (fimSom - inicio) / 1000);
    this.pendentes = [];
    this.amostrasFala = 0;
    Promise.all(pendentes)
      .then((ts) => {
        const texto = ts.filter(Boolean).join(' ').trim();
        if (texto) this.ev.aoFalar({ texto, duracao_s, pausas, espera_stt_ms: Math.round(performance.now() - fimSom), inicio });
      })
      .catch((e) => this.ev.aoErro?.(e as Error));
  }

  desligar() {
    this.no?.disconnect();
    this.stream?.getTracks().forEach((t) => t.stop());
    this.ctx?.close().catch(() => {});
    this.ctx = null;
    this.stream = null;
  }
}
