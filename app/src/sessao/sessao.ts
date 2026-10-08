// Máquina de estados de uma cena: briefing → cena → avaliando → correção → (refazer) …
import { juntar, type Motor } from '../motor/tipos';
import type { Alvo, Avaliacao, Cena, EstadoPersonagem, Fala, SaidaPersonagem, Tentativa } from '../tipos';
import { DivisorFrases, LeitorFala } from './fluxo';
import { identidade, msgsAvaliador, msgsPersonagem } from './prompts';
import { conexao, expressaoDoEstado, extrairJson, validarAvaliacao, validarPersonagem } from './validar';

export type Fase = 'briefing' | 'cena' | 'avaliando' | 'correcao';

/** Chama o motor pedindo JSON; 1 nova tentativa com o erro; senão lança. */
export async function pedirJson<T>(motor: Motor, msgs: Parameters<Motor['chat']>[0], validar: (b: unknown) => T, temperatura: number, pensar = false): Promise<T> {
  let erro = '';
  for (let i = 0; i < 2; i++) {
    const extra = erro
      ? [{ role: 'user' as const, content: `Sua resposta anterior foi inválida (${erro}). Responda de novo SOMENTE com o objeto JSON pedido.` }]
      : [];
    const texto = await juntar(motor.chat([...msgs, ...extra], { json: true, temperatura, pensar }));
    try {
      return validar(extrairJson(texto));
    } catch (e) {
      erro = (e as Error).message;
    }
  }
  throw new Error(`resposta inválida do modelo: ${erro}`);
}

export interface Comparacao {
  id: string;
  antes: number | null;
  agora: number | null;
}

export class Sessao {
  fase: Fase = 'briefing';
  tentativas: Tentativa[] = [];
  estado: EstadoPersonagem;
  /** estado antes da última resposta (para a pausa automática ver a queda) */
  anterior: EstadoPersonagem;
  erro: string | null = null;

  constructor(
    readonly cena: Cena,
    readonly alvo: Alvo,
    public motor: Motor,
  ) {
    this.estado = { ...cena.personagem.estado_inicial };
    this.anterior = this.estado;
    this.novaTentativa();
  }

  get id() {
    return identidade(this.cena, this.alvo);
  }
  get atual(): Tentativa {
    return this.tentativas[this.tentativas.length - 1];
  }
  get falasUsuario(): number {
    return this.atual.falas.filter((f) => f.quem === 'voce').length;
  }
  get acabou(): boolean {
    return this.atual.resultado !== null || this.falasUsuario >= this.cena.fim.max_falas;
  }

  private novaTentativa() {
    this.estado = { ...this.cena.personagem.estado_inicial };
    this.anterior = this.estado;
    const falas: Fala[] = [];
    const abertura = this.cena.abertura_personagem?.trim();
    if (abertura) falas.push({ quem: 'personagem', texto: abertura, estado: { ...this.estado }, expressao: expressaoDoEstado(this.estado) });
    this.tentativas.push({ n: this.tentativas.length + 1, inicio: Date.now(), falas, resultado: null, avaliacao: null });
  }

  /** Sai do briefing e começa a cena. */
  comecar() {
    this.fase = 'cena';
  }

  /** O usuário fala; o personagem responde. */
  async falar(texto: string, voz?: Fala['voz']): Promise<SaidaPersonagem> {
    this.registrarUsuario(texto, voz);
    const saida = await pedirJson(
      this.motor,
      msgsPersonagem(this.cena, this.alvo, this.atual.falas, this.estado),
      (b) => validarPersonagem(b, this.estado),
      0.8,
    );
    return this.registrarPersonagem(saida);
  }

  /**
   * Como `falar`, mas em streaming: cada frase da resposta sai por `aoFrase` assim que fica pronta
   * (a voz começa antes do modelo terminar). Se `signal` abortar (você interrompeu), guarda o que
   * já tinha saído como fala interrompida e devolve null.
   */
  async falarStream(texto: string, voz: Fala['voz'] | undefined, aoFrase: (f: string) => void, signal?: AbortSignal): Promise<SaidaPersonagem | null> {
    this.registrarUsuario(texto, voz);
    const msgs = msgsPersonagem(this.cena, this.alvo, this.atual.falas, this.estado);
    const leitor = new LeitorFala();
    const div = new DivisorFrases();
    let dito = '';
    const emitir = (fs: string[]) =>
      fs.forEach((f) => {
        dito += (dito ? ' ' : '') + f;
        aoFrase(f);
      });
    try {
      for await (const pedaco of this.motor.chat(msgs, { json: true, temperatura: 0.8, signal })) {
        if (signal?.aborted) break;
        emitir(div.adicionar(leitor.adicionar(pedaco)));
      }
    } catch (e) {
      if (!signal?.aborted) {
        if (dito) return this.registrarPersonagem(this.saidaParcial(dito));
        this.atual.falas.pop();
        throw e;
      }
    }
    if (signal?.aborted) {
      if (dito) {
        this.atual.falas.push({ quem: 'personagem', texto: dito, estado: { ...this.estado }, expressao: expressaoDoEstado(this.estado), interrompida: true });
      }
      return null;
    }
    emitir(div.fechar());
    let saida: SaidaPersonagem;
    try {
      saida = validarPersonagem(extrairJson(leitor.json), this.estado);
      if (dito) saida.fala = dito; // o que foi dito em voz é o que vale na transcrição
    } catch {
      if (dito) saida = this.saidaParcial(dito);
      else {
        // JSON inválido antes de qualquer frase: uma tentativa normal (sem streaming)
        saida = await pedirJson(this.motor, msgs, (b) => validarPersonagem(b, this.estado), 0.8);
        const d = new DivisorFrases();
        emitir([...d.adicionar(saida.fala + ' '), ...d.fechar()]);
      }
    }
    return this.registrarPersonagem(saida);
  }

