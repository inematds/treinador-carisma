import { describe, expect, it } from 'vitest';
import { CENAS, cenaPorId } from '../cenas/cenas';
import { motorFake } from '../motor/fake';
import type { Motor } from '../motor/tipos';
import type { Cena } from '../tipos';
import { metricas, contarVicios, perguntas } from './metricas';
import { cenaProposta, identidade, msgsAvaliador, msgsPersonagem, msgsTreinador, preencher } from './prompts';
import { Sessao, pedirJson } from './sessao';
import { conexao, expressaoDoEstado, extrairJson, validarAvaliacao, validarPersonagem } from './validar';
import { TREINADORES } from '../treinadores';

const cena = cenaPorId('feedback-atraso')!;
const conquista = CENAS.find((c) => c.modo === 'conquista')!;

function motorRoteiro(respostas: string[]): Motor & { pedidos: number } {
  const m = {
    id: 'roteiro',
    rotulo: 'roteiro',
    externo: false,
    pedidos: 0,
    async *chat() {
      yield respostas[Math.min(m.pedidos++, respostas.length - 1)];
    },
  };
  return m;
}

describe('cenas', () => {
  it('carrega as 16 cenas (10 carisma + 6 conquista)', () => {
    expect(CENAS).toHaveLength(16);
    expect(CENAS.filter((c) => c.modo === 'carisma')).toHaveLength(10);
    expect(CENAS.filter((c) => c.modo === 'conquista')).toHaveLength(6);
  });
  it('toda cena tem critérios e calibração', () => {
    for (const c of CENAS) {
      expect(c.criterios.length).toBeGreaterThanOrEqual(3);
      expect(c.calibracao.nota_3).toBeTruthy();
      expect(c.calibracao.nota_8).toBeTruthy();
    }
  });
  it('conquista usa a variante escolhida', () => {
    expect(identidade(conquista, 'mulher').voz).toBe('feminina');
    expect(identidade(conquista, 'homem').voz).toBe('masculina');
    expect(identidade(conquista, 'mulher').nome).not.toBe(identidade(conquista, 'homem').nome);
  });
});

describe('prompts', () => {
  it('preenche variáveis', () => {
    expect(preencher('oi {{a}} e {{b}}', { a: '1' })).toBe('oi 1 e ');
  });
  it('personagem leva cena, estado e transcrição numerada', () => {
    const msgs = msgsPersonagem(cena, 'mulher', [{ quem: 'voce', texto: 'Oi Marcos' }], cena.personagem.estado_inicial);
    expect(msgs[0].content).toMatch(/^PAPEL: personagem/);
    expect(msgs[0].content).toContain(cena.contexto);
    expect(msgs[1].content).toContain('fala 1 (USUÁRIO): Oi Marcos');
    expect(msgs[1].content).toContain('"abertura"');
  });
  it('avaliador lista ids dos critérios e a calibração', () => {
    const msgs = msgsAvaliador(cena, 'mulher', [{ quem: 'voce', texto: 'x' }]);
    expect(msgs[0].content).toContain(`CRITERIOS_IDS: ${cena.criterios.map((c) => c.id).join(',')}`);
    expect(msgs[0].content).toContain(cena.calibracao.nota_8);
  });
  it('avaliador do modo conquista leva a regra de pressão', () => {
    expect(msgsAvaliador(conquista, 'homem', [])[0].content).toMatch(/insistir depois de sinal negativo/);
    expect(msgsAvaliador(cena, 'homem', [])[0].content).not.toMatch(/Modo conquista/);
  });
  it('treinador só vê cenas do próprio modo e nunca interpreta', () => {
    const t = TREINADORES.find((x) => x.modo === 'conquista')!;
    const s = msgsTreinador(t, CENAS, '', [])[0].content;
    expect(s).toContain(conquista.id);
    expect(s).not.toContain('feedback-atraso');
    expect(s).toMatch(/NÃO interpreta personagens/);
  });
  it('extrai cena proposta pelo treinador', () => {
    expect(cenaProposta('Vamos lá.\n[[cena:dizer-nao]]')).toEqual({ limpo: 'Vamos lá.', cena: 'dizer-nao' });
    expect(cenaProposta('Sem cena').cena).toBeNull();
  });
});

