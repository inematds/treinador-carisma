// Adaptadores de IA. Edição Local: gateway (ollama | codex | claude | gemini).
// Edição Nuvem: ollama direto, OpenAI/OpenRouter (chave ou OAuth), Anthropic, WebLLM.
import { type Motor, type Msg, type OpcoesChat, lerLinhas, lerTexto, erroHttp } from './tipos';

/** Edição Local: o gateway na mesma origem decide o motor real. */
export function motorGateway(motor: string, modelo?: string, base = ''): Motor {
  const rotulos: Record<string, string> = {
    ollama: `Ollama neste PC${modelo ? ` (${modelo})` : ''}`,
    codex: 'Codex (sua assinatura ChatGPT)',
    claude: 'Claude (sua assinatura)',
    gemini: 'Gemini (sua conta Google)',
  };
  return {
    id: `gateway:${motor}`,
    rotulo: rotulos[motor] ?? motor,
    externo: motor !== 'ollama',
    async *chat(msgs: Msg[], o: OpcoesChat = {}) {
      const r = await fetch(base ? `${base}/api/chat` : 'api/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ motor, modelo, mensagens: msgs, json: !!o.json, temperatura: o.temperatura ?? 0.7 }),
        signal: o.signal,
      });
      if (!r.ok) throw await erroHttp(r, rotulos[motor] ?? motor);
      yield* lerTexto(r);
    },
  };
}

/** Navegador → Ollama do próprio PC (precisa de OLLAMA_ORIGINS liberando a origem da página). */
export function motorOllamaDireto(url: string, modelo: string): Motor {
  const base = url.replace(/\/$/, '');
  return {
    id: 'ollama-direto',
    rotulo: `Ollama em ${base} (${modelo})`,
    externo: false,
    async *chat(msgs, o = {}) {
      const r = await fetch(base ? `${base}/api/chat` : 'api/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          model: modelo,
          messages: msgs,
          stream: true,
          think: false,
          ...(o.json ? { format: 'json' } : {}),
          options: { temperature: o.temperatura ?? 0.7 },
        }),
        signal: o.signal,
      });
      if (!r.ok) throw await erroHttp(r, 'Ollama');
      for await (const l of lerLinhas(r)) {
        const d = JSON.parse(l);
        if (d.error) throw new Error(`Ollama: ${d.error}`);
        if (d.message?.content) yield d.message.content as string;
      }
    },
  };
}

export async function modelosOllama(url: string): Promise<string[]> {
  const r = await fetch(`${url.replace(/\/$/, '')}/api/tags`, { signal: AbortSignal.timeout(2500) });
  if (!r.ok) throw new Error(`Ollama: HTTP ${r.status}`);
  const d = await r.json();
  return (d.models ?? []).map((m: { name: string }) => m.name);
}

