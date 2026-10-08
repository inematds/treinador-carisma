// Gera os áudios do microfone falso do Chromium com a voz do gateway (fora do repositório).
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const PASTA_AUDIO = join(dirname(fileURLToPath(import.meta.url)), '.audio');

function pcmDoWav(buf: ArrayBuffer): { pcm: Int16Array; taxa: number } {
  const v = new DataView(buf);
  const taxa = v.getUint32(24, true);
  let o = 12;
  while (o < v.byteLength - 8) {
    const id = String.fromCharCode(v.getUint8(o), v.getUint8(o + 1), v.getUint8(o + 2), v.getUint8(o + 3));
    const tam = v.getUint32(o + 4, true);
    if (id === 'data') return { pcm: new Int16Array(buf.slice(o + 8, o + 8 + tam)), taxa };
    o += 8 + tam;
  }
  throw new Error('WAV sem bloco data');
}

function wav(pcm: Int16Array, taxa: number): Buffer {
  const b = Buffer.alloc(44 + pcm.length * 2);
  b.write('RIFF', 0);
  b.writeUInt32LE(36 + pcm.length * 2, 4);
  b.write('WAVEfmt ', 8);
  b.writeUInt32LE(16, 16);
  b.writeUInt16LE(1, 20);
  b.writeUInt16LE(1, 22);
  b.writeUInt32LE(taxa, 24);
  b.writeUInt32LE(taxa * 2, 28);
  b.writeUInt16LE(2, 32);
  b.writeUInt16LE(16, 34);
  b.write('data', 36);
  b.writeUInt32LE(pcm.length * 2, 40);
  Buffer.from(pcm.buffer).copy(b, 44);
  return b;
}

/** Monta um WAV: números = segundos de silêncio, textos = fala sintetizada. */
async function montar(gateway: string, roteiro: (string | number)[]): Promise<Buffer> {
  const partes: Int16Array[] = [];
  let taxa = 24000;
  for (const item of roteiro) {
    if (typeof item === 'number') {
      partes.push(new Int16Array(Math.round(item * taxa)));
      continue;
    }
    const r = await fetch(`${gateway}/api/tts`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ texto: item, voz: 'kokoro:pm_santa' }) });
    if (!r.ok) throw new Error(`tts ${r.status}`);
    const w = pcmDoWav(await r.arrayBuffer());
    taxa = w.taxa;
    partes.push(w.pcm);
  }
  const n = partes.reduce((a, p) => a + p.length, 0);
  const tudo = new Int16Array(n);
  let o = 0;
  for (const p of partes) {
    tudo.set(p, o);
    o += p.length;
  }
  return wav(tudo, taxa);
}

export default async function preparar() {
  const gateway = process.env.E2E_GATEWAY;
  if (!gateway) return;
  mkdirSync(PASTA_AUDIO, { recursive: true });
  writeFileSync(join(PASTA_AUDIO, 'conversa.wav'), await montar(gateway, [1.5, 'Oi Marcos, posso falar com você um minuto sobre os horários das reuniões?', 16]));
  writeFileSync(join(PASTA_AUDIO, 'interrompe.wav'), await montar(gateway, [1.5, 'Me conta mais sobre isso, por favor.', 2.2, 'Espera, deixa eu completar uma coisa.', 16]));
}