describe('validação', () => {
  it('extrai JSON de cerca de código e texto em volta', () => {
    expect(extrairJson('aqui:\n```json\n{"a":1}\n```')).toEqual({ a: 1 });
    expect(extrairJson('blá {"a":{"b":2}} fim')).toEqual({ a: { b: 2 } });
    expect(() => extrairJson('sem json')).toThrow();
  });
  it('personagem: limita estado 0-10 e deduz expressão', () => {
    const s = validarPersonagem({ fala: 'oi', estado: { abertura: 14, paciencia: -3, confianca: 'x' } }, { abertura: 5, paciencia: 5, confianca: 5 });
    expect(s.estado).toEqual({ abertura: 10, paciencia: 0, confianca: 5 });
    expect(s.expressao).toBe('irritado');
    expect(s.fim).toBe(false);
  });
  it('personagem: fala vazia é inválida', () => {
    expect(() => validarPersonagem({ fala: '  ' }, cena.personagem.estado_inicial)).toThrow();
  });
  it('avaliador: recalcula média ponderada e ignora nota_geral do modelo', () => {
    const notas = Object.fromEntries(cena.criterios.map((c) => [c.id, 6]));
    const evid = Object.fromEntries(cena.criterios.map((c) => [c.id, "fala 1: 'x'"]));
    const a = validarAvaliacao({ notas, evidencias: evid, nota_geral: 10, correcao_unica: 'Faça X.', ponto_forte: 'Y' }, cena);
    expect(a.nota_geral).toBe(6);
  });
  it('avaliador: nota alta sem evidência é descartada', () => {
    const [c1, ...resto] = cena.criterios;
    const notas = { [c1.id]: 9, ...Object.fromEntries(resto.map((c) => [c.id, 4])) };
    const evid = Object.fromEntries(resto.map((c) => [c.id, "fala 1: 'y'"]));
    const a = validarAvaliacao({ notas, evidencias: evid, correcao_unica: 'Faça X.' }, cena);
    expect(a.descartados).toEqual([c1.id]);
    expect(a.notas[c1.id]).toBeUndefined();
    expect(a.nota_geral).toBe(4);
  });
  it('avaliador: critério faltando é inválido', () => {
    expect(() => validarAvaliacao({ notas: {}, evidencias: {}, correcao_unica: 'x' }, cena)).toThrow(/sem nota/);
  });
  it('avaliador: sem correção é inválido', () => {
    const notas = Object.fromEntries(cena.criterios.map((c) => [c.id, 3]));
    expect(() => validarAvaliacao({ notas, evidencias: {} }, cena)).toThrow(/correcao_unica/);
  });
  it('conexão e expressão acompanham o estado', () => {
    expect(conexao({ abertura: 10, paciencia: 10, confianca: 10 })).toBe(100);
    expect(expressaoDoEstado({ abertura: 9, paciencia: 8, confianca: 9 })).toBe('sorrindo');
    expect(expressaoDoEstado({ abertura: 2, paciencia: 6, confianca: 3 })).toBe('fechado');
  });
});

describe('pedirJson', () => {
  it('tenta de novo uma vez quando o JSON vem quebrado', async () => {
    const m = motorRoteiro(['não é json', '{"fala":"oi"}']);
    const r = await pedirJson(m, [], (b) => validarPersonagem(b, cena.personagem.estado_inicial), 0.5);
    expect(r.fala).toBe('oi');
    expect(m.pedidos).toBe(2);
  });
  it('desiste depois de duas respostas inválidas', async () => {
    const m = motorRoteiro(['x', 'y', '{"fala":"tarde demais"}']);
    await expect(pedirJson(m, [], (b) => validarPersonagem(b, cena.personagem.estado_inicial), 0.5)).rejects.toThrow(/inválida/);
    expect(m.pedidos).toBe(2);
  });
});

