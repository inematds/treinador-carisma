// Progresso local (IndexedDB), com exportar/importar JSON. Nada sai do navegador.
import { get, set } from 'idb-keyval';
import type { Avaliacao, Modo } from '../tipos';

export interface Registro {
  cena: string;
  modo: Modo;
  competencia: string;
  quando: number;
  tentativa: number;
  nota: number;
  notas: Record<string, number>;
  resultado: string | null;
}

const CHAVE = 'tc-progresso-v1';
let memoria: Registro[] | null = null;

export async function carregar(): Promise<Registro[]> {
  if (memoria) return memoria;
  try {
    memoria = ((await get(CHAVE)) as Registro[] | undefined) ?? [];
  } catch {
    memoria = [];
  }
  return memoria;
}

export async function registrar(r: Omit<Registro, 'nota' | 'notas'> & { avaliacao: Avaliacao }): Promise<void> {
  const lista = await carregar();
  const { avaliacao, ...resto } = r;
  lista.push({ ...resto, nota: avaliacao.nota_geral, notas: avaliacao.notas });
  try {
    await set(CHAVE, lista);
  } catch {
    /* sem armazenamento: fica só na memória desta aba */
  }
}

export function melhorPorCena(lista: Registro[]): Record<string, number> {
  const r: Record<string, number> = {};
  for (const x of lista) r[x.cena] = Math.max(r[x.cena] ?? 0, x.nota);
  return r;
}

/** Média das últimas 5 notas por competência (0-10). */
export function porCompetencia(lista: Registro[], modo: Modo): Record<string, number> {
  const grupos: Record<string, number[]> = {};
  for (const x of lista.filter((x) => x.modo === modo)) (grupos[x.competencia] ??= []).push(x.nota);
  return Object.fromEntries(Object.entries(grupos).map(([k, v]) => [k, Math.round((v.slice(-5).reduce((a, b) => a + b, 0) / Math.min(5, v.length)) * 10) / 10]));
}

export function resumoParaTreinador(lista: Registro[], modo: Modo): string {
  const doModo = lista.filter((x) => x.modo === modo);
  if (!doModo.length) return '';
  const comp = porCompetencia(lista, modo);
  const linhas = Object.entries(comp).map(([k, v]) => `${k}: média ${v}`);
  return `${doModo.length} tentativas avaliadas. ${linhas.join('; ')}. Últimas cenas: ${[...new Set(doModo.slice(-4).map((x) => x.cena))].join(', ')}.`;
}

export async function exportar(): Promise<string> {
  return JSON.stringify({ app: 'treinador-carisma', versao: 1, registros: await carregar() }, null, 2);
}

export async function importar(txt: string): Promise<number> {
  const d = JSON.parse(txt);
  if (d.app !== 'treinador-carisma' || !Array.isArray(d.registros)) throw new Error('arquivo não é do Treinador de Carisma');
  memoria = d.registros as Registro[];
  await set(CHAVE, memoria);
  return memoria.length;
}
