import { useEffect, useMemo, useState } from 'react';
import { cenaPorId } from './cenas/cenas';
import { criarMotor, detectarGateway, lerConfig, motorPronto, salvarConfig, type Config, type Saude } from './config';
import { carregar, type Registro } from './dados/progresso';
import { concluirLoginOpenRouter } from './motor/motores';
import { treinador } from './treinadores';
import { ConfigModal } from './ui/ConfigModal';
import { Inicio } from './ui/Inicio';
import { Painel } from './ui/Painel';
import { Palco } from './ui/Palco';
import { VERSAO } from './versao';

/** Escolhe o melhor motor do gateway: Ollama com um modelo bom, senão Codex. */
function motorDoGateway(s: Saude): Pick<Config, 'gatewayMotor' | 'modelo'> {
  const modelos = s.motores?.ollama?.ok ? (s.motores.ollama.modelos ?? []) : [];
  const preferidos = ['qwen3:30b', 'qwen3.6:35b-a3b', 'qwen3.8:27b', 'qwen2.5:14b', 'llama3.1:8b'];
  const m = preferidos.find((p) => modelos.includes(p)) ?? modelos.find((x) => !/embed|bge/i.test(x));
  if (m) return { gatewayMotor: 'ollama', modelo: m };
  if (s.motores?.codex?.ok) return { gatewayMotor: 'codex', modelo: '' };
  return { gatewayMotor: 'ollama', modelo: '' };
}

export function App() {
  const forcarFake = new URLSearchParams(location.search).get('motor') === 'fake';
  const [config, setConfig] = useState<Config>(() => (forcarFake ? { ...lerConfig(), tipo: 'fake' } : lerConfig()));
  const [saude, setSaude] = useState<Saude | null>(null);
  const [verConfig, setVerConfig] = useState(false);
  const [cenaId, setCenaId] = useState<string | null>(null);
  const [registros, setRegistros] = useState<Registro[]>([]);
  const [progressoWebllm, setProgressoWebllm] = useState('');
  const [aviso, setAviso] = useState<string | null>(null);

  const mudar = (c: Config) => {
    setConfig(c);
    if (!forcarFake) salvarConfig(c);
  };

  useEffect(() => {
    carregar().then((r) => setRegistros([...r]));
    detectarGateway().then((s) => {
      setSaude(s);
      if (s && !forcarFake && (config.tipo === 'fake' || config.tipo === 'gateway') && !config.modelo) mudar({ ...config, tipo: 'gateway', ...motorDoGateway(s) });
    });
    concluirLoginOpenRouter()
      .then((chave) => chave && mudar({ ...lerConfig(), tipo: 'openrouter', chaves: { ...lerConfig().chaves, openrouter: chave } }))
      .catch((e) => setAviso((e as Error).message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const motor = useMemo(() => criarMotor(config, setProgressoWebllm), [config]);
  const cena = cenaId ? cenaPorId(cenaId) : undefined;
  const falta = motorPronto(config);
  const vozGateway = config.tipo === 'gateway' && !!saude?.tts?.ok;
  const sttGateway = config.tipo === 'gateway' && !!saude?.stt?.ok;
  const t = treinador(config.treinador);

  const abrirCena = (id: string) => {
    if (falta) {
      setVerConfig(true);
      return;
    }
    setCenaId(id);
    scrollTo({ top: 0 });
  };

  return (
    <div data-modo={config.modo}>
      <header className="topo">
        <div className="envolve">
          <button className="marca btn fantasma" style={{ border: 'none', padding: 0 }} onClick={() => mudar({ ...config, iniciado: false })} aria-label="Início">
            <span className="ponto" />
            Treinador de Carisma
          </button>
          {config.iniciado && (
            <span className="chip" title="Modo e treinador(a)">
              {config.modo === 'carisma' ? 'Carisma' : 'Conquista'} · {t.nome.split(' ')[0]}
              {config.modo === 'conquista' && (
                <button
                  className="btn fantasma"
                  style={{ padding: '0 4px', border: 'none', fontSize: '0.8rem' }}
                  onClick={() => mudar({ ...config, alvo: config.alvo === 'mulher' ? 'homem' : 'mulher' })}
                  title="Trocar com quem você conversa nas cenas"
                >
                  · com {config.alvo === 'mulher' ? 'mulher' : 'homem'} ⇄
                </button>
              )}
            </span>
          )}
          <span className="espaco" />
          <span className={`chip ${motor.externo ? 'externo' : ''}`} title={motor.externo ? 'O texto da conversa sai deste computador' : 'Roda localmente'}>
            {motor.rotulo}
          </span>
          <button className="btn icone" onClick={() => setVerConfig(true)} aria-label="Configurar IA" title="Onde a IA roda">
            ⚙
          </button>
        </div>
      </header>

      {aviso && (
        <div className="envolve">
          <p className="erro">{aviso}</p>
        </div>
      )}
      {progressoWebllm && config.tipo === 'webllm' && (
        <div className="envolve">
          <p className="aviso">{progressoWebllm}</p>
        </div>
      )}

      {!config.iniciado ? (
        <Inicio
          config={config}
          rotuloMotor={motor.rotulo}
          aoMudar={mudar}
          aoConfigurar={() => setVerConfig(true)}
          aoComecar={() => (falta ? setVerConfig(true) : mudar({ ...config, iniciado: true }))}
        />
      ) : cena ? (
        <Palco
          key={`${cena.id}-${config.alvo}`}
          cena={cena}
          config={config}
          motor={motor}
          vozGateway={vozGateway}
          sttGateway={sttGateway}
          aoSair={() => setCenaId(null)}
          aoRegistrar={() => carregar().then((r) => setRegistros([...r]))}
        />
      ) : (
        <Painel config={config} motor={motor} registros={registros} vozGateway={vozGateway} sttGateway={sttGateway} aoAbrirCena={abrirCena} />
      )}

      {verConfig && (
        <ConfigModal
          config={config}
          saude={saude}
          aoFechar={() => setVerConfig(false)}
          aoSalvar={(c) => {
            mudar(c);
            setVerConfig(false);
          }}
        />
      )}

      <footer className="rodape">
        Treinador de Carisma v{VERSAO} · código aberto (MIT) — copie, ajuste e use como quiser · <a href="../guia/">guia</a> ·{' '}
        <a href="https://github.com/inematds/treinador-carisma">GitHub</a> · INEMA.CLUB
      </footer>
    </div>
  );
}
