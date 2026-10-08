// Diagnóstico: roda o avaliador N vezes sobre uma transcrição fixa e mostra notas e evidências.
// Uso: npx vite-node scripts/avaliar-fixo.ts -- --gateway URL --modelo M [--n 3]
import { cenaPorId } from '../src/cenas/cenas';
import { motorGateway } from '../src/motor/motores';
import { msgsAvaliador } from '../src/sessao/prompts';
import { pedirJson } from '../src/sessao/sessao';
import { validarAvaliacao } from '../src/sessao/validar';
import type { Fala } from '../src/tipos';

const a = process.argv.slice(2);
const arg = (n: string, p?: string) => (a.indexOf(`--${n}`) >= 0 ? a[a.indexOf(`--${n}`) + 1] : p);
const motor = motorGateway('ollama', arg('modelo'), arg('gateway', 'http://127.0.0.1:8787'));
const cena = cenaPorId('feedback-atraso')!;
const falas: Fala[] = [
  { quem: 'personagem', texto: cena.abertura_personagem ?? '' },
  { quem: 'voce', texto: 'Marcos, você sempre chega atrasado, isso é falta de respeito.' },
  { quem: 'personagem', texto: 'Falta de respeito? Eu trabalho até tarde todo dia. Isso é injusto.' },
  { quem: 'voce', texto: 'Desculpa, comecei mal. Nas três últimas reuniões você chegou depois das 9h15 e a gente teve que repetir a pauta. Está acontecendo alguma coisa?' },
  { quem: 'personagem', texto: 'Tá... meu pai está fazendo fisioterapia de manhã e eu levo ele.' },
  { quem: 'voce', texto: 'Poxa, entendi. Que tal a gente passar a reunião para 9h30, ou você me avisa na véspera quando não der? Assim ninguém repete a pauta.' },
];
if (arg('curta')) falas.splice(5);
if (arg('dificil')) {
  falas[2].texto = 'Respeito? Eu já salvei o projeto do Lago no último minuto, lembra? E o trânsito hoje era um inferno. Se a gente não tivesse reunião às 9h, seria melhor.';
  falas[4].texto = 'Ah, então você percebeu que foi 3 vezes. Legal. Mas não é só o trânsito, tá. Meu pai tá com problemas na coluna, faz fisioterapia três manhãs por semana. Não falei porque achei que ia parecer que estou pedindo desconto.';
}
for (let i = 0; i < Number(arg('n', '3')); i++) {
  const r = await pedirJson(motor, msgsAvaliador(cena, 'mulher', falas), (b) => validarAvaliacao(b, cena), 0.2, !!arg('pensar'));
  console.log(`#${i + 1} geral=${r.nota_geral}`, JSON.stringify(r.notas), '|', r.correcao_unica);
}