/** API compatível com OpenAI (OpenAI, OpenRouter, outros). Chave fica só no navegador. */
export function motorCompativelOpenAI(o: { id: string; rotulo: string; url: string; chave: string; modelo: string; extras?: Record<string, string> }): Motor {
  return {
    id: o.id,
    rotulo: `${o.rotulo} (${o.modelo})`,
    externo: true,
    async *chat(msgs, op = {}) {
      const r = await fetch(`${o.url.replace(/\/$/, '')}/chat/completions`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${o.chave}`, ...(o.extras ?? {}) },
        body: JSON.stringify({
          model: o.modelo,
          messages: msgs,
          stream: true,
          temperature: op.temperatura ?? 0.7,
          ...(op.json ? { response_format: { type: 'json_object' } } : {}),
        }),
        signal: op.signal,
      });
      if (!r.ok) throw await erroHttp(r, o.rotulo);
      for await (const l of lerLinhas(r)) {
        if (!l.startsWith('data:')) continue;
        const dado = l.slice(5).trim();
        if (dado === '[DONE]') return;
        const d = JSON.parse(dado);
        const t = d.choices?.[0]?.delta?.content;
        if (t) yield t as string;
      }
    },
  };
}

/** Anthropic direto do navegador (chave do usuário). */
export function motorAnthropic(chave: string, modelo: string): Motor {
  return {
    id: 'anthropic',
    rotulo: `Anthropic (${modelo})`,
    externo: true,
    async *chat(msgs, o = {}) {
      const sistema = msgs.filter((m) => m.role === 'system').map((m) => m.content).join('\n\n');
      const resto = msgs.filter((m) => m.role !== 'system');
      const r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': chave,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model: modelo,
          max_tokens: 1200,
          system: sistema + (o.json ? '\n\nResponda SOMENTE com um objeto JSON válido.' : ''),
          messages: resto,
          temperature: o.temperatura ?? 0.7,
          stream: true,
        }),
        signal: o.signal,
      });
      if (!r.ok) throw await erroHttp(r, 'Anthropic');
      for await (const l of lerLinhas(r)) {
        if (!l.startsWith('data:')) continue;
        const d = JSON.parse(l.slice(5).trim());
        if (d.type === 'content_block_delta' && d.delta?.text) yield d.delta.text as string;
      }
    },
  };
}

// ---------- OpenRouter OAuth (PKCE): o usuário entra com a conta dele e usa os próprios créditos.

function b64url(buf: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export async function iniciarLoginOpenRouter(): Promise<void> {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const verificador = b64url(bytes.buffer);
  const desafio = b64url(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verificador)));
  sessionStorage.setItem('tc-or-verificador', verificador);
  const volta = location.origin + location.pathname;
  location.href = `https://openrouter.ai/auth?callback_url=${encodeURIComponent(volta)}&code_challenge=${desafio}&code_challenge_method=S256`;
}

/** Se a página voltou do OpenRouter com ?code=, troca pelo token. Retorna a chave ou null. */
export async function concluirLoginOpenRouter(): Promise<string | null> {
  const p = new URLSearchParams(location.search);
  const code = p.get('code');
  const verificador = sessionStorage.getItem('tc-or-verificador');
  if (!code || !verificador) return null;
  const r = await fetch('https://openrouter.ai/api/v1/auth/keys', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ code, code_verifier: verificador, code_challenge_method: 'S256' }),
  });
  sessionStorage.removeItem('tc-or-verificador');
  history.replaceState(null, '', location.pathname);
  if (!r.ok) throw await erroHttp(r, 'OpenRouter login');
  const d = await r.json();
  return d.key ?? null;
}

// ---------- WebLLM: modelo pequeno rodando no próprio navegador (WebGPU), sem API e sem instalar nada.

export const WEBLLM_CDN = 'https://cdn.jsdelivr.net/npm/@mlc-ai/web-llm@0.2.79/+esm';
export const WEBLLM_MODELOS = ['Qwen2.5-3B-Instruct-q4f16_1-MLC', 'Llama-3.2-3B-Instruct-q4f16_1-MLC', 'Qwen2.5-1.5B-Instruct-q4f16_1-MLC'];

type MotorWebLLM = {
  chat: { completions: { create(p: unknown): Promise<AsyncIterable<{ choices: { delta?: { content?: string } }[] }>> } };
};
let webllmCache: { modelo: string; motor: Promise<MotorWebLLM> } | null = null;

export function motorWebLLM(modelo: string, progresso?: (txt: string) => void): Motor {
  const carregar = () => {
    if (webllmCache?.modelo === modelo) return webllmCache.motor;
    const motor = (async () => {
      if (!('gpu' in navigator)) throw new Error('Este navegador não tem WebGPU. Use Chrome/Edge recentes ou outro motor.');
      const lib = await import(/* @vite-ignore */ WEBLLM_CDN);
      return (await lib.CreateMLCEngine(modelo, {
        initProgressCallback: (r: { text: string }) => progresso?.(r.text),
      })) as MotorWebLLM;
    })();
    webllmCache = { modelo, motor };
    return motor;
  };
  return {
    id: 'webllm',
    rotulo: `No navegador (${modelo.split('-q4')[0]})`,
    externo: false,
    async *chat(msgs, o = {}) {
      const m = await carregar();
      const fluxo = await m.chat.completions.create({
        messages: msgs,
        stream: true,
        temperature: o.temperatura ?? 0.7,
        ...(o.json ? { response_format: { type: 'json_object' } } : {}),
      });
      for await (const c of fluxo) {
        const t = c.choices[0]?.delta?.content;
        if (t) yield t;
      }
    },
  };
}
