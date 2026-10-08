// Calibração do avaliador: em cada cena, a fala `nota_3` deve tirar ≤ 4 e a `nota_8` ≥ 7.
// Uso: npx vite-node scripts/calibrar.ts -- --gateway http://127.0.0.1:8787 --motor ollama [--modelo qwen3.6:35b-a3b] [--minimo 14]
import { CENAS } from '../src/cenas/cenas';
import { motorGateway } from '../src/motor/motores';
import { msgsAvaliador } from '../src/sessao/prompts';
import { pedirJson } from '../src/sessao/sessao';
import { validarAvaliacao } from '../src/sessao/validar';
import type { Cena, Fala } from '../src/tipos';

const args = process.argv.slice(2);
const arg = (n: string, p?: string) => {
  const i = args.indexOf(`--${n}`);
  return i >= 0 ? args[i + 1] : p;
};
const gateway = arg('gateway', 'http://127.0.0.1:8787')!;
const motor = motorGateway(arg('motor', 'ollama')!, arg('modelo'), gateway);
const minimo = Number(arg('minimo', '14'));
const so = arg('cena');

async function nota(cena: Cena, texto: string): Promise<number | null> {
  const falas: Fala[] = [];
  if (cena.abertura_personagem?.trim()) falas.push({ quem: 'personagem', texto: cena.abertura_personagem });
  falas.push({ quem: 'voce', texto });
  try {
    const a = await pedirJson(motor, msgsAvaliador(cena, 'mulher', falas), (b) => validarAvaliacao(b, cena), 0.2);
    return a.nota_geral;
  } catch (e) {
    console.log(`   erro: ${(e as Error).message}`);
    return null;
  }
}

let ok = 0;
const cenas = CENAS.filter((c) => !so || c.id === so);
console.log(`Calibrando ${cenas.length} cenas com ${motor.rotulo}\n`);
for (const c of cenas) {
  const t0 = Date.now();
  const n3 = await nota(c, c.calibracao.nota_3);
  const n8 = await nota(c, c.calibracao.nota_8);
  const passou = n3 !== null && n8 !== null && n3 <= 4 && n8 >= 7;
  if (passou) ok++;
  console.log(`${passou ? 'OK ' : 'XX '} ${c.modo.padEnd(9)} ${c.id.padEnd(26)} ruim=${n3 ?? '—'} boa=${n8 ?? '—'}  (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
}
console.log(`\n${ok}/${cenas.length} cenas calibradas (mínimo ${so ? 1 : minimo})`);
process.exit(ok >= (so ? 1 : minimo) ? 0 : 1);
