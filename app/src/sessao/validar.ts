// Parse robusto de JSON vindo de modelo + validação das saídas do personagem e do avaliador.
import type { Avaliacao, Cena, EstadoPersonagem, Expressao, SaidaPersonagem } from '../tipos';

export function extrairJson(texto: string): unknown {
  let t = texto.trim();
  const cerca = t.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (cerca) t = cerca[1].trim();
  const ini = t.indexOf('{');
  const fim = t.lastIndexOf('}');
  if (ini < 0 || fim <= ini) throw new Error('nenhum objeto JSON na resposta');
  return JSON.parse(t.slice(ini, fim + 1));
}

const lim = (n: unknown, padrao: number) => {
  const v = typeof n === 'number' ? n : Number(n);
  return Number.isFinite(v) ? Math.max(0, Math.min(10, Math.round(v))) : padrao;
};

const EXPRESSOES: Expressao[] = ['neutro', 'aberto', 'fechado', 'irritado', 'sorrindo'];

export function validarPersonagem(bruto: unknown, anterior: EstadoPersonagem): SaidaPersonagem {
  const d = (bruto ?? {}) as Record<string, unknown>;
  const fala = typeof d.fala === 'string' ? d.fala.trim() : '';
  if (!fala) throw new Error('campo "fala" vazio');
  const e = (d.estado ?? {}) as Record<string, unknown>;
  const estado = {
    abertura: lim(e.abertura, anterior.abertura),
    paciencia: lim(e.paciencia, anterior.paciencia),
    confianca: lim(e.confianca, anterior.confianca),
  };
  const expressao = EXPRESSOES.includes(d.expressao as Expressao) ? (d.expressao as Expressao) : expressaoDoEstado(estado);
  const fim = d.fim === true;
  const r = d.resultado;
  const resultado = r === 'sucesso' || r === 'fracasso' || r === 'neutro' ? r : fim ? 'neutro' : null;
  return { fala, estado, expressao, fim, resultado };
}

export function expressaoDoEstado(e: EstadoPersonagem): Expressao {
  const m = (e.abertura + e.confianca) / 2;
  if (e.paciencia <= 2) return 'irritado';
  if (m >= 7.5) return 'sorrindo';
  if (m >= 5.5) return 'aberto';
  if (m <= 3) return 'fechado';
  return 'neutro';
}

/** Conexão 0-100 para o termômetro. */
export function conexao(e: EstadoPersonagem): number {
  return Math.round(((e.abertura * 0.45 + e.confianca * 0.35 + e.paciencia * 0.2) / 10) * 100);
}

const SEM_EVIDENCIA = /^(n[ãa]o apareceu|nenhuma|-|n\/a)?$/i;

export function validarAvaliacao(bruto: unknown, cena: Cena): Avaliacao {
  const d = (bruto ?? {}) as Record<string, unknown>;
  let notasIn = (d.notas ?? {}) as Record<string, unknown>;
  let evidIn = (d.evidencias ?? {}) as Record<string, unknown>;
  // Formato "evidência antes da nota": {"analise": [{id, evidencia, nota}]}
  if (Array.isArray(d.analise)) {
    notasIn = {};
    evidIn = {};
    for (const item of d.analise as Record<string, unknown>[]) {
      if (typeof item?.id !== 'string') continue;
      notasIn[item.id] = item.nota;
      evidIn[item.id] = item.evidencia;
    }
  }
  const notas: Record<string, number> = {};
  const evidencias: Record<string, string> = {};
  const descartados: string[] = [];
  let soma = 0;
  let pesos = 0;
  for (const c of cena.criterios) {
    if (!(c.id in notasIn)) throw new Error(`critério "${c.id}" sem nota`);
    const nota = lim(notasIn[c.id], 0);
    const ev = typeof evidIn[c.id] === 'string' ? (evidIn[c.id] as string).trim() : '';
    // Nota alta sem fala citada não vale: vira descartada. "não apareceu" só é aceito com nota baixa.
    if ((!ev || SEM_EVIDENCIA.test(ev)) && nota > 4) {
      descartados.push(c.id);
      continue;
    }
    notas[c.id] = nota;
    evidencias[c.id] = ev || 'não apareceu';
    soma += nota * c.peso;
    pesos += c.peso;
  }
  if (pesos === 0) throw new Error('nenhuma nota com evidência');
  const correcao = typeof d.correcao_unica === 'string' ? d.correcao_unica.trim() : '';
  if (!correcao) throw new Error('sem "correcao_unica"');
  return {
    notas,
    evidencias,
    nota_geral: Math.round((soma / pesos) * 10) / 10,
    ponto_forte: typeof d.ponto_forte === 'string' && d.ponto_forte.trim() ? d.ponto_forte.trim() : 'Você começou, já é o primeiro passo.',
    correcao_unica: correcao,
    descartados,
  };
}
