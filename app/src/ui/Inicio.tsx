// Primeira tela: modo → treinador(a) → (conquista) quem você aborda → onde a IA roda.
import type { Config } from '../config';
import { Rosto } from '../rostos/Rosto';
import { TREINADORES } from '../treinadores';
import type { Modo } from '../tipos';

interface Props {
  config: Config;
  rotuloMotor: string;
  aoMudar: (c: Config) => void;
  aoConfigurar: () => void;
  aoComecar: () => void;
}

const MODOS: { id: Modo; nome: string; rotulo: string; desc: string }[] = [
  {
    id: 'carisma',
    nome: 'Carisma',
    rotulo: 'trabalho e vida social',
    desc: 'Liderar, negociar, apresentar, dizer não, dar feedback difícil e fazer networking.',
  },
  {
    id: 'conquista',
    nome: 'Conquista',
    rotulo: 'atração e relacionamento',
    desc: 'Puxar conversa, flertar com leveza, ler o interesse do outro, convidar sem pressão e lidar com um "não".',
  },
];

export function Inicio({ config, rotuloMotor, aoMudar, aoConfigurar, aoComecar }: Props) {
  const treinadores = TREINADORES.filter((t) => t.modo === config.modo);
  const escolherModo = (m: Modo) => {
    const t = TREINADORES.find((x) => x.modo === m)!;
    aoMudar({ ...config, modo: m, treinador: t.id });
  };
  return (
    <main className="envolve" data-modo={config.modo}>
      <section className="heroi">
        <h1>
          Carisma não se assiste.
          <br />
          <em>Se ensaia.</em>
        </h1>
        <p>
          Converse com um(a) treinador(a), entre em cenas reais, receba <b>uma</b> correção por vez e refaça até ficar natural. Por texto ou por voz.
        </p>
      </section>

      <div className="passo">
        <b>1</b>
        <span>O que você quer treinar?</span>
      </div>
      <div className="grade-2">
        {MODOS.map((m) => (
          <button key={m.id} className={`cartao ${config.modo === m.id ? 'ativo' : ''}`} onClick={() => escolherModo(m.id)} aria-pressed={config.modo === m.id}>
            <span className="rotulo">{m.rotulo}</span>
            <h3>{m.nome}</h3>
            <p>{m.desc}</p>
          </button>
        ))}
      </div>

      <div className="passo">
        <b>2</b>
        <span>Quem vai te treinar?</span>
      </div>
      <div className="grade-2">
        {treinadores.map((t) => (
          <button
            key={t.id}
            className={`cartao treinador-cartao ${config.treinador === t.id ? 'ativo' : ''}`}
            onClick={() => aoMudar({ ...config, treinador: t.id })}
            aria-pressed={config.treinador === t.id}
          >
            <Rosto id={t.id} tamanho={92} expressao="sorrindo" />
            <span>
              <span className="rotulo">{t.titulo}</span>
              <h3>{t.nome}</h3>
              <p>{t.estilo}</p>
            </span>
          </button>
        ))}
      </div>

      {config.modo === 'conquista' && (
        <>
          <div className="passo">
            <b>3</b>
            <span>Nas cenas, você vai conversar com…</span>
          </div>
          <div className="grade-2">
            {(['mulher', 'homem'] as const).map((a) => (
              <button key={a} className={`cartao ${config.alvo === a ? 'ativo' : ''}`} onClick={() => aoMudar({ ...config, alvo: a })} aria-pressed={config.alvo === a}>
                <h3>{a === 'mulher' ? 'Uma mulher' : 'Um homem'}</h3>
                <p>Dá para trocar depois, a qualquer momento.</p>
              </button>
            ))}
          </div>
        </>
      )}

      <div className="rodape-inicio">
        <span>
          IA: <b>{rotuloMotor}</b>{' '}
          <button className="btn fantasma" onClick={aoConfigurar}>
            Trocar
          </button>
        </span>
        <button className="btn principal" onClick={aoComecar}>
          Começar o treino →
        </button>
      </div>
    </main>
  );
}
