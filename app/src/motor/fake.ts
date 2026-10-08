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
    async *chat(msgs) {
      if (atrasoMs) await new Promise((r) => setTimeout(r, atrasoMs));
      const p = papel(msgs);
      const ultimo = msgs[msgs.length - 1]?.content ?? '';
      if (p === 'personagem') {
        const n = (ultimo.match(/\(USUÁRIO\)/g) ?? []).length;
        const fim = n >= 3;
        const v = Math.min(10, 3 + n * 2);
        yield JSON.stringify({
          fala: FALAS[Math.min(n - 1, FALAS.length - 1)] ?? FALAS[0],
          estado: { abertura: v, paciencia: 6, confianca: v },
          expressao: v >= 7 ? 'sorrindo' : 'neutro',
          fim,
          resultado: fim ? 'sucesso' : null,
        });
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
