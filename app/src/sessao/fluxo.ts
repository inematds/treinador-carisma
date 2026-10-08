// Streaming da resposta do personagem: lê o campo "fala" de um JSON que ainda está chegando
// e corta o texto em frases para a voz começar antes do modelo terminar.

/** Extrai, aos pedaços, o valor da string "fala" de um objeto JSON incompleto. */
export class LeitorFala {
  private buf = '';
  private entregue = 0;
  completa = false;

  /** Acrescenta um pedaço do JSON e devolve o texto novo da fala (decodificado). */
  adicionar(pedaco: string): string {
    this.buf += pedaco;
    if (this.completa) return '';
    const ini = this.buf.match(/"fala"\s*:\s*"/);
    if (!ini || ini.index === undefined) return '';
    let i = ini.index + ini[0].length;
    let texto = '';
    while (i < this.buf.length) {
      const c = this.buf[i];
      if (c === '"') {
        this.completa = true;
        break;
      }
      if (c === '\\') {
        const prox = this.buf[i + 1];
        if (prox === undefined) break; // escape cortado: espera o próximo pedaço
        if (prox === 'u') {
          const hex = this.buf.slice(i + 2, i + 6);
          if (hex.length < 4) break;
          texto += String.fromCharCode(parseInt(hex, 16));
          i += 6;
          continue;
        }
        texto += ({ n: ' ', t: ' ', r: '', b: '', f: '' } as Record<string, string>)[prox] ?? prox;
        i += 2;
        continue;
      }
      texto += c;
      i++;
    }
    const novo = texto.slice(this.entregue);
    this.entregue = texto.length;
    return novo;
  }

  get json(): string {
    return this.buf;
  }
}

/**
 * Junta texto e devolve frases prontas para falar. A primeira pode sair numa vírgula
 * (a partir de `minPrimeira` caracteres) para a voz começar mais cedo.
 */
export class DivisorFrases {
  private resto = '';
  private saidas = 0;

  constructor(private minPrimeira = 28) {}

  adicionar(texto: string): string[] {
    this.resto += texto;
    const frases: string[] = [];
    for (;;) {
      const fim = this.resto.match(/[.!?…]+["')\]]?\s+/);
      let corte = fim && fim.index !== undefined ? fim.index + fim[0].length : -1;
      if (corte < 0 && this.saidas === 0 && this.resto.length >= this.minPrimeira) {
        const v = this.resto.slice(this.minPrimeira - 10).search(/[,;:]\s/);
        if (v >= 0) corte = this.minPrimeira - 10 + v + 2;
      }
      if (corte < 0) break;
      const f = this.resto.slice(0, corte).trim();
      this.resto = this.resto.slice(corte);
      if (f) {
        frases.push(f);
        this.saidas++;
      }
    }
    return frases;
  }

  /** O que sobrou quando o texto acabou. */
  fechar(): string[] {
    const f = this.resto.trim();
    this.resto = '';
    if (f) this.saidas++;
    return f ? [f] : [];
  }
}
