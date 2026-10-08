// Voz: ouvir (STT) e falar (TTS). Edição Local usa o gateway (Whisper + Kokoro/Piper);
// Nuvem usa o navegador (Web Speech). Toda fala devolve o volume para animar a boca.
import { DivisorFrases } from '../sessao/fluxo';
import { FilaFala, contextoAudio, type VozEscolhida } from './falante';


// ---------------- Falar

let filaAtual: FilaFala | null = null;

export function pararFala() {
  filaAtual?.parar();
  filaAtual = null;
  if (typeof speechSynthesis !== 'undefined') speechSynthesis.cancel();
}

/** Fala um texto pronto (treinador). Corta em frases para a voz começar logo. */
export async function falar(texto: string, voz: VozEscolhida, aoVolume: (v: number) => void): Promise<void> {
  pararFala();
  if (!texto.trim()) return;
  const fila = new FilaFala(voz, aoVolume);
  filaAtual = fila;
  const div = new DivisorFrases();
  for (const f of [...div.adicionar(texto + ' '), ...div.fechar()]) fila.adicionar(f);
  fila.fechar();
  await fila.terminou;
  if (filaAtual === fila) filaAtual = null;
}

/** Abre uma fila para frases que ainda vão chegar (personagem em streaming). */
export function abrirFila(voz: VozEscolhida, aoVolume: (v: number) => void, aoFrase?: (i: number, f: string) => void): FilaFala {
  pararFala();
  filaAtual = new FilaFala(voz, aoVolume, aoFrase);
  return filaAtual;
}

/** Libera o áudio do navegador no primeiro clique (política de autoplay). */
export function liberarAudio() {
  contextoAudio();
}

// ---------------- Ouvir

export interface Escuta {
  parar(): void;
  /** resolve com o texto final e a duração da fala */
  resultado: Promise<{ texto: string; duracao_s: number }>;
}

export function sttNavegadorDisponivel(): boolean {
  const w = window as unknown as Record<string, unknown>;
  return !!(w.SpeechRecognition || w.webkitSpeechRecognition);
}

/** Navegador (Web Speech). No Chrome o áudio vai para o serviço de voz do Google. */
export function ouvirNavegador(parcial: (t: string) => void): Escuta {
  const w = window as unknown as Record<string, new () => SpeechRecognitionLike>;
  const R = w.SpeechRecognition || w.webkitSpeechRecognition;
  const rec = new R();
  rec.lang = 'pt-BR';
  rec.interimResults = true;
  rec.continuous = true;
  let final = '';
  const inicio = performance.now();
  const resultado = new Promise<{ texto: string; duracao_s: number }>((ok, falha) => {
    rec.onresult = (ev) => {
      let prov = '';
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const r = ev.results[i];
        if (r.isFinal) final += r[0].transcript + ' ';
        else prov += r[0].transcript;
      }
      parcial((final + prov).trim());
    };
    rec.onerror = (ev) => (ev.error === 'no-speech' || ev.error === 'aborted' ? ok({ texto: final.trim(), duracao_s: 0 }) : falha(new Error(`microfone: ${ev.error}`)));
    rec.onend = () => ok({ texto: final.trim(), duracao_s: (performance.now() - inicio) / 1000 });
  });
  rec.start();
  return { parar: () => rec.stop(), resultado };
}

/** Gateway: grava com MediaRecorder e transcreve com Whisper local (com tempo por palavra). */
export function ouvirGateway(aoVolume: (v: number) => void): Escuta {
  let parar = () => {};
  const resultado = (async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const rec = new MediaRecorder(stream);
    const partes: Blob[] = [];
    rec.ondataavailable = (e) => partes.push(e.data);
    const ctx = contextoAudio();
    const an = ctx.createAnalyser();
    ctx.createMediaStreamSource(stream).connect(an);
    const buf = new Uint8Array(an.fftSize);
    const iv = setInterval(() => {
      an.getByteTimeDomainData(buf);
      let s = 0;
      for (const b of buf) s += ((b - 128) / 128) ** 2;
      aoVolume(Math.min(1, Math.sqrt(s / buf.length) * 5));
    }, 60);
    const parou = new Promise<void>((ok) => (rec.onstop = () => ok()));
    rec.start();
    parar = () => rec.state !== 'inactive' && rec.stop();
    await parou;
    clearInterval(iv);
    aoVolume(0);
    stream.getTracks().forEach((t) => t.stop());
    const fd = new FormData();
    fd.append('audio', new Blob(partes, { type: rec.mimeType || 'audio/webm' }), 'fala.webm');
    const r = await fetch('api/stt', { method: 'POST', body: fd });
    if (!r.ok) throw new Error(`transcrição falhou (HTTP ${r.status})`);
    const d = (await r.json()) as { texto: string; palavras?: { ini: number; fim: number }[] };
    const p = d.palavras ?? [];
    const duracao_s = p.length ? p[p.length - 1].fim - p[0].ini : 0;
    return { texto: d.texto.trim(), duracao_s };
  })();
  return { parar: () => parar(), resultado };
}

/**
 * Mãos-livres no navegador (Edição Nuvem): escuta contínua do Web Speech. Sua vez acaba
 * depois de `silencioMs` sem palavra nova. Sem interrupção: o navegador ouviria a própria voz.
 */
export function escutaContinuaNavegador(
  aoFalar: (f: { texto: string; duracao_s: number; inicio: number }) => void,
  aoParcial: (t: string) => void,
  silencioMs = 900,
): { parar(): void; pausar(p: boolean): void } {
  const w = window as unknown as Record<string, new () => SpeechRecognitionLike>;
  const R = w.SpeechRecognition || w.webkitSpeechRecognition;
  let rec: SpeechRecognitionLike | null = null;
  let final = '';
  let inicio = 0;
  let ultimo = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let ativo = true;
  let pausado = false;
  let aberto = false;
  const entregar = () => {
    const t = final.trim();
    final = '';
    if (t) aoFalar({ texto: t, duracao_s: Math.max(0, (ultimo - inicio) / 1000), inicio });
  };
  const abrir = () => {
    if (!ativo || pausado || aberto) return;
    aberto = true;
    rec = new R();
    rec.lang = 'pt-BR';
    rec.interimResults = true;
    rec.continuous = true;
    rec.onresult = (ev) => {
      let prov = '';
      if (!final && !inicio) inicio = performance.now();
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const r = ev.results[i];
        if (r.isFinal) final += r[0].transcript + ' ';
        else prov += r[0].transcript;
      }
      ultimo = performance.now();
      aoParcial((final + prov).trim());
      clearTimeout(timer);
      timer = setTimeout(() => {
        if (!prov) {
          entregar();
          inicio = 0;
        }
      }, silencioMs);
    };
    rec.onerror = () => {};
    rec.onend = () => {
      aberto = false;
      setTimeout(abrir, 150);
    }; // o Chrome encerra sozinho de tempos em tempos
    rec.start();
  };
  abrir();
  return {
    parar() {
      ativo = false;
      clearTimeout(timer);
      rec?.stop();
    },
    pausar(p: boolean) {
      pausado = p;
      if (p) {
        clearTimeout(timer);
        final = '';
        inicio = 0;
        rec?.stop();
      } else abrir();
    },
  };
}

interface SpeechRecognitionLike {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start(): void;
  stop(): void;
  onresult: (ev: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void;
  onerror: (ev: { error: string }) => void;
  onend: () => void;
}
