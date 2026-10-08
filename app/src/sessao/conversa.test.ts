// Fase 2: streaming da fala, VAD, interrupção, pausa automática, métricas de voz e escolha de voz.
import { describe, expect, it } from 'vitest';
import { cenaPorId } from '../cenas/cenas';
import { motorFake } from '../motor/fake';
import type { Motor } from '../motor/tipos';
import type { Fala } from '../tipos';
import { DetectorFala } from '../voz/vad';
import { reamostrar, wav16 } from '../voz/microfone';
import { vozDaPessoa } from '../voz/vozes';
import { DivisorFrases, LeitorFala } from './fluxo';
import { metricas } from './metricas';
import { transcricao } from './prompts';
import { Sessao } from './sessao';

const cena = cenaPorId('feedback-atraso')!;

/** Motor que devolve um texto fixo em pedaços do tamanho pedido. */
function motorPedacos(textos: string[], tam = 5): Motor & { pedidos: number } {
  const m = {
    id: 'pedacos',
    rotulo: 'pedacos',
    externo: false,
    pedidos: 0,
    async *chat(_msgs: unknown, o: { signal?: AbortSignal } = {}) {
      const t = textos[Math.min(m.pedidos++, textos.length - 1)];
      for (let i = 0; i < t.length; i += tam) {
        if (o.signal?.aborted) return;
        yield t.slice(i, i + tam);
        await Promise.resolve();
      }
    },
  };
  return m;
}

const RESP = (fala: string, extra: Record<string, unknown> = {}) =>
  JSON.stringify({ fala, estado: { abertura: 5, paciencia: 6, confianca: 5 }, expressao: 'neutro', fim: false, resultado: null, ...extra });

describe('LeitorFala (JSON chegando aos pedaços)', () => {
  it('extrai a fala em qualquer corte de pedaço', () => {
    const json = RESP('Olha, eu entendo. Mas preciso de um prazo real.');
    for (const tam of [1, 2, 3, 7, 50]) {
      const l = new LeitorFala();
      let txt = '';
      for (let i = 0; i < json.length; i += tam) txt += l.adicionar(json.slice(i, i + tam));
      expect(txt, `pedaço ${tam}`).toBe('Olha, eu entendo. Mas preciso de um prazo real.');
      expect(l.completa).toBe(true);
    }
  });
  it('decodifica escapes, inclusive cortados no meio', () => {
    const json = JSON.stringify({ fala: 'Ele disse "não" \\ e saiu.\nTchau ✓' });
    const l = new LeitorFala();
    let txt = '';
    for (const c of json) txt += l.adicionar(c);
    expect(txt).toBe('Ele disse "não" \\ e saiu. Tchau ✓');
    const u = new LeitorFala();
    const ascii = '{"fala":"Ol\\u00e1, tudo bem?"}';
    let t2 = '';
    for (const c of ascii) t2 += u.adicionar(c);
    expect(t2).toBe('Olá, tudo bem?');
  });
  it('não entrega nada antes de achar o campo "fala"', () => {
    const l = new LeitorFala();
    expect(l.adicionar('{"estado": {"abertura": 3}, ')).toBe('');
    expect(l.adicionar('"fala": "Oi')).toBe('Oi');
  });
});

describe('DivisorFrases', () => {
  it('corta em fim de frase e devolve o resto no fechamento', () => {
    const d = new DivisorFrases();
    const saida = [...d.adicionar('Tá bom. Mas por quê? Eu '), ...d.adicionar('não entendi'), ...d.fechar()];
    expect(saida).toEqual(['Tá bom.', 'Mas por quê?', 'Eu não entendi']);
  });
  it('a primeira frase longa pode sair na vírgula; as outras não', () => {
    const d = new DivisorFrases(28);
    const a = d.adicionar('Olha, eu entendo o seu lado da história, mas ');
    expect(a).toEqual(['Olha, eu entendo o seu lado da história,']);
    expect(d.adicionar('o prazo é amanhã, e não dá, ')).toEqual([]);
    expect(d.fechar()).toEqual(['mas o prazo é amanhã, e não dá,']);
  });
  it('frase curta sem pontuação fica para o fechamento', () => {
    const d = new DivisorFrases();
    expect(d.adicionar('Oi, tudo')).toEqual([]);
    expect(d.fechar()).toEqual(['Oi, tudo']);
  });
});

