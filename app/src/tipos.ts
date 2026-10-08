// Tipos centrais. Espelham CONTRATOS.md (seções 3 e 4).

export type Modo = 'carisma' | 'conquista';
export type Alvo = 'mulher' | 'homem';
export type Expressao = 'neutro' | 'aberto' | 'fechado' | 'irritado' | 'sorrindo';
export type Genero = 'masculina' | 'feminina';

export interface EstadoPersonagem {
  abertura: number;
  paciencia: number;
  confianca: number;
}

export interface Criterio {
  id: string;
  nome: string;
  peso: number;
  bons?: string[];
  ruins?: string[];
}

export interface Identidade {
  nome: string;
  rosto: string;
  voz: Genero;
}

export interface Cena {
  id: string;
  modo: Modo;
  competencia: string;
  nivel: number;
  titulo: string;
  contexto: string;
  objetivo: string;
  abertura_personagem?: string;
  personagem: Partial<Identidade> & {
    perfil: string;
    descricao: string;
    estado_inicial: EstadoPersonagem;
    sobe_quando: string[];
    desce_quando: string[];
    segredo?: string;
  };
  variantes?: { mulher: Identidade; homem: Identidade };
  fim: { max_falas: number; sucesso: string; fracasso?: string };
  criterios: Criterio[];
  calibracao: { nota_3: string; nota_8: string };
  dica_inicial?: string;
}

export interface Fala {
  quem: 'voce' | 'personagem';
  texto: string;
  estado?: EstadoPersonagem;
  expressao?: Expressao;
  /** métricas de voz da fala, quando veio do microfone */
  voz?: { duracao_s: number; palavras_min?: number; pausas?: number };
}

export interface SaidaPersonagem {
  fala: string;
  estado: EstadoPersonagem;
  expressao: Expressao;
  fim: boolean;
  resultado: 'sucesso' | 'fracasso' | 'neutro' | null;
}

export interface Avaliacao {
  notas: Record<string, number>;
  evidencias: Record<string, string>;
  nota_geral: number;
  ponto_forte: string;
  correcao_unica: string;
  /** critérios descartados por falta de evidência */
  descartados: string[];
}

export interface Tentativa {
  n: number;
  inicio: number;
  falas: Fala[];
  resultado: SaidaPersonagem['resultado'];
  avaliacao: Avaliacao | null;
}

export interface Treinador {
  id: 'executivo' | 'executiva' | 'elegante' | 'linda';
  nome: string;
  titulo: string;
  modo: Modo;
  voz: Genero;
  estilo: string;
}
