// Configuração do motor e da voz (preferência deste navegador) + detecção da edição.
import { motorFake } from './motor/fake';
import { motorAnthropic, motorCompativelOpenAI, motorGateway, motorOllamaDireto, motorWebLLM } from './motor/motores';
import type { Motor } from './motor/tipos';
import type { Alvo, Modo, Treinador } from './tipos';

export type TipoMotor = 'gateway' | 'ollama-direto' | 'openai' | 'anthropic' | 'openrouter' | 'webllm' | 'fake';

export interface Config {
  tipo: TipoMotor;
  gatewayMotor: 'ollama' | 'codex' | 'claude' | 'gemini';
  modelo: string;
  ollamaUrl: string;
  chaves: { openai: string; anthropic: string; openrouter: string };
  modelos: { openai: string; anthropic: string; openrouter: string; webllm: string };
  vozAuto: boolean;
  modo: Modo;
  treinador: Treinador['id'];
  alvo: Alvo;
  iniciado: boolean;
}

export const PADRAO: Config = {
  tipo: 'fake',
  gatewayMotor: 'ollama',
  modelo: '',
  ollamaUrl: 'http://localhost:11434',
  chaves: { openai: '', anthropic: '', openrouter: '' },
  modelos: { openai: 'gpt-5-mini', anthropic: 'claude-haiku-5-5', openrouter: 'openai/gpt-5-mini', webllm: 'Qwen2.5-3B-Instruct-q4f16_1-MLC' },
  vozAuto: true,
  modo: 'carisma',
  treinador: 'executiva',
  alvo: 'mulher',
  iniciado: false,
};

const CHAVE = 'tc-config-v1';

export function lerConfig(): Config {
  try {
    const salvo = JSON.parse(localStorage.getItem(CHAVE) ?? 'null');
    if (salvo) return { ...PADRAO, ...salvo, chaves: { ...PADRAO.chaves, ...salvo.chaves }, modelos: { ...PADRAO.modelos, ...salvo.modelos } };
  } catch {
    /* sem armazenamento */
  }
  return { ...PADRAO };
}

export function salvarConfig(c: Config) {
  try {
    localStorage.setItem(CHAVE, JSON.stringify(c));
  } catch {
    /* sem armazenamento */
  }
}

export interface Saude {
  ok: boolean;
  versao?: string;
  edicao?: string;
  motores?: Record<string, { ok: boolean; modelos?: string[] }>;
  stt?: { ok: boolean; engine?: string };
  tts?: { ok: boolean; engine?: string; vozes?: string[] };
}

/** Edição Local = existe gateway na mesma origem. */
export async function detectarGateway(): Promise<Saude | null> {
  try {
    const r = await fetch('api/health', { signal: AbortSignal.timeout(3500) });
    if (!r.ok) return null;
    const d = (await r.json()) as Saude;
    return d.ok ? d : null;
  } catch {
    return null;
  }
}

export function criarMotor(c: Config, progresso?: (t: string) => void): Motor {
  switch (c.tipo) {
    case 'gateway':
      return motorGateway(c.gatewayMotor, c.modelo || undefined);
    case 'ollama-direto':
      return motorOllamaDireto(c.ollamaUrl, c.modelo || 'llama3.2');
    case 'openai':
      return motorCompativelOpenAI({ id: 'openai', rotulo: 'OpenAI', url: 'https://api.openai.com/v1', chave: c.chaves.openai, modelo: c.modelos.openai });
    case 'openrouter':
      return motorCompativelOpenAI({
        id: 'openrouter',
        rotulo: 'OpenRouter',
        url: 'https://openrouter.ai/api/v1',
        chave: c.chaves.openrouter,
        modelo: c.modelos.openrouter,
        extras: { 'X-Title': 'Treinador de Carisma' },
      });
    case 'anthropic':
      return motorAnthropic(c.chaves.anthropic, c.modelos.anthropic);
    case 'webllm':
      return motorWebLLM(c.modelos.webllm, progresso);
    default:
      return motorFake(new URLSearchParams(location.search).get('motor') === 'fake' ? 0 : 500);
  }
}

/** Motor escolhido está pronto para uso? (tem chave, modelo etc.) */
export function motorPronto(c: Config): string | null {
  if (c.tipo === 'openai' && !c.chaves.openai) return 'Cole sua chave da OpenAI.';
  if (c.tipo === 'anthropic' && !c.chaves.anthropic) return 'Cole sua chave da Anthropic.';
  if (c.tipo === 'openrouter' && !c.chaves.openrouter) return 'Entre com sua conta OpenRouter ou cole uma chave.';
  if (c.tipo === 'ollama-direto' && !c.modelo) return 'Escolha um modelo do Ollama.';
  return null;
}