describe('VAD por energia', () => {
  /** Roda o detector num roteiro de [rms, duração ms] em quadros de 20 ms. */
  const relogio = new WeakMap<DetectorFala, number>();
  function rodar(roteiro: [number, number][], d = new DetectorFala()) {
    const ev: [string, number][] = [];
    let t = relogio.get(d) ?? 0;
    for (const [rms, ms] of roteiro)
      for (let k = 0; k < ms; k += 20) {
        for (const e of d.quadro(rms, t)) ev.push([e, t]);
        t += 20;
      }
    relogio.set(d, t);
    return { ev, d };
  }
  it('fala → pausa curta (trecho) → retoma → silêncio (fim)', () => {
    const { ev, d } = rodar([
      [0.005, 400],
      [0.2, 600],
      [0.005, 400],
      [0.2, 500],
      [0.005, 900],
    ]);
    expect(ev.map((e) => e[0])).toEqual(['inicio', 'trecho', 'trecho', 'fim']);
    expect(d.pausas).toBe(1);
    const fim = ev.find((e) => e[0] === 'fim')![1];
    expect(fim - d.fimFala).toBeGreaterThanOrEqual(600);
    expect(fim - d.fimFala).toBeLessThan(640);
  });
  it('estalo curto não conta como fala', () => {
    const { ev } = rodar([
      [0.005, 300],
      [0.3, 60],
      [0.005, 1000],
    ]);
    expect(ev).toEqual([]);
  });
  it('ruído de fundo constante não dispara; limiar acompanha o ruído', () => {
    const { ev, d } = rodar([[0.03, 3000]]);
    expect(ev).toEqual([]);
    expect(d.limiar).toBeGreaterThan(0.03);
  });
  it('ruído que começa depois e nunca acaba é cortado no teto da fala', () => {
    const d = new DetectorFala({ falaMaximaMs: 2000 });
    const { ev } = rodar([
      [0.005, 600],
      [0.2, 5000],
    ], d);
    expect(ev.map((e) => e[0])).toEqual(['inicio', 'trecho', 'fim']);
    expect(rodar([[0.2, 2000]], d).ev).toEqual([]); // virou ruído de fundo
  });
  it('sensibilidade alta (personagem falando) ignora eco baixo', () => {
    const d = new DetectorFala();
    rodar([[0.01, 1000]], d);
    d.sensibilidade = 3;
    expect(rodar([[0.05, 600]], d).ev).toEqual([]);
    d.sensibilidade = 1;
    expect(rodar([[0.05, 600]], d).ev.map((e) => e[0])).toContain('inicio');
  });
});

describe('áudio do microfone', () => {
  it('reamostra 48 kHz → 16 kHz e gera WAV 16 bits', () => {
    const x = new Float32Array(48000).fill(0.5);
    const y = reamostrar(x, 48000);
    expect(y.length).toBe(16000);
    expect(y[100]).toBeCloseTo(0.5);
    const w = wav16(y);
    expect(w.size).toBe(44 + 32000);
  });
});

describe('Sessao em streaming', () => {
  it('cada frase sai antes do fim do JSON e a fala completa entra na transcrição', async () => {
    const s = new Sessao(cena, 'mulher', motorPedacos([RESP('Tá. Mas isso já aconteceu antes. O que muda agora?')], 4));
    s.comecar();
    const frases: string[] = [];
    const saida = await s.falarStream('Queria falar dos atrasos.', undefined, (f) => frases.push(f));
    expect(frases).toEqual(['Tá.', 'Mas isso já aconteceu antes.', 'O que muda agora?']);
    expect(saida?.fala).toBe('Tá. Mas isso já aconteceu antes. O que muda agora?');
    expect(s.atual.falas.at(-1)).toMatchObject({ quem: 'personagem', texto: saida?.fala });
  });
  it('interrupção no meio: guarda só o que foi dito, marcado como interrompido', async () => {
    const ctrl = new AbortController();
    const s = new Sessao(cena, 'mulher', motorPedacos([RESP('Primeira frase aqui. Segunda frase que não vai sair.')], 3));
    s.comecar();
    const saida = await s.falarStream('Oi', undefined, (f) => f.startsWith('Primeira') && ctrl.abort(), ctrl.signal);
    expect(saida).toBeNull();
    const ultima = s.atual.falas.at(-1)!;
    expect(ultima).toMatchObject({ quem: 'personagem', texto: 'Primeira frase aqui.', interrompida: true });
    expect(transcricao(s.atual.falas, 'Bruno')).toContain('[o USUÁRIO interrompeu esta fala]');
  });
  it('JSON inválido sem nenhuma frase: cai para uma tentativa normal', async () => {
    const m = motorPedacos(['isto não é json', RESP('Tudo bem, pode falar.')]);
    const s = new Sessao(cena, 'mulher', m);
    s.comecar();
    const frases: string[] = [];
    const saida = await s.falarStream('Oi', undefined, (f) => frases.push(f));
    expect(m.pedidos).toBe(2);
    expect(saida?.fala).toBe('Tudo bem, pode falar.');
    expect(frases.join(' ')).toBe('Tudo bem, pode falar.');
  });
  it('marcarInterrupcao marca a última fala do personagem já completa', async () => {
    const s = new Sessao(cena, 'mulher', motorFake());
    s.comecar();
    await s.falarStream('Oi, tudo bem?', undefined, () => {});
    const completa = s.atual.falas.at(-1)!.texto;
    s.marcarInterrupcao(completa.slice(0, 4));
    expect(s.atual.falas.at(-1)).toMatchObject({ interrompida: true, texto: `${completa.slice(0, 4)}…` });
    expect(metricas(s.atual.falas).interrupcoes).toBe(1);
  });
});

