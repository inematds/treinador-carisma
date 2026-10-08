// Voz: ouvir (STT) e falar (TTS). Edição Local usa o gateway (Whisper + Piper);
// Nuvem usa o navegador (Web Speech). Toda fala devolve o volume para animar a boca.
import type { Genero } from '../tipos';

export type FonteVoz = 'gateway' | 'navegador';

// ---------------- Falar

let audioAtual: HTMLAudioElement | null = null;
let ctx: AudioContext | null = null;

export function pararFala() {
  if (audioAtual) {
    audioAtual.pause();
    audioAtual = null;
  }
  if (typeof speechSynthesis !== 'undefined') speechSynthesis.cancel();
}

function vozNavegador(genero: Genero): SpeechSynthesisVoice | undefined {
  const vozes = speechSynthesis.getVoices().filter((v) => v.lang.toLowerCase().startsWith('pt'));
  const fem = /female|feminina|luciana|francisca|maria|vit[oó]ria|helo|camila|thalita|leila|raquel/i;
  const masc = /male|masculina|daniel|antonio|ant[oô]nio|fabio|f[aá]bio|felipe|ricardo|donato|humberto|julio/i;
  const alvo = genero === 'feminina' ? fem : masc;
  return vozes.find((v) => alvo.test(v.name) && v.lang === 'pt-BR') ?? vozes.find((v) => alvo.test(v.name)) ?? vozes.find((v) => v.lang === 'pt-BR') ?? vozes[0];
}

/**
 * Fala o texto. `aoVolume` recebe 0..1 enquanto fala (boca do rosto).
 * Gateway: Piper (voz masculina local); se o gênero for feminino ou o gateway falhar, usa o navegador.
 */
export async function falar(texto: string, genero: Genero, fonte: FonteVoz, aoVolume: (v: number) => void): Promise<void> {
  pararFala();
  if (!texto.trim()) return;
  if (fonte === 'gateway' && genero === 'masculina') {
    try {
      await falarGateway(texto, aoVolume);
      return;
    } catch {
      /* cai para o navegador */
    }
  }
  await falarNavegador(texto, genero, aoVolume);
}

async function falarGateway(texto: string, aoVolume: (v: number) => void) {
  const r = await fetch('api/tts', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ texto }) });
  if (!r.ok) throw new Error(`tts ${r.status}`);
  const url = URL.createObjectURL(await r.blob());
  const audio = new Audio(url);
  audioAtual = audio;
  ctx ??= new AudioContext();
  const fonte = ctx.createMediaElementSource(audio);
  const an = ctx.createAnalyser();
  an.fftSize = 512;
  fonte.connect(an);
  an.connect(ctx.destination);
  const buf = new Uint8Array(an.fftSize);
  let raf = 0;
  const medir = () => {
    an.getByteTimeDomainData(buf);
    let s = 0;
    for (const b of buf) s += ((b - 128) / 128) ** 2;
    aoVolume(Math.min(1, Math.sqrt(s / buf.length) * 5));
    raf = requestAnimationFrame(medir);
  };
  await new Promise<void>((ok, falha) => {
    audio.onended = () => ok();
    audio.onerror = () => falha(new Error('erro no áudio'));
    audio.play().then(medir, falha);
  });
  cancelAnimationFrame(raf);
  aoVolume(0);
  URL.revokeObjectURL(url);
}

function falarNavegador(texto: string, genero: Genero, aoVolume: (v: number) => void): Promise<void> {
  if (typeof speechSynthesis === 'undefined') return Promise.resolve();
  return new Promise((ok) => {
    const u = new SpeechSynthesisUtterance(texto);
    u.lang = 'pt-BR';
    const v = vozNavegador(genero);
    if (v) u.voice = v;
    u.rate = 1.02;
    u.pitch = genero === 'feminina' ? 1.08 : 0.92;
    // Sem acesso ao áudio do navegador: anima a boca por sílabas aproximadas.
    let t = 0;
    const iv = setInterval(() => aoVolume(0.25 + 0.65 * Math.abs(Math.sin((t += 0.9)))), 90);
    const fim = () => {
      clearInterval(iv);
      aoVolume(0);
      ok();
    };
    u.onend = fim;
    u.onerror = fim;
    speechSynthesis.speak(u);
  });
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
    ctx ??= new AudioContext();
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
