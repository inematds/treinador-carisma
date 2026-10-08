// Monta as mensagens de cada papel a partir dos prompts em /prompts e dos dados da cena.
import tPersonagem from '../../../prompts/personagem.md?raw';
import tAvaliador from '../../../prompts/avaliador.md?raw';
import tTreinador from '../../../prompts/treinador.md?raw';
import type { Msg } from '../motor/tipos';
import type { Alvo, Cena, EstadoPersonagem, Fala, Identidade, Treinador } from '../tipos';

export function preencher(modelo: string, dados: Record<string, string>): string {
  return modelo.replace(/\{\{(\w+)\}\}/g, (_, k: string) => dados[k] ?? '');
}

/** Nome/rosto/voz do personagem: direto (carisma) ou pela variante escolhida (conquista). */
export function identidade(cena: Cena, alvo: Alvo): Identidade {
  if (cena.variantes) return cena.variantes[alvo];
  return {
    nome: cena.personagem.nome ?? 'Personagem',
    rosto: cena.personagem.rosto ?? 'marcos',
    voz: cena.personagem.voz ?? 'masculina',
  };
}

export function transcricao(falas: Fala[], nomePersonagem: string): string {
  let n = 0;
  return falas
    .map((f) => (f.quem === 'voce' ? `fala ${++n} (USUÁRIO): ${f.texto}` : `${nomePersonagem.toUpperCase()}: ${f.texto}`))
    .join('\n');
}

function falasUsuario(falas: Fala[]): string {
  return falas
    .filter((f) => f.quem === 'voce')
    .map((f, i) => `fala ${i + 1}: ${f.texto}`)
    .join('\n');
}

export function msgsPersonagem(cena: Cena, alvo: Alvo, falas: Fala[], estado: EstadoPersonagem): Msg[] {
  const id = identidade(cena, alvo);
  const p = cena.personagem;
  const sistema = preencher(tPersonagem, {
    nome: id.nome,
    contexto: cena.contexto,
    descricao: p.descricao,
    perfil: p.perfil,
    segredo: p.segredo ? `Algo que você só conta se a pessoa perguntar com interesse genuíno: ${p.segredo}` : '',
    sobe_quando: p.sobe_quando.join('; '),
    desce_quando: p.desce_quando.join('; '),
    sucesso: cena.fim.sucesso,
  });
  const restantes = Math.max(0, cena.fim.max_falas - falas.filter((f) => f.quem === 'voce').length);
  const usuario =
    `Conversa até agora:\n${transcricao(falas, id.nome)}\n\n` +
    `Seu estado atual: ${JSON.stringify(estado)}\n` +
    `Falas restantes do usuário: ${restantes}${restantes === 0 ? ' (encerre agora, com fim = true)' : ''}\n` +
    `Responda com o JSON da próxima fala de ${id.nome}.`;
  return [
    { role: 'system', content: sistema },
    { role: 'user', content: usuario },
  ];
}

const REGRA_CONQUISTA =
  '7. Modo conquista: insistir depois de sinal negativo, pressionar, elogio invasivo ou qualquer manipulação derruba o critério de pressão para 2 ou menos. Ler a reciprocidade, recuar com elegância e aceitar um "não" com leveza contam a favor.';

export function msgsAvaliador(cena: Cena, alvo: Alvo, falas: Fala[]): Msg[] {
  const id = identidade(cena, alvo);
  const criterios = cena.criterios
    .map(
      (c) =>
        `- ${c.id} — ${c.nome} (peso ${c.peso})` +
        (c.bons?.length ? `\n  bons: ${c.bons.join('; ')}` : '') +
        (c.ruins?.length ? `\n  ruins: ${c.ruins.join('; ')}` : ''),
    )
    .join('\n');
  const sistema = preencher(tAvaliador, {
    modo: cena.modo,
    titulo: cena.titulo,
    contexto: cena.contexto,
    objetivo: cena.objetivo,
    criterios,
    ids: cena.criterios.map((c) => c.id).join(','),
    nota_3: cena.calibracao.nota_3,
    nota_8: cena.calibracao.nota_8,
    regra_modo: cena.modo === 'conquista' ? REGRA_CONQUISTA : '',
  });
  return [
    { role: 'system', content: sistema },
    {
      role: 'user',
      content:
        `Transcrição:\n${transcricao(falas, id.nome)}\n\n` +
        `Falas do USUÁRIO a avaliar (procure cada critério em TODAS elas):\n${falasUsuario(falas)}\n\nAvalie e responda com o JSON.`,
    },
  ];
}

const MODOS = {
  carisma: 'Carisma — comunicação no trabalho e na vida social: presença, voz, conexão, influência, conversas difíceis.',
  conquista:
    'Conquista — atração e relacionamento: puxar conversa, flertar com leveza, ler a reciprocidade, convidar sem pressão, lidar com recusa.',
};
const ETICA = {
  carisma: 'respeito e honestidade; influência sem manipulação.',
  conquista:
    'interesse genuíno, respeito e leitura de reciprocidade. Nunca ensine pressão, insistência após um "não", manipulação ou técnicas de "cantada". Um "não" faz parte e se aceita com elegância.',
};

export function msgsTreinador(
  t: Treinador,
  cenas: Cena[],
  progresso: string,
  historico: { role: 'user' | 'assistant'; content: string }[],
): Msg[] {
  const lista = cenas
    .filter((c) => c.modo === t.modo)
    .map((c) => `${c.id} — ${c.titulo} — ${c.competencia} — ${c.nivel}`)
    .join('\n');
  const sistema = preencher(tTreinador, {
    nome: t.nome,
    titulo: t.titulo,
    estilo: t.estilo,
    modo_descricao: MODOS[t.modo],
    etica: ETICA[t.modo],
    progresso: progresso || 'Nada ainda: é a primeira vez.',
    cenas: lista,
  });
  return [{ role: 'system', content: sistema }, ...historico.slice(-12)];
}

/** Extrai [[cena:id]] da resposta do treinador. */
export function cenaProposta(texto: string): { limpo: string; cena: string | null } {
  const m = texto.match(/\[\[cena:([\w-]+)\]\]/);
  return { limpo: texto.replace(/\s*\[\[cena:[\w-]+\]\]\s*/g, ' ').trim(), cena: m ? m[1] : null };
}