describe('Sessao (motor fake)', () => {
  it('ciclo completo: briefing → cena → fim → avaliação → refazer → comparação', async () => {
    const s = new Sessao(cena, 'mulher', motorFake());
    expect(s.fase).toBe('briefing');
    await expect(s.falar('oi')).rejects.toThrow();
    s.comecar();
    await s.falar('Marcos, tudo bem?');
    await s.falar('Queria falar das reuniões.');
    const r = await s.falar('Vamos combinar um horário?');
    expect(r.fim).toBe(true);
    expect(s.atual.resultado).toBe('sucesso');
    const a1 = await s.avaliar();
    expect(a1).not.toBeNull();
    expect(s.fase).toBe('correcao');
    expect(s.falaDaCorrecao('Marina')).toContain('Abra com um fato concreto');

    s.refazer();
    expect(s.atual.n).toBe(2);
    expect(s.estado).toEqual(cena.personagem.estado_inicial);
    await s.falar('Marcos, nas três últimas reuniões você chegou depois das 9h15 e a gente repetiu a pauta.');
    const a2 = await s.avaliar();
    expect(a2!.nota_geral).toBeGreaterThan(a1!.nota_geral);
    const cmp = s.comparacao();
    expect(cmp.length).toBe(cena.criterios.length);
    expect(cmp.every((c) => c.agora! > c.antes!)).toBe(true);
    expect(s.falaDaCorrecao('Marina')).toMatch(/subiu de \d+ para \d+/);
  });

  it('não deixa pausar sem nenhuma fala', async () => {
    const s = new Sessao(cena, 'mulher', motorFake());
    s.comecar();
    await expect(s.avaliar()).rejects.toThrow(/pelo menos uma vez/);
  });

  it('encerra ao atingir o limite de falas', async () => {
    const curta: Cena = { ...cena, abertura_personagem: '', fim: { ...cena.fim, max_falas: 1 } };
    const m = motorRoteiro(['{"fala":"hum","estado":{"abertura":3,"paciencia":5,"confianca":4},"fim":false}']);
    const s = new Sessao(curta, 'mulher', m);
    s.comecar();
    const r = await s.falar('oi');
    expect(r.fim).toBe(true);
    expect(s.acabou).toBe(true);
  });

  it('avaliador falhando duas vezes vira "sem avaliação", sem nota inventada', async () => {
    const m = motorRoteiro(['{"fala":"oi","estado":{"abertura":3,"paciencia":5,"confianca":4}}', 'lixo', 'lixo']);
    const s = new Sessao(cena, 'mulher', m);
    s.comecar();
    await s.falar('oi');
    expect(await s.avaliar()).toBeNull();
    expect(s.erro).toMatch(/Sem avaliação/);
    expect(s.falaDaCorrecao('X')).toMatch(/Pausa/);
  });

  it('abertura do personagem aparece em toda tentativa', async () => {
    const s = new Sessao(cena, 'mulher', motorFake());
    expect(s.atual.falas[0]?.quem).toBe(cena.abertura_personagem ? 'personagem' : undefined);
    s.comecar();
    s.refazer();
    expect(s.atual.falas.length).toBe(cena.abertura_personagem ? 1 : 0);
  });
});

describe('métricas', () => {
  it('conta vícios e perguntas abertas', () => {
    expect(contarVicios('né, tipo assim, né')).toEqual({ né: 2, tipo: 1, 'tipo assim': 1 });
    expect(perguntas('Tudo bem? Como você está? Ok.')).toEqual({ total: 2, abertas: 1 });
  });
  it('proporção de fala e ritmo com voz', () => {
    const m = metricas([
      { quem: 'voce', texto: 'um dois três quatro', voz: { duracao_s: 2 } },
      { quem: 'personagem', texto: 'cinco seis seis oito' },
    ]);
    expect(m.proporcao_fala).toBe(50);
    expect(m.palavras_min).toBe(120);
    expect(m.palavras_por_fala).toBe(4);
  });
  it('sem voz, ritmo fica nulo', () => {
    expect(metricas([{ quem: 'voce', texto: 'oi' }]).palavras_min).toBeNull();
  });
});

describe('avaliador: formato evidência antes da nota', () => {
  it('aceita {analise: [{id, evidencia, nota}]}', () => {
    const analise = cena.criterios.map((c) => ({ id: c.id, evidencia: "fala 1: 'x'", nota: 8 }));
    const a = validarAvaliacao({ analise, correcao_unica: 'Faça X.', ponto_forte: 'Y' }, cena);
    expect(a.nota_geral).toBe(8);
    expect(Object.keys(a.evidencias)).toHaveLength(cena.criterios.length);
  });
});
