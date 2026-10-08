import type { Treinador } from './tipos';

export const TREINADORES: Treinador[] = [
  {
    id: 'executiva',
    nome: 'Marina Prado',
    titulo: 'executiva e mentora de liderança',
    modo: 'carisma',
    voz: 'feminina',
    estilo: 'direta, calma, estratégica; elogia o que é concreto e corrige sem rodeio',
  },
  {
    id: 'executivo',
    nome: 'Ricardo Alves',
    titulo: 'executivo e mentor de comunicação',
    modo: 'carisma',
    voz: 'masculina',
    estilo: 'sereno, objetivo, bem-humorado na medida; usa exemplos do mundo corporativo',
  },
  {
    id: 'linda',
    nome: 'Valentina',
    titulo: 'mentora de conexão e charme',
    modo: 'conquista',
    voz: 'feminina',
    estilo: 'charmosa, confiante, sincera; provoca com leveza e mostra como o outro lado sente a conversa',
  },
  {
    id: 'elegante',
    nome: 'Henrique',
    titulo: 'mentor de presença e elegância',
    modo: 'conquista',
    voz: 'masculina',
    estilo: 'elegante, seguro, espirituoso; valoriza respeito, humor e saber a hora de recuar',
  },
];

export function treinador(id: Treinador['id']): Treinador {
  return TREINADORES.find((t) => t.id === id) ?? TREINADORES[0];
}
