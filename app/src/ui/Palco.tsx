// Palco de uma cena: briefing do treinador → conversa com o personagem → pausa → uma correção → refazer.
// Conversa contínua (mãos-livres): microfone aberto, resposta em streaming frase a frase, interrupção.
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
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
import type { FilaFala } from '../voz/falante';
import { MicrofoneContinuo, type FalaOuvida } from '../voz/microfone';
import { abrirFila, escutaContinuaNavegador, falar, liberarAudio, pararFala, sttNavegadorDisponivel } from '../voz/voz';
import { escolherVoz, type EnginesTts } from '../voz/vozes';
import { BarraFala } from './BarraFala';

interface Props {
  cena: Cena;
  config: Config;
  motor: Motor;
  vozes: EnginesTts | null;
  sttGateway: boolean;
  aoSair: () => void;
  aoRegistrar: () => void;
  aoMudarConfig: (c: Config) => void;
}

type EstadoVoz = 'parado' | 'ouvindo' | 'pensando' | 'falando';

declare global {
  interface Window {
    /** latências medidas no navegador (ms do fim da sua fala até a 1ª frase soar) — evidência de teste */
    __tcLatencias?: number[];
  }
}

export function Palco({ cena, config, motor, vozes, sttGateway, aoSair, aoRegistrar, aoMudarConfig }: Props) {
  const t = acharTreinador(config.treinador);
  const sessao = useMemo(() => new Sessao(cena, config.alvo, motor), [cena, config.alvo, motor]);
  const [, render] = useReducer((x: number) => x + 1, 0);
  const [pensando, setPensando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [boca, setBoca] = useState(0);
  const [legenda, setLegenda] = useState<{ quem: string; texto: string }>({ quem: t.nome, texto: '' });
  const [estadoVoz, setEstadoVoz] = useState<EstadoVoz>('parado');
  const [parcial, setParcial] = useState('');
  const [volMic, setVolMic] = useState(0);
  const [ultimaLatencia, setUltimaLatencia] = useState<number | null>(null);
  const fimTranscricao = useRef<HTMLDivElement>(null);
  const fila = useRef<FilaFala | null>(null);
  const geracao = useRef<AbortController | null>(null);
  const fimPersonagem = useRef<number | null>(null);
  const ocupado = useRef(false);
  /** número do turno atual; uma interrupção abre outro e o turno velho não mexe mais no estado */
  const turno = useRef(0);
  const pers = sessao.id;
  const vozTreinador = escolherVoz(t.voz, t.id, vozes);
  const vozPersonagem = escolherVoz(pers.voz, pers.nome, vozes);
  // mãos-livres: Whisper do gateway (com interrupção) ou reconhecimento do navegador (sem interrupção)
  const podeMaosLivres = sttGateway || sttNavegadorDisponivel();
  const maosLivres = config.maosLivres && podeMaosLivres;

  const dizer = (quem: 'treinador' | 'personagem', texto: string): Promise<void> => {
    setLegenda({ quem: quem === 'treinador' ? t.nome : pers.nome, texto });
    if (!config.vozAuto) return Promise.resolve();
    return falar(texto, quem === 'treinador' ? vozTreinador : vozPersonagem, setBoca);
  };

  const briefing = `${cena.contexto} Seu objetivo: ${cena.objetivo}${cena.dica_inicial ? ` Dica: ${cena.dica_inicial}` : ''}`;
  useEffect(() => {
    dizer('treinador', briefing);
    return () => pararFala();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessao]);
  useEffect(() => fimTranscricao.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }));

  const aposPersonagemFalar = () => {
    fimPersonagem.current = performance.now();
  };

  const comecar = async () => {
    liberarAudio();
    pararFala();
    sessao.comecar();
    render();
    const primeira = sessao.atual.falas[0];
    if (primeira) {
      setEstadoVoz('falando');
      await dizer('personagem', primeira.texto);
      aposPersonagemFalar();
    } else setLegenda({ quem: 'Você começa', texto: cena.modo === 'conquista' ? `${pers.nome} está ali. Puxe a conversa.` : 'A primeira fala é sua.' });
    setEstadoVoz(maosLivres ? 'ouvindo' : 'parado');
  };

  const pausar = async (resultado?: string | null, motivo?: string) => {
    setPensando(true);
    setEstadoVoz('parado');
    const pendente = sessao.avaliar();
    render();
    const a = await pendente;
    setPensando(false);
    if (a) {
      await registrar({ cena: cena.id, modo: cena.modo, competencia: cena.competencia, quando: Date.now(), tentativa: sessao.atual.n, resultado: resultado ?? sessao.atual.resultado, avaliacao: a });
      aoRegistrar();
    }
    const fala = sessao.falaDaCorrecao(t.nome).replace(/ — .*$/, '');
    const abertura = motivo
      ? `Pausa: ${motivo}. `
      : resultado === 'sucesso'
        ? 'Boa, você chegou lá! '
        : resultado === 'fracasso'
          ? 'A conversa travou, e tudo bem: é pra isso que serve o ensaio. '
          : '';
    render();
    await dizer('treinador', abertura + fala.replace(/^Pausa\. /, motivo ? '' : 'Pausa. '));
  };

  /** Sua fala (digitada, pelo botão do microfone ou mãos-livres) → personagem responde em streaming. */
  const enviar = async (texto: string, voz?: Fala['voz'], fimSom?: number) => {
    if (ocupado.current) return;
    ocupado.current = true;
    const meu = ++turno.current;
    const vigente = () => turno.current === meu;
    setErro(null);
    setPensando(true);
    setEstadoVoz('pensando');
    setParcial('');
    setLegenda({ quem: 'Você', texto });
    const ctrl = new AbortController();
    geracao.current = ctrl;
    let dito = '';
    let primeira = true;
    const f = config.vozAuto
      ? abrirFila(vozPersonagem, setBoca, (i) => {
          setEstadoVoz('falando');
          if (i === 0 && fimSom !== undefined) {
            const ms = Math.round(performance.now() - fimSom);
            setUltimaLatencia(ms);
            (window.__tcLatencias ??= []).push(ms);
            console.info(`[tc-latencia] ${ms} ms`);
          }
        })
      : null;
    fila.current = f;
    render();
    try {
      const saida = await sessao.falarStream(
        texto,
        voz,
        (frase) => {
          dito += (dito ? ' ' : '') + frase;
          setLegenda({ quem: pers.nome, texto: dito });
          if (primeira) {
            primeira = false;
            setPensando(false);
          }
          f?.adicionar(frase);
        },
        ctrl.signal,
      );
      if (geracao.current === ctrl) geracao.current = null; // o texto acabou; daqui em diante só a voz
      f?.fechar();
      render();
      if (!saida) return; // interrompido
      setPensando(false);
      if (f) await f.terminou;
      if (ctrl.signal.aborted || !vigente()) return;
      aposPersonagemFalar();
      if (saida.fim) await pausar(saida.resultado);
      else {
        const motivo = config.pausaAuto ? sessao.alertaPausa() : null;
        if (motivo) await pausar(null, motivo);
      }
    } catch (e) {
      if (vigente()) setErro((e as Error).message);
    } finally {
      if (geracao.current === ctrl) geracao.current = null;
      if (fila.current === f) fila.current = null;
    }
    if (vigente()) {
      ocupado.current = false;
      setPensando(false);
      setEstadoVoz((v) => (v === 'parado' ? v : maosLivres && sessao.fase === 'cena' && !sessao.acabou ? 'ouvindo' : 'parado'));
    }
    render();
  };

  /** Você começou a falar: se o personagem estava falando ou pensando, ele para. */
  const interromper = useCallback(() => {
    const falandoAgora = fila.current?.falando;
    const gerando = !!geracao.current && !geracao.current.signal.aborted;
    if (!falandoAgora && !gerando) return;
    const dito = fila.current?.parar();
    geracao.current?.abort();
    if (falandoAgora && !gerando) sessao.marcarInterrupcao(dito);
    turno.current++;
    ocupado.current = false;
    setPensando(false);
    setEstadoVoz('ouvindo');
    render();
  }, [sessao]);

  // Microfone contínuo enquanto a cena roda no modo mãos-livres.
  const emCenaAtiva = sessao.fase === 'cena' && !sessao.acabou;
  const enviarRef = useRef(enviar);
  enviarRef.current = enviar;
  useEffect(() => {
    if (!maosLivres || !emCenaAtiva) return;
    const aoFalar = (f: FalaOuvida | { texto: string; duracao_s: number; inicio: number; pausas?: number; espera_stt_ms?: number }) => {
      const pal = f.texto.split(/\s+/).length;
      const resp = fimPersonagem.current !== null && f.inicio > fimPersonagem.current ? (f.inicio - fimPersonagem.current) / 1000 : undefined;
      const voz: Fala['voz'] =
        f.duracao_s > 0.5
          ? { duracao_s: Math.round(f.duracao_s * 10) / 10, palavras_min: Math.round((pal / f.duracao_s) * 60), pausas: f.pausas ?? 0, tempo_resposta_s: resp !== undefined ? Math.round(resp * 10) / 10 : undefined }
          : undefined;
      const fimSom = 'espera_stt_ms' in f && f.espera_stt_ms !== undefined ? performance.now() - f.espera_stt_ms : undefined;
      enviarRef.current(f.texto, voz, fimSom);
    };
    if (sttGateway) {
      const mic = new MicrofoneContinuo({
        aoComecar: () => {
          interromper();
          setEstadoVoz('ouvindo');
        },
        aoVolume: setVolMic,
        aoParcial: setParcial,
        aoFalar,
        aoErro: (e) => setErro(e.message),
      });
      // enquanto o personagem fala, o limiar sobe (o eco que escapa do cancelamento não dispara)
      const iv = setInterval(() => (mic.vad.sensibilidade = fila.current?.falando ? 2.2 : 1), 100);
      mic.ligar().catch((e) => setErro(`microfone: ${(e as Error).message}`));
      setEstadoVoz((v) => (v === 'parado' ? 'ouvindo' : v));
      return () => {
        clearInterval(iv);
        mic.desligar();
      };
    }
    const esc = escutaContinuaNavegador(aoFalar, setParcial);
    escutaNavegador.current = esc;
    return () => {
      escutaNavegador.current = null;
      esc.parar();
    };
  }, [maosLivres, emCenaAtiva, sttGateway, interromper]);
  // No navegador não há interrupção: só escuta quando o personagem não está pensando nem falando.
  const escutaNavegador = useRef<{ pausar(p: boolean): void } | null>(null);
  useEffect(() => escutaNavegador.current?.pausar(estadoVoz !== 'ouvindo'), [estadoVoz]);

  const refazer = async () => {
    pararFala();
    sessao.refazer();
    fimPersonagem.current = null;
    render();
    const primeira = sessao.atual.falas[0];
    if (primeira) {
      setEstadoVoz('falando');
      await dizer('personagem', primeira.texto);
      aposPersonagemFalar();
    } else setLegenda({ quem: 'Você começa', texto: 'De novo, agora com a correção.' });
    setEstadoVoz(maosLivres ? 'ouvindo' : 'parado');
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
              {maosLivres ? (
                <div className={`maos-livres ${estadoVoz}`} data-testid="maos-livres" style={{ ['--vol' as string]: volMic }}>
                  <span className="onda" aria-hidden="true" />
                  <span className="estado-voz" data-estado={estadoVoz}>
                    {estadoVoz === 'ouvindo'
                      ? parcial || 'Ouvindo… fale quando quiser'
                      : estadoVoz === 'pensando'
                        ? `${pers.nome} está pensando…`
                        : estadoVoz === 'falando'
                          ? sttGateway
                            ? `${pers.nome} está falando — fale por cima para interromper`
                            : `${pers.nome} está falando…`
                          : 'Microfone em pausa'}
                  </span>
                </div>
              ) : (
                <BarraFala aoEnviar={(txt, v) => enviar(txt, v)} desabilitado={pensando || sessao.acabou} sttGateway={sttGateway} placeholder={`Fale com ${pers.nome}…`} />
              )}
              <div className="linha" style={{ justifyContent: 'space-between', marginTop: 8, gap: 8, flexWrap: 'wrap' }}>
                <label className="dica alternar" title={podeMaosLivres ? 'Microfone aberto o tempo todo, sem botão' : 'Este navegador não reconhece voz'}>
                  <input
                    type="checkbox"
                    checked={maosLivres}
                    disabled={!podeMaosLivres}
                    onChange={(e) => {
                      liberarAudio();
                      aoMudarConfig({ ...config, maosLivres: e.target.checked });
                    }}
                    data-testid="alternar-maos-livres"
                  />{' '}
                  Conversa contínua (mãos-livres)
                </label>
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
            {m.tempo_resposta_s !== null && (
              <div className="nota-linha">
                <span>Tempo para responder</span>
                <b>{m.tempo_resposta_s.toFixed(1)} s</b>
              </div>
            )}
            {m.pausas > 0 && (
              <div className="nota-linha">
                <span>Pausas no meio da fala</span>
                <b>{m.pausas}</b>
              </div>
            )}
            {m.interrupcoes > 0 && (
              <div className="nota-linha">
                <span>Você interrompeu</span>
                <b>{m.interrupcoes}×</b>
              </div>
            )}
            {ultimaLatencia !== null && (
              <div className="nota-linha" data-testid="latencia">
                <span>Resposta do personagem</span>
                <b>{(ultimaLatencia / 1000).toFixed(2)} s</b>
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
