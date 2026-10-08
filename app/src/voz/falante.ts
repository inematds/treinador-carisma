// Fila de fala: recebe frases enquanto o modelo ainda escreve, pede a voz de cada uma
// adiantado e toca em sequência. Pode ser interrompida (barge-in).
import type { Genero } from '../tipos';

export interface VozEscolhida {
  /** voz do gateway ("kokoro:pf_dora"); null = voz do navegador */
  gateway: string | null;
  genero: Genero;
  velocidade?: number;
}

let ctx: AudioContext | null = null;
export function contextoAudio(): AudioContext {
  ctx ??= new AudioContext();
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
}

function vozNavegador(genero: Genero): SpeechSynthesisVoice | undefined {
  const vozes = speechSynthesis.getVoices().filter((v) => v.lang.toLowerCase().startsWith('pt'));
  const fem = /female|feminina|luciana|francisca|maria|vit[oó]ria|helo|camila|thalita|leila|raquel/i;
  const masc = /male|masculina|daniel|antonio|ant[oô]nio|fabio|f[aá]bio|felipe|ricardo|donato|humberto|julio/i;
  const alvo = genero === 'feminina' ? fem : masc;
  return vozes.find((v) => alvo.test(v.name) && v.lang === 'pt-BR') ?? vozes.find((v) => alvo.test(v.name)) ?? vozes.find((v) => v.lang === 'pt-BR') ?? vozes[0];
}

async function pedirAudio(texto: string, voz: VozEscolhida): Promise<AudioBuffer> {
  const r = await fetch('api/tts', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ texto, voz: voz.gateway, velocidade: voz.velocidade ?? 1 }),
  });
  if (!r.ok) throw new Error(`tts ${r.status}`);
  return contextoAudio().decodeAudioData(await r.arrayBuffer());
}

export class FilaFala {
  private frases: string[] = [];
  private audios: Promise<AudioBuffer | null>[] = [];
  private fechada = false;
  private parada = false;
  private acordar: (() => void) | null = null;
  private fonteAtual: AudioBufferSourceNode | null = null;
  private tocadas = 0;
  private atual = -1;
  /** resolve quando tudo tocou (ou a fila foi parada) */
  readonly terminou: Promise<void>;

  constructor(
    private voz: VozEscolhida,
    private aoVolume: (v: number) => void = () => {},
    private aoFrase: (i: number, frase: string) => void = () => {},
  ) {
    this.terminou = this.rodar();
  }

  get falando(): boolean {
    return this.atual >= 0;
  }

  adicionar(frase: string) {
    const f = frase.trim();
    if (!f || this.parada || this.fechada) return;
    this.frases.push(f);
    // pede a voz já (a próxima frase fica pronta enquanto a anterior toca)
    this.audios.push(this.voz.gateway ? pedirAudio(f, this.voz).catch(() => null) : Promise.resolve(null));
    this.acordar?.();
  }

  fechar() {
    this.fechada = true;
    this.acordar?.();
  }

  /** Interrompe. Devolve o texto que chegou a ser dito (frases inteiras + a que estava tocando). */
  parar(): string {
    this.parada = true;
    try {
      this.fonteAtual?.stop();
    } catch {
      /* já parou */
    }
    if (typeof speechSynthesis !== 'undefined' && !this.voz.gateway) speechSynthesis.cancel();
    this.acordar?.();
    const ditas = this.frases.slice(0, this.atual >= 0 ? this.atual + 1 : this.tocadas);
    return ditas.join(' ');
  }

  private async rodar() {
    for (let i = 0; ; i++) {
      while (i >= this.frases.length && !this.fechada && !this.parada) await new Promise<void>((ok) => (this.acordar = ok));
      this.acordar = null;
      if (this.parada || i >= this.frases.length) break;
      const buf = await this.audios[i];
      if (this.parada) break;
      this.atual = i;
      this.aoFrase(i, this.frases[i]);
      if (buf) await this.tocar(buf);
      else await this.falarNavegador(this.frases[i]);
      this.tocadas = i + 1;
      this.atual = -1;
    }
    this.atual = -1;
    this.aoVolume(0);
  }

  private tocar(buf: AudioBuffer): Promise<void> {
    const c = contextoAudio();
    const fonte = c.createBufferSource();
    fonte.buffer = buf;
    const an = c.createAnalyser();
    an.fftSize = 512;
    fonte.connect(an);
    an.connect(c.destination);
    this.fonteAtual = fonte;
    const amostras = new Uint8Array(an.fftSize);
    let raf = 0;
    const medir = () => {
      an.getByteTimeDomainData(amostras);
      let s = 0;
      for (const b of amostras) s += ((b - 128) / 128) ** 2;
      this.aoVolume(Math.min(1, Math.sqrt(s / amostras.length) * 5));
      raf = requestAnimationFrame(medir);
    };
    return new Promise((ok) => {
      fonte.onended = () => {
        cancelAnimationFrame(raf);
        this.aoVolume(0);
        this.fonteAtual = null;
        ok();
      };
      fonte.start();
      medir();
    });
  }

  private falarNavegador(texto: string): Promise<void> {
    if (typeof speechSynthesis === 'undefined') return Promise.resolve();
    return new Promise((ok) => {
      const u = new SpeechSynthesisUtterance(texto);
      u.lang = 'pt-BR';
      const v = vozNavegador(this.voz.genero);
      if (v) u.voice = v;
      u.rate = 1.02 * (this.voz.velocidade ?? 1);
      u.pitch = this.voz.genero === 'feminina' ? 1.08 : 0.92;
      // sem acesso ao áudio do navegador: anima a boca por sílabas aproximadas
      let t = 0;
      const iv = setInterval(() => this.aoVolume(0.25 + 0.65 * Math.abs(Math.sin((t += 0.9)))), 90);
      const fim = () => {
        clearInterval(iv);
        this.aoVolume(0);
        ok();
      };
      u.onend = fim;
      u.onerror = fim;
      // alguns navegadores não disparam onend: teto pelo tamanho do texto
      setTimeout(fim, 1500 + texto.length * 120);
      speechSynthesis.speak(u);
    });
  }
}
