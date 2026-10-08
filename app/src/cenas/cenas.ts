// Carrega as cenas YAML de /cenas no build (editar cena = editar o YAML).
import yaml from 'js-yaml';
import type { Cena, Modo } from '../tipos';

const brutos = import.meta.glob('../../../cenas/**/*.yaml', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;

export const CENAS: Cena[] = Object.entries(brutos)
  .map(([, txt]) => yaml.load(txt) as Cena)
  .sort((a, b) => a.modo.localeCompare(b.modo) || a.nivel - b.nivel || a.titulo.localeCompare(b.titulo));

export const COMPETENCIAS: Record<Modo, { id: string; nome: string }[]> = {
  carisma: [
    { id: 'presenca', nome: 'Presença' },
    { id: 'voz-clareza', nome: 'Voz e clareza' },
    { id: 'conexao', nome: 'Conexão' },
    { id: 'influencia', nome: 'Influência' },
    { id: 'situacoes-dificeis', nome: 'Situações difíceis' },
  ],
  conquista: [
    { id: 'abertura', nome: 'Abertura' },
    { id: 'flerte', nome: 'Flerte leve' },
    { id: 'reciprocidade', nome: 'Reciprocidade' },
    { id: 'convite', nome: 'Convite' },
    { id: 'recusa', nome: 'Lidar com recusa' },
  ],
};

export function nomeCompetencia(id: string): string {
  for (const l of Object.values(COMPETENCIAS)) for (const c of l) if (c.id === id) return c.nome;
  return id;
}

export function cenaPorId(id: string): Cena | undefined {
  return CENAS.find((c) => c.id === id);
}
