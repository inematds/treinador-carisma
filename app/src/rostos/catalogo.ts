// Rostos ilustrados gerados por código (SVG) — licença MIT, livres para copiar, ajustar e vender.
// Para trocar um rosto, edite os parâmetros aqui (ou crie um id novo e use-o na cena).

export type EstiloCabelo = 'curto' | 'lateral' | 'careca' | 'longo' | 'ondulado' | 'coque' | 'chanel' | 'cacheado' | 'rabo';
export type Roupa = 'terno' | 'blazer' | 'camisa' | 'vestido' | 'gola-alta' | 'casual';

export interface ParamRosto {
  pele: string;
  cabelo: { estilo: EstiloCabelo; cor: string };
  olhos: string;
  roupa: { tipo: Roupa; cor: string; detalhe?: string };
  barba?: 'curta' | 'cavanhaque' | 'por-fazer';
  oculos?: boolean;
  brinco?: boolean;
  gravata?: string;
  batom?: string;
  idade?: 'jovem' | 'adulto' | 'maduro';
  fundo: [string, string];
}

const P = {
  clara: '#f1c9a5',
  media: '#d9a37c',
  morena: '#b77b55',
  escura: '#7e4f33',
  muitoEscura: '#5b3826',
};
const C = { preto: '#1c1714', castanho: '#4a2c1d', claro: '#8a5a33', loiro: '#d6b06a', ruivo: '#a4492a', grisalho: '#9a948e', branco: '#d9d4cf' };

