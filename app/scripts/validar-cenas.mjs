#!/usr/bin/env node
// Valida todas as cenas em cenas/<modo>/<competencia>/<id>.yaml contra o schema do CONTRATOS.md (seção 3).
// Uso: node app/scripts/validar-cenas.mjs [pasta-cenas]
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, basename, dirname, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import yaml from 'js-yaml';

const aqui = dirname(fileURLToPath(import.meta.url));
const RAIZ_CENAS = resolve(process.argv[2] ?? join(aqui, '..', '..', 'cenas'));

const COMPETENCIAS = {
  carisma: ['presenca', 'voz-clareza', 'conexao', 'influencia', 'situacoes-dificeis'],
  conquista: ['abertura', 'flerte', 'reciprocidade', 'convite', 'recusa'],
};
const ROSTOS_CARISMA = {
  marcos: 'masculina', helena: 'feminina', roberto: 'masculina', juliana: 'feminina',
  carlos: 'masculina', beatriz: 'feminina', andre: 'masculina', patricia: 'feminina',
  diego: 'masculina', lucia: 'feminina',
};
const ROSTOS_MULHER = ['camila', 'sofia', 'larissa', 'mariana', 'isabela', 'clara'];
const ROSTOS_HOMEM = ['rafael', 'bruno', 'thiago', 'gabriel', 'leo', 'mateus'];
const PERFIS = ['timido', 'direto', 'curto', 'interessado', 'desinteressado', 'defensivo', 'irritado', 'ocupado'];
const VOZES = ['masculina', 'feminina'];
const ESTADOS = ['abertura', 'paciencia', 'confianca'];

function listarYaml(dir) {
  const out = [];
  for (const nome of readdirSync(dir)) {
    const p = join(dir, nome);
    if (statSync(p).isDirectory()) out.push(...listarYaml(p));
    else if (nome.endsWith('.yaml') || nome.endsWith('.yml')) out.push(p);
  }
  return out;
}

const textoOk = (v) => typeof v === 'string' && v.trim().length > 0;
const listaTextos = (v) => Array.isArray(v) && v.length > 0 && v.every(textoOk);
const inteiroEntre = (v, a, b) => Number.isInteger(v) && v >= a && v <= b;

