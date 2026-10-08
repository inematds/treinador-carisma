// Porta "Cérebro": todo motor de IA (local, nuvem, assinatura, fake) implementa isto.

export interface Msg {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface OpcoesChat {
  json?: boolean;
  temperatura?: number;
  /** liga o raciocínio do modelo quando o motor permite (Ollama think) */
  pensar?: boolean;
  signal?: AbortSignal;
}

export interface Motor {
  id: string;
  rotulo: string;
  /** true quando os dados saem do computador do usuário */
  externo: boolean;
  chat(msgs: Msg[], o?: OpcoesChat): AsyncIterable<string>;
}

export async function juntar(it: AsyncIterable<string>): Promise<string> {
  let s = '';
  for await (const c of it) s += c;
  return s;
}

/** Lê um corpo de resposta em streaming como texto. */
export async function* lerTexto(r: Response): AsyncIterable<string> {
  if (!r.body) {
    yield await r.text();
    return;
  }
  const leitor = r.body.getReader();
  const dec = new TextDecoder();
  for (;;) {
    const { value, done } = await leitor.read();
    if (done) break;
    yield dec.decode(value, { stream: true });
  }
}

/** Lê linhas (NDJSON ou SSE) de um corpo em streaming. */
export async function* lerLinhas(r: Response): AsyncIterable<string> {
  let resto = '';
  for await (const pedaco of lerTexto(r)) {
    resto += pedaco;
    const linhas = resto.split('\n');
    resto = linhas.pop() ?? '';
    for (const l of linhas) if (l.trim()) yield l.trim();
  }
  if (resto.trim()) yield resto.trim();
}

export async function erroHttp(r: Response, quem: string): Promise<Error> {
  let det = '';
  try {
    det = (await r.text()).slice(0, 300);
  } catch {
    /* sem corpo */
  }
  return new Error(`${quem}: HTTP ${r.status} ${det}`);
}
