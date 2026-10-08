// Palco de uma cena: briefing do treinador → conversa com o personagem → pausa → uma correção → refazer.
import { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { nomeCompetencia } from '../cenas/cenas';
import type { Config } from '../config';
import { registrar } from '../dados/progresso';
import type { Motor } from '../motor/tipos';
import { Rosto } from '../rostos/Rosto';
import { metricas } from '../sessao/metricas';
import { Sessao } from '../sessao/sessao';
import { conexao, expressaoDoEstado } from '../sessao/validar';
import { treinador as acharTreinador } from '../treinadores';
import type { Cena, Expressao, Fala } from '../tipos';
import { falar, pararFala } from '../voz/voz';
import { BarraFala } from './BarraFala';

interface Props {
  cena: Cena;
  config: Config;
  motor: Motor;
  vozGateway: boolean;
  sttGateway: boolean;
  aoSair: () => void;
  aoRegistrar: () => void;
}

export function Palco({ cena, config, motor, vozGateway, sttGateway, aoSair, aoRegistrar }: Props) {
  const t = acharTreinador(config.treinador);
  const sessao = useMemo(() => new Sessao(cena, config.alvo, motor), [cena, config.alvo, motor]);
  const [, render] = useReducer((x: number) => x + 1, 0);
  const [pensando, setPensando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [boca, setBoca] = useState(0);
  const [legenda, setLegenda] = useState<{ quem: string; texto: string }>({ quem: t.nome, texto: '' });
  const fimTranscricao = useRef<HTMLDivElement>(null);
  const pers = sessao.id;
  const fonteVoz = vozGateway ? 'gateway' : 'navegador';

  const dizer = (quem: 'treinador' | 'personagem', texto: string) => {
    setLegenda({ quem: quem === 'treinador' ? t.nome : pers.nome, texto });
    if (config.vozAuto) falar(texto, quem === 'treinador' ? t.voz : pers.voz, fonteVoz, setBoca);
  };

  const briefing = `${cena.contexto} Seu objetivo: ${cena.objetivo}${cena.dica_inicial ? ` Dica: ${cena.dica_inicial}` : ''}`;
  useEffect(() => {
    dizer('treinador', briefing);
    return () => pararFala();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessao]);
  useEffect(() => fimTranscricao.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }));

  const comecar = () => {
    pararFala();
    sessao.comecar();
    const primeira = sessao.atual.falas[0];
    if (primeira) dizer('personagem', primeira.texto);
    else setLegenda({ quem: 'Você começa', texto: cena.modo === 'conquista' ? `${pers.nome} está ali. Puxe a conversa.` : 'A primeira fala é sua.' });
    render();
  };

  const enviar = async (texto: string, voz?: Fala['voz']) => {
    setErro(null);
    setPensando(true);
    setLegenda({ quem: 'Você', texto });
    render();
    try {
      const saida = await sessao.falar(texto, voz);
      dizer('personagem', saida.fala);
      render();
      if (saida.fim) await pausar(saida.resultado);
    } catch (e) {
      sessao.atual.falas.pop(); // desfaz a fala do usuário para ele tentar de novo
      setErro((e as Error).message);
    } finally {
      setPensando(false);
      render();
    }
  };

  const pausar = async (resultado?: string | null) => {
    setPensando(true);
    const pendente = sessao.avaliar();
    render();
    const a = await pendente;
    setPensando(false);
    if (a) {
      await registrar({ cena: cena.id, modo: cena.modo, competencia: cena.competencia, quando: Date.now(), tentativa: sessao.atual.n, resultado: resultado ?? sessao.atual.resultado, avaliacao: a });
      aoRegistrar();
    }
    const fala = sessao.falaDaCorrecao(t.nome).replace(/ — .*$/, '');
    const abertura = resultado === 'sucesso' ? 'Boa, você chegou lá! ' : resultado === 'fracasso' ? 'A conversa travou, e tudo bem: é pra isso que serve o ensaio. ' : '';
    dizer('treinador', abertura + fala);
    render();
  };

  const refazer = () => {
    pararFala();
    sessao.refazer();
    const primeira = sessao.atual.falas[0];
    if (primeira) dizer('personagem', primeira.texto);
    else setLegenda({ quem: 'Você começa', texto: 'De novo, agora com a correção.' });
    render();
  };

  const emCena = sessao.fase === 'cena';
  const treinadorNoPalco = sessao.fase === 'briefing' || sessao.fase === 'correcao' || sessao.fase === 'avaliando';
  const ultima = [...sessao.atual.falas].reverse().find((f) => f.quem === 'personagem');
  const expressao: Expressao = ultima?.expressao ?? expressaoDoEstado(sessao.estado);
  const nivelConexao = conexao(sessao.estado);
  const av = sessao.atual.avaliacao;
  const cmp = sessao.comparacao();
  const m = metricas(sessao.atual.falas);

  return (
    <main className="envolve palco" data-modo={config.modo}>
      <section>
        <div className={`cena-palco ${treinadorNoPalco ? 'treinador-em-cena' : ''}`}>
          <div className="faixa-cena">
            <span className="chip">{nomeCompetencia(cena.competencia)}</span>
            <span className="chip">
              nível <span className="nivel">{'●'.repeat(cena.nivel)}</span>
            </span>
            <span className="chip">Tentativa {sessao.atual.n}</span>
            {emCena && (
              <span className="chip">
                fala {sessao.falasUsuario}/{cena.fim.max_falas}
              </span>
            )}
          </div>
          <h1 style={{ textAlign: 'center', fontSize: 'clamp(1.3rem, 3vw, 1.9rem)' }}>{cena.titulo}</h1>
          <div className="rosto-palco">
            {treinadorNoPalco ? (
              <Rosto id={t.id} tamanho={210} boca={boca} expressao={sessao.fase === 'correcao' ? 'aberto' : 'sorrindo'} falando={boca > 0.05} />
            ) : (
              <>
                <Rosto id={pers.rosto} tamanho={210} boca={boca} expressao={expressao} falando={boca > 0.05} />
                <div className="termometro" title={`Conexão: ${nivelConexao}%`} aria-label={`Conexão ${nivelConexao}%`}>
                  <i style={{ height: `${nivelConexao}%` }} />
                </div>
              </>
            )}
          </div>
          <div className="legenda" aria-live="polite">
            <span className="quem">{legenda.quem}</span>
            {pensando && emCena ? (
              <span className="carregando" aria-label="pensando">
                <i />
                <i />
                <i />
              </span>
            ) : (
              legenda.texto
            )}
          </div>

          {sessao.fase === 'briefing' && (
            <div className="linha" style={{ justifyContent: 'center', marginTop: 10 }}>
              <button className="btn principal" onClick={comecar}>
                Entrar na cena com {pers.nome} →
              </button>
            </div>
          )}

          {emCena && (
            <>
              <BarraFala aoEnviar={enviar} desabilitado={pensando || sessao.acabou} sttGateway={sttGateway} placeholder={`Fale com ${pers.nome}…`} />
              <div className="linha" style={{ justifyContent: 'space-between', marginTop: 8 }}>
                <span className="dica">A cena termina sozinha, ou peça a pausa quando quiser.</span>
                <button className="btn" onClick={() => pausar(null)} disabled={pensando || sessao.falasUsuario === 0}>
                  ⏸ Pausa: me avalie
                </button>
              </div>
            </>
          )}
          {sessao.fase === 'avaliando' && (
            <p className="legenda">
              {t.nome.split(' ')[0]} está avaliando…{' '}
              <span className="carregando">
                <i />
                <i />
                <i />
              </span>
            </p>
          )}
          {erro && <p className="erro">{erro}</p>}
        </div>

        <div className="bloco" style={{ marginTop: 14 }}>
          <div className="bloco-titulo">
            <h2>Transcrição</h2>
            <button className="btn fantasma" onClick={aoSair}>
              ← Voltar ao painel
            </button>
          </div>
          <div className="conversa" style={{ maxHeight: 280 }}>
            {sessao.atual.falas.length === 0 && <p className="dica">{briefing}</p>}
            {sessao.atual.falas.map((f, i) => {
              const ev = av && f.quem === 'voce' ? Object.entries(av.evidencias).filter(([, e]) => e.includes(`fala ${sessao.atual.falas.slice(0, i + 1).filter((x) => x.quem === 'voce').length}`)) : [];
              return (
                <div key={i} className={`balao ${f.quem === 'voce' ? 'eu' : 'personagem'}`} style={ev.length ? { outline: '1px solid var(--acento)' } : undefined}>
                  <span className="quem">{f.quem === 'voce' ? 'Você' : pers.nome}</span>
                  {f.texto}
                </div>
              );
            })}
            <div ref={fimTranscricao} />
          </div>
        </div>
      </section>

      <aside className="lado">
        <div className="bloco">
          <span className="rotulo dica">A cena</span>
          <p style={{ margin: '6px 0' }}>{cena.contexto}</p>
          <p style={{ margin: 0 }}>
            <b>Objetivo:</b> {cena.objetivo}
          </p>
        </div>

        {sessao.fase === 'correcao' && (
          <div className="bloco correcao" data-testid="correcao">
            {av ? (
              <>
                <div className="linha" style={{ justifyContent: 'space-between' }}>
                  <span className="rotulo dica">Uma correção</span>
                  <span className="nota-grande" data-testid="nota-geral">
                    {av.nota_geral.toFixed(1)}
                  </span>
                </div>
                <p className="grande">{av.correcao_unica}</p>
                <p className="dica">✓ {av.ponto_forte}</p>
              </>
            ) : (
              <p className="erro">{sessao.erro}</p>
            )}
            <div className="linha" style={{ marginTop: 10 }}>
              <button className="btn principal" onClick={refazer}>
                ↻ Refazer a cena
              </button>
              <button className="btn" onClick={aoSair}>
                Outra cena
              </button>
            </div>
          </div>
        )}

        {av && (
          <div className="bloco">
            <div className="bloco-titulo">
              <h2>Notas</h2>
              {cmp.length > 0 && <span className="chip">comparado à tentativa anterior</span>}
            </div>
            {cena.criterios.map((c) => {
              const nota = av.notas[c.id];
              const antes = cmp.find((x) => x.id === c.id)?.antes;
              return (
                <div key={c.id} className="nota-linha" data-criterio={c.id}>
                  <span>{c.nome}</span>
                  <b>
                    {nota ?? '—'}
                    {antes !== undefined && antes !== null && nota !== undefined && nota !== antes && (
                      <span className={nota > antes ? 'seta-sobe' : 'seta-desce'}>
                        {' '}
                        {nota > antes ? '▲' : '▼'} {antes}
                      </span>
                    )}
                  </b>
                  <div className="barra-nota">
                    <i style={{ width: `${(nota ?? 0) * 10}%` }} />
                  </div>
                  <span className="ev">{av.evidencias[c.id] ?? 'sem evidência — nota descartada'}</span>
                </div>
              );
            })}
          </div>
        )}

        {sessao.falasUsuario > 0 && (
          <div className="bloco">
            <span className="rotulo dica">Sua fala, em números</span>
            <div className="nota-linha">
              <span>Palavras por fala</span>
              <b>{m.palavras_por_fala}</b>
            </div>
            <div className="nota-linha">
              <span>Você falou</span>
              <b>{m.proporcao_fala}% do tempo</b>
            </div>
            <div className="nota-linha">
              <span>Perguntas (abertas)</span>
              <b>
                {m.perguntas} ({m.perguntas_abertas})
              </b>
            </div>
            {m.palavras_min !== null && (
              <div className="nota-linha">
                <span>Ritmo</span>
                <b>{m.palavras_min} palavras/min</b>
              </div>
            )}
            {Object.keys(m.vicios).length > 0 && (
              <div className="nota-linha">
                <span>Vícios</span>
                <b>
                  {Object.entries(m.vicios)
                    .map(([k, v]) => `"${k}" ×${v}`)
                    .join(', ')}
                </b>
              </div>
            )}
          </div>
        )}
      </aside>
    </main>
  );
}