describe('pausa automática', () => {
  it('fala grosseira derruba a paciência e o treinador pausa', async () => {
    const s = new Sessao(cena, 'mulher', motorFake());
    s.comecar();
    await s.falarStream('Bom dia, queria conversar.', undefined, () => {});
    expect(s.alertaPausa()).toBeNull();
    await s.falarStream('Tanto faz, cala a boca.', undefined, () => {});
    expect(s.alertaPausa()).toMatch(/paciência/);
  });
  it('queda forte de conexão numa fala só também pausa', async () => {
    const alto = RESP('Legal!', { estado: { abertura: 9, paciencia: 9, confianca: 9 } });
    const baixo = RESP('Hum.', { estado: { abertura: 4, paciencia: 6, confianca: 4 } });
    const s = new Sessao(cena, 'mulher', motorPedacos([alto, baixo]));
    s.comecar();
    await s.falarStream('a', undefined, () => {});
    expect(s.alertaPausa()).toBeNull();
    await s.falarStream('b', undefined, () => {});
    expect(s.alertaPausa()).toMatch(/conexão caiu \d+ pontos/);
  });
  it('não pausa sozinho depois que a cena já acabou', async () => {
    const s = new Sessao(cena, 'mulher', motorPedacos([RESP('Chega.', { estado: { abertura: 1, paciencia: 1, confianca: 1 }, fim: true, resultado: 'fracasso' })]));
    s.comecar();
    await s.falarStream('x', undefined, () => {});
    expect(s.alertaPausa()).toBeNull();
  });
});

describe('métricas de voz (mãos-livres)', () => {
  it('tempo para responder, pausas e interrupções', () => {
    const falas: Fala[] = [
      { quem: 'personagem', texto: 'Oi.', interrompida: true },
      { quem: 'voce', texto: 'um dois três quatro', voz: { duracao_s: 2, pausas: 1, tempo_resposta_s: 0.8 } },
      { quem: 'personagem', texto: 'Certo.' },
      { quem: 'voce', texto: 'cinco seis', voz: { duracao_s: 1, pausas: 2, tempo_resposta_s: 1.6 } },
    ];
    const m = metricas(falas);
    expect(m.tempo_resposta_s).toBe(1.2);
    expect(m.pausas).toBe(3);
    expect(m.interrupcoes).toBe(1);
    expect(m.palavras_min).toBe(120);
  });
});

describe('vozes', () => {
  it('Kokoro dá voz feminina; sem Kokoro, feminina cai para o navegador', () => {
    expect(vozDaPessoa('feminina', 'executiva')).toBe('kokoro:pf_dora');
    expect(vozDaPessoa('masculina', 'executivo')).toMatch(/^kokoro:pm_/);
    const soPiper = { piper: { ok: true, vozes: ['pt_BR-faber-medium'] } };
    expect(vozDaPessoa('feminina', 'executiva', soPiper)).toBeNull();
    expect(vozDaPessoa('masculina', 'executivo', soPiper)).toBe('piper:pt_BR-faber-medium');
  });
  it('chatterbox só para quem tem WAV de referência', () => {
    const e = { kokoro: { ok: true }, chatterbox: { ok: true, vozes: ['executiva'] } };
    expect(vozDaPessoa('feminina', 'executiva', e)).toBe('chatterbox:executiva');
    expect(vozDaPessoa('feminina', 'linda', e)).toBe('kokoro:pf_dora');
  });
  it('a mesma pessoa tem sempre a mesma voz', () => {
    expect(vozDaPessoa('masculina', 'Bruno')).toBe(vozDaPessoa('masculina', 'Bruno'));
  });
});
