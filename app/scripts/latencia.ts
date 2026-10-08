// Latência da conversa por voz na Edição Local: do fim da sua fala até a 1ª frase do personagem soar.
// Mede STT (Whisper) + modelo até a 1ª frase da "fala" (streaming) + TTS dessa frase, pelo gateway.
// Uso: npx vite-node scripts/latencia.ts -- --gateway http://127.0.0.1:8787 --modelo qwen3:30b [--rodadas 8] [--motor ollama]
import { CENAS } from '../src/cenas/cenas';
import { motorGateway } from '../src/motor/motores';
import { DivisorFrases, LeitorFala } from '../src/sessao/fluxo';
import { identidade, msgsPersonagem } from '../src/sessao/prompts';
import type { Fala } from '../src/tipos';
import { vozDaPessoa } from '../src/voz/vozes';

const args = process.argv.slice(2);
const arg = (n: string, p?: string) => {
  const i = args.indexOf(`--${n}`);
  return i >= 0 ? args[i + 1] : p;
};
const gateway = arg('gateway', 'http://127.0.0.1:8787')!;
const motor = motorGateway(arg('motor', 'ollama')!, arg('modelo'), gateway);
const rodadas = Number(arg('rodadas', '8'));
const alvo = 1500;
const inteira = args.includes('--inteira');
const silencio = Number(arg('silencio', '600'));

async function post(caminho: string, corpo: BodyInit, json = true): Promise<Response> {
  const r = await fetch(`${gateway}${caminho}`, {
    method: 'POST',
    headers: json ? { 'content-type': 'application/json' } : undefined,
    body: corpo,
  });
  if (!r.ok) throw new Error(`${caminho}: HTTP ${r.status} ${(await r.text()).slice(0, 200)}`);
  return r;
}

const pct = (xs: number[], p: number) => {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))];
};

const linhas: { cena: string; stt: number; modelo: number; tts: number; total: number; frase: string }[] = [];
console.log(`Latência com ${motor.rotulo} — ${rodadas} rodadas\n`);
// aquece o modelo (a 1ª chamada carrega os pesos; não entra na conta)
for await (const _ of motor.chat([{ role: 'user', content: 'Diga só: ok' }], { temperatura: 0 })) void _;

for (let i = 0; i < rodadas; i++) {
  const cena = CENAS[i % CENAS.length];
  const id = identidade(cena, 'mulher');
  const frase = cena.calibracao.nota_8;
  // 1) a "sua fala" vira áudio (fora da conta) e volta a texto pelo Whisper.
  // Como no mãos-livres, os trechos separados por pausa já foram transcritos enquanto você falava:
  // depois do silêncio final só falta o último trecho.
  const trechos = inteira ? [frase] : frase.split(/(?<=[.!?…])\s+/).filter((x) => x.trim());
  const textos: string[] = [];
  let tStt = 0;
  for (let k = 0; k < trechos.length; k++) {
    const audio = await (await post('/api/tts', JSON.stringify({ texto: trechos[k], voz: 'piper:pt_BR-faber-medium' }))).arrayBuffer();
    const fd = new FormData();
    fd.append('audio', new Blob([audio], { type: 'audio/wav' }), 'fala.wav');
    fd.append('palavras', 'false');
    const t0 = performance.now();
    textos.push(((await (await post('/api/stt', fd, false)).json()) as { texto: string }).texto);
    if (k === trechos.length - 1) tStt = performance.now() - t0;
  }
  const stt = { texto: textos.join(' ') };
  let t = 0;

  // 2) modelo em streaming até a 1ª frase completa da "fala"
  const falas: Fala[] = [];
  if (cena.abertura_personagem?.trim()) falas.push({ quem: 'personagem', texto: cena.abertura_personagem });
  falas.push({ quem: 'voce', texto: stt.texto });
  const leitor = new LeitorFala();
  const divisor = new DivisorFrases();
  const ctrl = new AbortController();
  t = performance.now();
  let primeira = '';
  try {
    for await (const pedaco of motor.chat(msgsPersonagem(cena, 'mulher', falas, cena.personagem.estado_inicial), { json: true, temperatura: 0.8, signal: ctrl.signal })) {
      const fs = divisor.adicionar(leitor.adicionar(pedaco));
      if (fs.length) {
        primeira = fs[0];
        break;
      }
      if (leitor.completa) {
        primeira = divisor.fechar()[0] ?? '';
        break;
      }
    }
  } finally {
    ctrl.abort();
  }
  const tModelo = performance.now() - t;
  if (!primeira) throw new Error(`cena ${cena.id}: o modelo não devolveu "fala"`);

  // 3) voz da 1ª frase
  t = performance.now();
  await (await post('/api/tts', JSON.stringify({ texto: primeira, voz: vozDaPessoa(id.voz, id.nome) }))).arrayBuffer();
  const tTts = performance.now() - t;
  const total = tStt + tModelo + tTts;
  linhas.push({ cena: cena.id, stt: tStt, modelo: tModelo, tts: tTts, total, frase: primeira });
  console.log(
    `${total < alvo ? '✓' : '✗'} ${cena.id.padEnd(26)} total ${Math.round(total)} ms  (stt ${Math.round(tStt)} · modelo ${Math.round(tModelo)} · voz ${Math.round(tTts)})  "${primeira.slice(0, 50)}"`,
  );
}

const tot = linhas.map((l) => l.total);
const p50 = pct(tot, 50);
const p95 = pct(tot, 95);
const media = (k: 'stt' | 'modelo' | 'tts') => Math.round(linhas.reduce((s, l) => s + l[k], 0) / linhas.length);
console.log(`\np50 ${Math.round(p50)} ms · p95 ${Math.round(p95)} ms · médias: stt ${media('stt')} · modelo ${media('modelo')} · voz ${media('tts')}`);
console.log(`(fora da conta: a espera de ${silencio} ms de silêncio que marca o fim da sua fala; no app o último trecho começa a ser transcrito aos 350 ms, então parte do STT corre durante essa espera)`);
console.log(p50 < alvo ? `OK: p50 abaixo de ${alvo} ms` : `ACIMA DO ALVO: p50 ≥ ${alvo} ms`);
process.exit(p50 < alvo ? 0 : 1);
