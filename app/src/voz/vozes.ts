// Qual voz do gateway cada pessoa usa. Kokoro tem voz feminina e masculina em português;
// Piper só masculina; chatterbox só para treinador(a) com WAV de referência do próprio usuário.
import type { Genero } from '../tipos';

export interface EnginesTts {
  piper?: { ok: boolean; vozes?: string[] };
  kokoro?: { ok: boolean; vozes?: string[] };
  chatterbox?: { ok: boolean; vozes?: string[] };
}

const PADRAO: EnginesTts = { kokoro: { ok: true, vozes: ['pf_dora', 'pm_alex', 'pm_santa'] }, piper: { ok: true, vozes: ['pt_BR-faber-medium'] } };

function hash(s: string): number {
  let h = 0;
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return h;
}

/**
 * Voz do gateway (`engine:voz`) para uma pessoa, ou null quando nenhuma voz local serve
 * (o app então usa a voz do navegador). `chave` = id do treinador ou nome do personagem.
 */
export function vozDaPessoa(genero: Genero, chave: string, engines: EnginesTts = PADRAO): string | null {
  if (engines.chatterbox?.ok && engines.chatterbox.vozes?.includes(chave)) return `chatterbox:${chave}`;
  if (engines.kokoro?.ok) {
    if (genero === 'feminina') return 'kokoro:pf_dora';
    return hash(chave) % 2 ? 'kokoro:pm_santa' : 'kokoro:pm_alex';
  }
  const piper = engines.piper?.vozes ?? [];
  if (engines.piper?.ok && genero === 'masculina' && piper.length) return `piper:${piper.includes('pt_BR-faber-medium') ? 'pt_BR-faber-medium' : piper[0]}`;
  return null;
}

/** Voz pronta para a fila de fala: gateway quando há voz local adequada, senão navegador. */
export function escolherVoz(genero: Genero, chave: string, engines: EnginesTts | null): { gateway: string | null; genero: Genero } {
  return { gateway: engines ? vozDaPessoa(genero, chave, engines) : null, genero };
}
