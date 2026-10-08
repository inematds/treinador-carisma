// Motor de demonstração/testes: determinístico, sem rede. Reconhece o papel pela 1ª linha do prompt.
import type { Motor, Msg } from './tipos';

function papel(msgs: Msg[]): string {
  const s = msgs.find((m) => m.role === 'system')?.content ?? '';
  return s.match(/^PAPEL:\s*(\w+)/m)?.[1] ?? 'treinador';
}

const FALAS = [
  'Hum... tá. E aí?',
  'Entendi. Continua.',
  'Olha, faz sentido o que você está dizendo.',
  'Tá bom, vamos combinar assim então.',
];

export function motorFake(atrasoMs = 0): Motor {
  return {
    id: 'fake',
    rotulo: 'Demonstração (respostas simuladas)',
    externo: false,
    async *chat(msgs, o = {}) {
      if (atrasoMs) await new Promise((r) => setTimeout(r, atrasoMs));
      const p = papel(msgs);
      const ultimo = msgs[msgs.length - 1]?.content ?? '';
      if (p === 'personagem') {
        const n = (ultimo.match(/\(USUÁRIO\)/g) ?? []).length;
        // fala grosseira derruba a paciência (para testar a pausa automática)
        const ultimaDoUsuario = [...ultimo.matchAll(/fala \d+ \(USUÁRIO\): (.*)/g)].pop()?.[1] ?? '';
        const grosseiro = /grosso|cala a boca|tanto faz|não ligo/i.test(ultimaDoUsuario);
        // "conta mais" pede uma resposta longa (para testar a interrupção por voz)
        const longa = /conta mais/i.test(ultimaDoUsuario);
        const fim = n >= 3 && !grosseiro && !longa;
        const v = grosseiro ? 2 : Math.min(10, 3 + n * 2);
        const json = JSON.stringify({
          fala: grosseiro
            ? 'Nossa. Assim fica difícil conversar.'
            : longa
              ? 'Então, deixa eu te explicar com calma. Isso começou no ano passado, quando mudaram a equipe inteira. Desde então cada reunião vira uma discussão longa sobre prioridades. E ninguém decide nada de verdade no final.'
              : (FALAS[Math.min(n - 1, FALAS.length - 1)] ?? FALAS[0]),
          estado: { abertura: v, paciencia: grosseiro ? 2 : 6, confianca: v },
          expressao: grosseiro ? 'irritado' : v >= 7 ? 'sorrindo' : 'neutro',
          fim,
          resultado: fim ? 'sucesso' : null,
        });
        // em pedaços, como um modelo de verdade em streaming
        for (let i = 0; i < json.length; i += 7) {
          if (o.signal?.aborted) return;
          yield json.slice(i, i + 7);
          if (atrasoMs) await new Promise((r) => setTimeout(r, 15));
        }
        return;
      }
      if (p === 'avaliador') {
        const sistema = msgs[0].content;
        const ids = (sistema.match(/CRITERIOS_IDS:\s*(.+)/)?.[1] ?? '').split(',').map((s) => s.trim()).filter(Boolean);
        // Sobe 2 pontos a cada tentativa (para o teste de comparação): conta quantas vezes "fala 1" aparece não serve;
        // usa o tamanho da 1ª fala do usuário como semente estável.
        const primeira = ultimo.match(/fala 1 \(USUÁRIO\): (.*)/)?.[1] ?? '';
        const base = primeira.length > 40 ? 7 : 4;
        const notas = Object.fromEntries(ids.map((id, i) => [id, Math.min(10, base + (i % 2))]));
        const evid = Object.fromEntries(ids.map((id) => [id, `fala 1: '${primeira.slice(0, 40)}'`]));
        yield JSON.stringify({
          analise: ids.map((id) => ({ id, evidencia: evid[id], nota: notas[id] })),
          ponto_forte: 'Você manteve a calma do começo ao fim.',
          correcao_unica: 'Abra com um fato concreto antes de qualquer opinião.',
        });
        return;
      }
      yield 'Oi! Eu sou seu treinador nesta demonstração. Que tal começar por uma conversa difícil? ';
      yield 'É onde a gente mais cresce.\n[[cena:feedback-atraso]]';
    },
  };
}
