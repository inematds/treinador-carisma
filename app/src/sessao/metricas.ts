// Métricas objetivas de fala (texto e, quando houver, voz).
import type { Fala } from '../tipos';

const VICIOS = ['né', 'tipo', 'tipo assim', 'então', 'aí', 'sabe', 'hum', 'éé', 'ééé', 'basicamente', 'na verdade'];
const ABERTAS = /^(como|o que|o quê|por que|porque|qual|quais|quando|onde|me conta|conta|o que você|como você)\b/i;

export function palavras(t: string): string[] {
  return t
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s'-]/gu, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

export function contarVicios(t: string): Record<string, number> {
  const norm = ` ${palavras(t).join(' ')} `;
  const r: Record<string, number> = {};
  for (const v of VICIOS) {
    const n = norm.split(` ${v} `).length - 1;
    if (n > 0) r[v] = n;
  }
  return r;
}

export function perguntas(t: string): { total: number; abertas: number } {
  const frases = t.split(/(?<=[?!.])\s+/).map((f) => f.trim());
  const q = frases.filter((f) => f.endsWith('?'));
  return { total: q.length, abertas: q.filter((f) => ABERTAS.test(f)).length };
}

export interface Metricas {
  falas: number;
  palavras_por_fala: number;
  proporcao_fala: number; // % das palavras ditas pelo usuário
  perguntas: number;
  perguntas_abertas: number;
  vicios: Record<string, number>;
  palavras_min: number | null; // só com voz
  /** segundos, em média, entre o personagem terminar e você começar (só no mãos-livres) */
  tempo_resposta_s: number | null;
  /** vezes que você cortou o personagem */
  interrupcoes: number;
  /** pausas no meio das suas falas (hesitação) */
  pausas: number;
}

export function metricas(falas: Fala[]): Metricas {
  const minhas = falas.filter((f) => f.quem === 'voce');
  const outras = falas.filter((f) => f.quem === 'personagem');
  const pm = minhas.reduce((s, f) => s + palavras(f.texto).length, 0);
  const po = outras.reduce((s, f) => s + palavras(f.texto).length, 0);
  const vicios: Record<string, number> = {};
  let q = 0;
  let qa = 0;
  for (const f of minhas) {
    for (const [k, v] of Object.entries(contarVicios(f.texto))) vicios[k] = (vicios[k] ?? 0) + v;
    const p = perguntas(f.texto);
    q += p.total;
    qa += p.abertas;
  }
  const comVoz = minhas.filter((f) => f.voz && f.voz.duracao_s > 0.5);
  const seg = comVoz.reduce((s, f) => s + f.voz!.duracao_s, 0);
  const palVoz = comVoz.reduce((s, f) => s + palavras(f.texto).length, 0);
  const resp = minhas.map((f) => f.voz?.tempo_resposta_s).filter((x): x is number => typeof x === 'number' && x >= 0);
  return {
    falas: minhas.length,
    palavras_por_fala: minhas.length ? Math.round(pm / minhas.length) : 0,
    proporcao_fala: pm + po ? Math.round((pm / (pm + po)) * 100) : 0,
    perguntas: q,
    perguntas_abertas: qa,
    vicios,
    palavras_min: seg > 0 ? Math.round((palVoz / seg) * 60) : null,
    tempo_resposta_s: resp.length ? Math.round((resp.reduce((a, b) => a + b, 0) / resp.length) * 10) / 10 : null,
    interrupcoes: outras.filter((f) => f.interrompida).length,
    pausas: comVoz.reduce((s, f) => s + (f.voz!.pausas ?? 0), 0),
  };
}