export const ROSTOS: Record<string, ParamRosto> = {
  // Treinadores
  executivo: { pele: P.media, cabelo: { estilo: 'lateral', cor: C.grisalho }, olhos: '#3b2a1e', roupa: { tipo: 'terno', cor: '#1f2a3a', detalhe: '#f4f1ea' }, gravata: '#8a1c2b', barba: 'por-fazer', idade: 'maduro', fundo: ['#3a2a10', '#0f0c08'] },
  executiva: { pele: P.morena, cabelo: { estilo: 'chanel', cor: C.preto }, olhos: '#2a1c12', roupa: { tipo: 'blazer', cor: '#2b2b33', detalhe: '#efe8dc' }, brinco: true, batom: '#9c3b3b', idade: 'adulto', fundo: ['#3a2a10', '#0f0c08'] },
  elegante: { pele: P.clara, cabelo: { estilo: 'lateral', cor: C.castanho }, olhos: '#4a6a7a', roupa: { tipo: 'terno', cor: '#14161c', detalhe: '#ffffff' }, barba: 'curta', idade: 'adulto', fundo: ['#40220f', '#0d0907'] },
  linda: { pele: P.media, cabelo: { estilo: 'ondulado', cor: C.claro }, olhos: '#3e5a2f', roupa: { tipo: 'vestido', cor: '#5a1626' }, brinco: true, batom: '#b5414a', idade: 'jovem', fundo: ['#40220f', '#0d0907'] },
  // Personagens — carisma
  marcos: { pele: P.media, cabelo: { estilo: 'curto', cor: C.preto }, olhos: '#2b1d14', roupa: { tipo: 'camisa', cor: '#5b7894' }, barba: 'por-fazer', idade: 'adulto', fundo: ['#14233a', '#080d16'] },
  helena: { pele: P.clara, cabelo: { estilo: 'coque', cor: C.grisalho }, olhos: '#4d6b80', roupa: { tipo: 'blazer', cor: '#3c3550', detalhe: '#f1eee8' }, oculos: true, brinco: true, idade: 'maduro', fundo: ['#14233a', '#080d16'] },
  roberto: { pele: P.clara, cabelo: { estilo: 'careca', cor: C.grisalho }, olhos: '#3a3a3a', roupa: { tipo: 'terno', cor: '#2f3640', detalhe: '#dfe6ee' }, gravata: '#2d4a6b', barba: 'curta', idade: 'maduro', fundo: ['#14233a', '#080d16'] },
  juliana: { pele: P.escura, cabelo: { estilo: 'cacheado', cor: C.preto }, olhos: '#2a1a10', roupa: { tipo: 'casual', cor: '#c98b2e' }, brinco: true, idade: 'jovem', fundo: ['#14233a', '#080d16'] },
  carlos: { pele: P.morena, cabelo: { estilo: 'curto', cor: C.castanho }, olhos: '#2e2015', roupa: { tipo: 'camisa', cor: '#e8e4dc' }, oculos: true, barba: 'cavanhaque', idade: 'adulto', fundo: ['#14233a', '#080d16'] },
  beatriz: { pele: P.clara, cabelo: { estilo: 'longo', cor: C.loiro }, olhos: '#4f7090', roupa: { tipo: 'gola-alta', cor: '#2a2a2e' }, brinco: true, batom: '#a8545a', idade: 'adulto', fundo: ['#14233a', '#080d16'] },
  andre: { pele: P.muitoEscura, cabelo: { estilo: 'curto', cor: C.preto }, olhos: '#24160e', roupa: { tipo: 'blazer', cor: '#4a5a3a', detalhe: '#e9e4d8' }, barba: 'curta', idade: 'jovem', fundo: ['#14233a', '#080d16'] },
  patricia: { pele: P.media, cabelo: { estilo: 'rabo', cor: C.castanho }, olhos: '#3a2a1e', roupa: { tipo: 'blazer', cor: '#1d3b4a', detalhe: '#f2efe9' }, oculos: true, idade: 'adulto', fundo: ['#14233a', '#080d16'] },
  diego: { pele: P.clara, cabelo: { estilo: 'lateral', cor: C.ruivo }, olhos: '#5a7a4a', roupa: { tipo: 'camisa', cor: '#a33a3a' }, barba: 'curta', idade: 'adulto', fundo: ['#14233a', '#080d16'] },
  lucia: { pele: P.escura, cabelo: { estilo: 'coque', cor: C.preto }, olhos: '#26180f', roupa: { tipo: 'camisa', cor: '#6f8f7a' }, brinco: true, idade: 'adulto', fundo: ['#14233a', '#080d16'] },
  // Personagens — conquista (mulher / homem)
  camila: { pele: P.media, cabelo: { estilo: 'longo', cor: C.castanho }, olhos: '#3a2a1a', roupa: { tipo: 'casual', cor: '#d9c7a8' }, brinco: true, batom: '#b0505a', idade: 'jovem', fundo: ['#2a1630', '#0c0710'] },
  rafael: { pele: P.morena, cabelo: { estilo: 'curto', cor: C.preto }, olhos: '#2a1a10', roupa: { tipo: 'casual', cor: '#3b4a5e' }, barba: 'por-fazer', idade: 'jovem', fundo: ['#2a1630', '#0c0710'] },
  sofia: { pele: P.clara, cabelo: { estilo: 'ondulado', cor: C.ruivo }, olhos: '#4e6e3a', roupa: { tipo: 'vestido', cor: '#1e3a4a' }, brinco: true, batom: '#a8404a', idade: 'jovem', fundo: ['#2a1630', '#0c0710'] },
  bruno: { pele: P.clara, cabelo: { estilo: 'lateral', cor: C.loiro }, olhos: '#4a6a8a', roupa: { tipo: 'blazer', cor: '#5a4a3a', detalhe: '#f0ece4' }, barba: 'curta', idade: 'adulto', fundo: ['#2a1630', '#0c0710'] },
  larissa: { pele: P.escura, cabelo: { estilo: 'cacheado', cor: C.castanho }, olhos: '#2a1a10', roupa: { tipo: 'gola-alta', cor: '#c4a35a' }, brinco: true, batom: '#8f3a3a', idade: 'jovem', fundo: ['#2a1630', '#0c0710'] },
  thiago: { pele: P.media, cabelo: { estilo: 'curto', cor: C.castanho }, olhos: '#3a2a1e', roupa: { tipo: 'camisa', cor: '#f0ede6' }, idade: 'jovem', fundo: ['#2a1630', '#0c0710'] },
  mariana: { pele: P.morena, cabelo: { estilo: 'rabo', cor: C.preto }, olhos: '#2b1b12', roupa: { tipo: 'casual', cor: '#8a4a6a' }, brinco: true, batom: '#9c3b4b', idade: 'adulto', fundo: ['#2a1630', '#0c0710'] },
  gabriel: { pele: P.muitoEscura, cabelo: { estilo: 'careca', cor: C.preto }, olhos: '#20140c', roupa: { tipo: 'gola-alta', cor: '#1d1d22' }, barba: 'curta', idade: 'adulto', fundo: ['#2a1630', '#0c0710'] },
  isabela: { pele: P.clara, cabelo: { estilo: 'chanel', cor: C.loiro }, olhos: '#3e5f80', roupa: { tipo: 'blazer', cor: '#e2d6c2', detalhe: '#2a2a2a' }, brinco: true, batom: '#b14b55', idade: 'adulto', fundo: ['#2a1630', '#0c0710'] },
  leo: { pele: P.morena, cabelo: { estilo: 'cacheado', cor: C.preto }, olhos: '#2a1a10', roupa: { tipo: 'casual', cor: '#2f5a4a' }, idade: 'jovem', fundo: ['#2a1630', '#0c0710'] },
  clara: { pele: P.media, cabelo: { estilo: 'coque', cor: C.castanho }, olhos: '#3a2a1a', roupa: { tipo: 'vestido', cor: '#2b2b4a' }, brinco: true, oculos: true, batom: '#a5485a', idade: 'adulto', fundo: ['#2a1630', '#0c0710'] },
  mateus: { pele: P.escura, cabelo: { estilo: 'curto', cor: C.preto }, olhos: '#24160e', roupa: { tipo: 'blazer', cor: '#2b3b5a', detalhe: '#f4f0e8' }, barba: 'cavanhaque', idade: 'adulto', fundo: ['#2a1630', '#0c0710'] },
};

export function rosto(id: string): ParamRosto {
  return ROSTOS[id] ?? ROSTOS.marcos;
}