function validarCena(arquivo, c, erros, idsVistos) {
  const e = (msg) => erros.push(`${relative(RAIZ_CENAS, arquivo)}: ${msg}`);
  if (!c || typeof c !== 'object' || Array.isArray(c)) return e('YAML não é um objeto');

  const partes = relative(RAIZ_CENAS, arquivo).split(/[\\/]/);
  const id = basename(arquivo).replace(/\.ya?ml$/, '');
  if (partes.length !== 3) e('caminho deve ser <modo>/<competencia>/<id>.yaml');
  const [modoPasta, compPasta] = partes;

  // campos de topo
  if (c.id !== id) e(`id '${c.id}' difere do nome do arquivo '${id}'`);
  if (idsVistos.has(c.id)) e(`id '${c.id}' repetido (também em ${idsVistos.get(c.id)})`);
  else idsVistos.set(c.id, relative(RAIZ_CENAS, arquivo));
  if (!COMPETENCIAS[c.modo]) e(`modo inválido '${c.modo}'`);
  else if (!COMPETENCIAS[c.modo].includes(c.competencia)) e(`competência '${c.competencia}' inválida para o modo ${c.modo}`);
  if (c.modo !== modoPasta) e(`modo '${c.modo}' difere da pasta '${modoPasta}'`);
  if (c.competencia !== compPasta) e(`competência '${c.competencia}' difere da pasta '${compPasta}'`);
  if (!inteiroEntre(c.nivel, 1, 3)) e('nivel deve ser inteiro 1-3');
  for (const k of ['titulo', 'contexto', 'objetivo', 'dica_inicial']) if (!textoOk(c[k])) e(`campo '${k}' ausente ou vazio`);
  if (typeof c.abertura_personagem !== 'string') e("campo 'abertura_personagem' ausente (use \"\" se o usuário abre)");

  // personagem
  const p = c.personagem;
  if (!p || typeof p !== 'object') e("campo 'personagem' ausente");
  else {
    if (!PERFIS.includes(p.perfil)) e(`personagem.perfil inválido '${p.perfil}'`);
    if (!textoOk(p.descricao)) e('personagem.descricao ausente');
    const est = p.estado_inicial;
    if (!est || typeof est !== 'object') e('personagem.estado_inicial ausente');
    else for (const k of ESTADOS) if (!inteiroEntre(est[k], 0, 10)) e(`personagem.estado_inicial.${k} deve ser inteiro 0-10`);
    if (!listaTextos(p.sobe_quando)) e('personagem.sobe_quando deve ser lista não vazia de textos');
    if (!listaTextos(p.desce_quando)) e('personagem.desce_quando deve ser lista não vazia de textos');
    if (p.segredo !== undefined && typeof p.segredo !== 'string') e('personagem.segredo deve ser texto');

    if (c.modo === 'carisma') {
      if (!textoOk(p.nome)) e('personagem.nome ausente');
      if (!(p.rosto in ROSTOS_CARISMA)) e(`personagem.rosto '${p.rosto}' fora da lista de carisma`);
      else if (p.voz !== ROSTOS_CARISMA[p.rosto]) e(`personagem.voz '${p.voz}' não combina com o rosto '${p.rosto}'`);
      if (!VOZES.includes(p.voz)) e(`personagem.voz inválida '${p.voz}'`);
      if (c.variantes !== undefined) e("'variantes' só existe no modo conquista");
    }
    if (c.modo === 'conquista') {
      for (const k of ['nome', 'rosto', 'voz']) if (p[k] !== undefined) e(`personagem.${k} não deve existir em conquista (vem de variantes)`);
    }
  }

  // variantes (conquista)
  if (c.modo === 'conquista') {
    const v = c.variantes;
    if (!v || typeof v !== 'object') e("conquista exige 'variantes' com mulher e homem");
    else {
      const regras = { mulher: [ROSTOS_MULHER, 'feminina'], homem: [ROSTOS_HOMEM, 'masculina'] };
      for (const [g, [rostos, voz]] of Object.entries(regras)) {
        const x = v[g];
        if (!x || typeof x !== 'object') { e(`variantes.${g} ausente`); continue; }
        if (!textoOk(x.nome)) e(`variantes.${g}.nome ausente`);
        if (!rostos.includes(x.rosto)) e(`variantes.${g}.rosto '${x.rosto}' fora da lista`);
        if (x.voz !== voz) e(`variantes.${g}.voz deve ser '${voz}'`);
      }
      const extras = Object.keys(v).filter((k) => !(k in regras));
      if (extras.length) e(`variantes com chaves desconhecidas: ${extras.join(', ')}`);
    }
  }

  // fim
  const f = c.fim;
  if (!f || typeof f !== 'object') e("campo 'fim' ausente");
  else {
    if (!inteiroEntre(f.max_falas, 1, 50)) e('fim.max_falas deve ser inteiro positivo');
    if (!textoOk(f.sucesso)) e('fim.sucesso ausente');
    if (!textoOk(f.fracasso)) e('fim.fracasso ausente');
  }

  // critérios
  const cr = c.criterios;
  if (!Array.isArray(cr) || cr.length < 3 || cr.length > 5) e('criterios deve ter de 3 a 5 itens');
  else {
    const ids = new Set();
    for (const [i, k] of cr.entries()) {
      const pre = `criterios[${i}]`;
      if (!k || typeof k !== 'object') { e(`${pre} não é objeto`); continue; }
      if (!/^[a-z][a-z0-9_]*$/.test(k.id ?? '')) e(`${pre}.id inválido '${k.id}' (snake_case)`);
      if (ids.has(k.id)) e(`${pre}.id '${k.id}' repetido`);
      ids.add(k.id);
      if (!textoOk(k.nome)) e(`${pre}.nome ausente`);
      if (!inteiroEntre(k.peso, 1, 3)) e(`${pre}.peso deve ser inteiro 1-3`);
      if (!listaTextos(k.bons)) e(`${pre}.bons deve ser lista não vazia de textos`);
      if (!listaTextos(k.ruins)) e(`${pre}.ruins deve ser lista não vazia de textos`);
    }
    if (c.modo === 'conquista' && !cr.some((k) => k && typeof k.id === 'string' && k.id.includes('pressao'))) {
      e("conquista exige um critério de pressão (id contendo 'pressao')");
    }
  }

  // calibração
  const cal = c.calibracao;
  if (!cal || typeof cal !== 'object') e("campo 'calibracao' ausente");
  else {
    if (!textoOk(cal.nota_3)) e('calibracao.nota_3 ausente');
    if (!textoOk(cal.nota_8)) e('calibracao.nota_8 ausente');
    if (textoOk(cal.nota_3) && cal.nota_3 === cal.nota_8) e('calibracao.nota_3 e nota_8 são iguais');
  }
}

let arquivos;
try {
  arquivos = listarYaml(RAIZ_CENAS).sort();
} catch (err) {
  console.error(`não consegui ler ${RAIZ_CENAS}: ${err.message}`);
  process.exit(1);
}

const erros = [];
const idsVistos = new Map();
let validas = 0;
for (const arq of arquivos) {
  const antes = erros.length;
  let dado;
  try {
    dado = yaml.load(readFileSync(arq, 'utf8'));
  } catch (err) {
    erros.push(`${relative(RAIZ_CENAS, arq)}: YAML inválido: ${err.message.split('\n')[0]}`);
    continue;
  }
  validarCena(arq, dado, erros, idsVistos);
  if (erros.length === antes) validas++;
}

for (const linha of erros) console.error(`ERRO ${linha}`);
if (arquivos.length === 0) {
  console.error('nenhuma cena encontrada');
  process.exit(1);
}
if (erros.length) {
  console.error(`${erros.length} erro(s); ${validas} de ${arquivos.length} cenas OK`);
  process.exit(1);
}
console.log(`${validas} cenas OK`);
