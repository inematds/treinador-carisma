// Painel: conversa livre com o(a) treinador(a) + lista de cenas + radar de progresso.
import { useEffect, useRef, useState } from 'react';
import { CENAS, COMPETENCIAS, nomeCompetencia } from '../cenas/cenas';
import type { Config } from '../config';
import { melhorPorCena, porCompetencia, resumoParaTreinador, type Registro } from '../dados/progresso';
import type { Motor } from '../motor/tipos';
import { Rosto } from '../rostos/Rosto';
import { cenaProposta, identidade, msgsTreinador } from '../sessao/prompts';
import { treinador as acharTreinador } from '../treinadores';
import { falar, pararFala } from '../voz/voz';
import { BarraFala } from './BarraFala';
import { Radar } from './Radar';

interface Props {
  config: Config;
  motor: Motor;
  registros: Registro[];
  vozGateway: boolean;
  sttGateway: boolean;
  aoAbrirCena: (id: string) => void;
}

interface Linha {
  role: 'user' | 'assistant';
  content: string;
  cena?: string | null;
}

export function Painel({ config, motor, registros, vozGateway, sttGateway, aoAbrirCena }: Props) {
  const t = acharTreinador(config.treinador);
  const [linhas, setLinhas] = useState<Linha[]>([]);
  const [pensando, setPensando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [boca, setBoca] = useState(0);
  const fim = useRef<HTMLDivElement>(null);
  const cenas = CENAS.filter((c) => c.modo === config.modo);
  const melhor = melhorPorCena(registros);

  useEffect(() => {
    setLinhas([
      {
        role: 'assistant',
        content:
          config.modo === 'carisma'
            ? `Oi, eu sou ${t.nome.split(' ')[0]}. Me conta: qual conversa anda te travando no trabalho? Ou escolha uma cena ao lado e a gente começa.`
            : `Oi, eu sou ${t.nome}. Aqui a gente treina conversa de verdade: com respeito, leveza e sem fórmula pronta. Quer começar puxando um papo num café?`,
        cena: config.modo === 'conquista' ? 'cafe-abertura' : null,
      },
    ]);
  }, [config.modo, config.treinador, t.nome]);

  useEffect(() => fim.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), [linhas, pensando]);
  useEffect(() => () => pararFala(), []);

  const enviar = async (texto: string) => {
    setErro(null);
    const historico = [...linhas, { role: 'user' as const, content: texto }];
    setLinhas(historico);
    setPensando(true);
    try {
      let resposta = '';
      const msgs = msgsTreinador(t, CENAS, resumoParaTreinador(registros, config.modo), historico.map(({ role, content }) => ({ role, content })));
      setLinhas([...historico, { role: 'assistant', content: '' }]);
      for await (const pedaco of motor.chat(msgs, { temperatura: 0.7 })) {
        resposta += pedaco;
        setLinhas([...historico, { role: 'assistant', content: cenaProposta(resposta).limpo }]);
      }
      const { limpo, cena } = cenaProposta(resposta);
      const valida = cena && cenas.some((c) => c.id === cena) ? cena : null;
      setLinhas([...historico, { role: 'assistant', content: limpo, cena: valida }]);
      if (config.vozAuto) falar(limpo, t.voz, vozGateway ? 'gateway' : 'navegador', setBoca);
    } catch (e) {
      setErro((e as Error).message);
      setLinhas(historico);
    } finally {
      setPensando(false);
    }
  };

  const comp = porCompetencia(registros, config.modo);

  return (
    <main className="envolve painel" data-modo={config.modo}>
      <section className="bloco">
        <div className="bloco-titulo">
          <div className="linha">
            <Rosto id={t.id} tamanho={64} boca={boca} expressao="sorrindo" falando={boca > 0.05} />
            <span>
              <h2>{t.nome}</h2>
              <span className="dica">{t.titulo}</span>
            </span>
          </div>
        </div>
        <div className="conversa" aria-live="polite">
          {linhas.map((l, i) => (
            <div key={i} className={`balao ${l.role === 'user' ? 'eu' : 'treinador'}`}>
              <span className="quem">{l.role === 'user' ? 'Você' : t.nome.split(' ')[0]}</span>
              {l.content || (pensando && i === linhas.length - 1 ? '…' : '')}
              {l.cena && (
                <div style={{ marginTop: 8 }}>
                  <button className="btn principal" onClick={() => aoAbrirCena(l.cena!)}>
                    Ensaiar: {CENAS.find((c) => c.id === l.cena)?.titulo} →
                  </button>
                </div>
              )}
            </div>
          ))}
          {pensando && linhas[linhas.length - 1]?.role === 'user' && (
            <div className="balao treinador">
              <span className="carregando">
                <i />
                <i />
                <i />
              </span>
            </div>
          )}
          <div ref={fim} />
        </div>
        {erro && <p className="erro">{erro}</p>}
        <BarraFala aoEnviar={enviar} desabilitado={pensando} sttGateway={sttGateway} placeholder={`Fale com ${t.nome.split(' ')[0]}…`} />
      </section>

      <section className="lado">
        <div className="bloco">
          <div className="bloco-titulo">
            <h2>Seu progresso</h2>
            <span className="chip">{registros.filter((r) => r.modo === config.modo).length} tentativas</span>
          </div>
          <div style={{ display: 'grid', placeItems: 'center' }}>
            <Radar eixos={COMPETENCIAS[config.modo]} valores={comp} />
          </div>
        </div>
        <div className="bloco">
          <div className="bloco-titulo">
            <h2>Cenas</h2>
            <span className="dica">{cenas.length} cenas</span>
          </div>
          {COMPETENCIAS[config.modo].map((cp) => {
            const doGrupo = cenas.filter((c) => c.competencia === cp.id);
            if (!doGrupo.length) return null;
            return (
              <div key={cp.id}>
                <div className="competencia-titulo">{nomeCompetencia(cp.id)}</div>
                <div className="lista-cenas">
                  {doGrupo.map((c) => {
                    const id = identidade(c, config.alvo);
                    return (
                      <button key={c.id} className="cena-item" onClick={() => aoAbrirCena(c.id)} data-cena={c.id}>
                        <Rosto id={id.rosto} tamanho={44} />
                        <span>
                          <span className="t">{c.titulo}</span>
                          <br />
                          <span className="s">
                            com {id.nome} · <span className="nivel">{'●'.repeat(c.nivel)}{'○'.repeat(3 - c.nivel)}</span>
                          </span>
                        </span>
                        <span className="nota-mini">{melhor[c.id] !== undefined ? melhor[c.id].toFixed(1) : '—'}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </main>
  );
}