  private saidaParcial(fala: string): SaidaPersonagem {
    return { fala, estado: { ...this.estado }, expressao: expressaoDoEstado(this.estado), fim: false, resultado: null };
  }

  private registrarUsuario(texto: string, voz?: Fala['voz']) {
    if (this.fase !== 'cena') throw new Error('a cena não está em andamento');
    const t = texto.trim();
    if (!t) throw new Error('fala vazia');
    this.atual.falas.push({ quem: 'voce', texto: t, voz });
  }

  private registrarPersonagem(saida: SaidaPersonagem): SaidaPersonagem {
    if (this.falasUsuario >= this.cena.fim.max_falas && !saida.fim) {
      saida.fim = true;
      saida.resultado = 'neutro';
    }
    this.anterior = this.estado;
    this.estado = saida.estado;
    this.atual.falas.push({ quem: 'personagem', texto: saida.fala, estado: { ...saida.estado }, expressao: saida.expressao });
    if (saida.fim) this.atual.resultado = saida.resultado ?? 'neutro';
    return saida;
  }

  /**
   * Você começou a falar enquanto o personagem falava: marca a última fala dele como interrompida
   * e, se souber, guarda só o que chegou a ser dito (é isso que ele "lembra" ter falado).
   */
  marcarInterrupcao(dito?: string) {
    const ultima = this.atual.falas[this.atual.falas.length - 1];
    if (ultima?.quem !== 'personagem') return;
    ultima.interrompida = true;
    const d = dito?.trim();
    if (d && d.length < ultima.texto.length) ultima.texto = `${d}…`;
  }

  /**
   * Pausa automática: o treinador entra quando a conversa está desandando
   * (paciência no fim ou conexão caindo forte numa fala só). Devolve o motivo ou null.
   */
  alertaPausa(): string | null {
    if (this.fase !== 'cena' || this.atual.resultado !== null) return null;
    if (this.estado.paciencia <= 2) return 'a paciência está acabando';
    const queda = conexao(this.anterior) - conexao(this.estado);
    if (queda >= 20) return `a conexão caiu ${queda} pontos nessa fala`;
    return null;
  }

  /** Pausa (a pedido ou no fim) e chama o avaliador. */
  async avaliar(): Promise<Avaliacao | null> {
    if (this.falasUsuario === 0) throw new Error('fale pelo menos uma vez antes de pausar');
    this.fase = 'avaliando';
    this.erro = null;
    try {
      const a = await pedirJson(this.motor, msgsAvaliador(this.cena, this.alvo, this.atual.falas), (b) => validarAvaliacao(b, this.cena), 0.2);
      this.atual.avaliacao = a;
      return a;
    } catch (e) {
      this.erro = `Sem avaliação desta vez: ${(e as Error).message}`;
      this.atual.avaliacao = null;
      return null;
    } finally {
      this.fase = 'correcao';
    }
  }

  /** Mesma cena, personagem no estado inicial. */
  refazer() {
    this.novaTentativa();
    this.fase = 'cena';
  }

  /** Notas da tentativa avaliada anterior × a atual. */
  comparacao(): Comparacao[] {
    const avaliadas = this.tentativas.filter((t) => t.avaliacao);
    if (avaliadas.length < 2) return [];
    const [a, b] = avaliadas.slice(-2).map((t) => t.avaliacao!);
    return this.cena.criterios.map((c) => ({ id: c.id, antes: a.notas[c.id] ?? null, agora: b.notas[c.id] ?? null }));
  }

  /** Texto que o treinador fala na pausa (sem chamada extra ao modelo). */
  falaDaCorrecao(nomeTreinador: string): string {
    const a = this.atual.avaliacao;
    if (!a) return `Pausa. ${this.erro ?? 'Não consegui avaliar agora.'} Quer tentar de novo?`;
    const cmp = this.comparacao();
    const melhor = cmp.filter((c) => c.antes !== null && c.agora !== null).sort((x, y) => y.agora! - y.antes! - (x.agora! - x.antes!))[0];
    const evolucao =
      melhor && melhor.agora! > melhor.antes!
        ? ` Você subiu de ${melhor.antes} para ${melhor.agora} em ${this.cena.criterios.find((c) => c.id === melhor.id)?.nome.toLowerCase()}.`
        : '';
    return `Pausa. ${a.ponto_forte}${evolucao} Agora, uma coisa só: ${a.correcao_unica}`.replace(/\s+/g, ' ').trim() + ` — ${nomeTreinador}`;
  }
}
