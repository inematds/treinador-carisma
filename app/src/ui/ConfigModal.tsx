// Onde a IA roda: neste PC (gateway/Ollama/assinatura), no navegador (WebLLM) ou na nuvem (chave/conta do usuário).
import { useEffect, useState } from 'react';
import type { Config, Saude, TipoMotor } from '../config';
import { iniciarLoginOpenRouter, modelosOllama, WEBLLM_MODELOS } from '../motor/motores';
import { exportar, importar } from '../dados/progresso';

interface Props {
  config: Config;
  saude: Saude | null;
  aoSalvar: (c: Config) => void;
  aoFechar: () => void;
}

const MOTORES_GATEWAY: { id: Config['gatewayMotor']; nome: string; desc: string }[] = [
  { id: 'ollama', nome: 'Ollama neste PC', desc: 'Sem API e sem internet. Nada sai do computador.' },
  { id: 'codex', nome: 'Codex — sua assinatura ChatGPT', desc: 'Usa o Codex CLI logado neste PC. Sem chave de API.' },
  { id: 'claude', nome: 'Claude — sua assinatura', desc: 'Usa o Claude Code logado neste PC. Sem chave de API.' },
  { id: 'gemini', nome: 'Gemini — sua conta Google', desc: 'Usa o Gemini CLI logado neste PC.' },
];

export function ConfigModal({ config, saude, aoSalvar, aoFechar }: Props) {
  const [c, setC] = useState<Config>(config);
  const [modelosOl, setModelosOl] = useState<string[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const local = !!saude;

  useEffect(() => {
    if (c.tipo === 'gateway' && c.gatewayMotor === 'ollama') setModelosOl(saude?.motores?.ollama?.modelos ?? []);
    if (c.tipo === 'ollama-direto')
      modelosOllama(c.ollamaUrl)
        .then(setModelosOl)
        .catch(() => {
          setModelosOl([]);
          setMsg(`Não achei o Ollama em ${c.ollamaUrl}. Ele está aberto? Para esta página acessar, rode com OLLAMA_ORIGINS="${location.origin}".`);
        });
  }, [c.tipo, c.gatewayMotor, c.ollamaUrl, saude]);

  const tipo = (t: TipoMotor) => {
    setMsg(null);
    setC({ ...c, tipo: t, modelo: t === c.tipo ? c.modelo : '' });
  };

  const opcoes: { t: TipoMotor; nome: string; desc: string; so?: 'local' | 'nuvem' }[] = [
    ...(local ? [{ t: 'gateway' as TipoMotor, nome: 'Neste PC (Edição Local)', desc: 'Ollama ou sua assinatura Codex / Claude / Gemini, pelo servidor local.' }] : []),
    { t: 'ollama-direto', nome: 'Ollama direto', desc: 'Página aberta na internet falando com o Ollama do seu PC.' },
    { t: 'webllm', nome: 'No navegador (grátis)', desc: 'Modelo pequeno baixado uma vez e rodado na sua placa de vídeo (WebGPU). Sem conta, sem API.' },
    { t: 'openrouter', nome: 'OpenRouter (sua conta)', desc: 'Entre com sua conta e use seus créditos. Muitos modelos.' },
    { t: 'openai', nome: 'OpenAI (sua chave)', desc: 'Chave fica só neste navegador.' },
    { t: 'anthropic', nome: 'Anthropic (sua chave)', desc: 'Chave fica só neste navegador.' },
    { t: 'fake', nome: 'Demonstração', desc: 'Respostas simuladas, para conhecer o app sem IA.' },
  ];

  return (
    <div className="fundo-modal" role="dialog" aria-modal="true" aria-label="Configurar IA" onClick={aoFechar}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="bloco-titulo">
          <h2>Onde a IA roda</h2>
          <button className="btn icone fantasma" onClick={aoFechar} aria-label="Fechar">
            ✕
          </button>
        </div>
        <p className="dica">
          Edição: <b>{local ? `Local (servidor neste PC, v${saude?.versao})` : 'Nuvem (sem servidor local)'}</b>. Para a Edição Local, rode{' '}
          <code>deploy/iniciar.sh</code> e abra o endereço que ele mostrar.
        </p>
        <div className="opcoes-motor">
          {opcoes.map((o) => (
            <button key={o.t} className={`opcao-motor ${c.tipo === o.t ? 'ativo' : ''}`} onClick={() => tipo(o.t)}>
              <span>
                <b>{o.nome}</b>
                <small>{o.desc}</small>
              </span>
            </button>
          ))}
        </div>

        {c.tipo === 'gateway' && (
          <>
            <div className="opcoes-motor">
              {MOTORES_GATEWAY.map((m) => {
                const ok = saude?.motores?.[m.id]?.ok;
                return (
                  <button key={m.id} className={`opcao-motor ${c.gatewayMotor === m.id ? 'ativo' : ''}`} disabled={!ok} onClick={() => setC({ ...c, gatewayMotor: m.id, modelo: '' })}>
                    <span>
                      <b>
                        {m.nome} {ok ? '✓' : '— não encontrado'}
                      </b>
                      <small>{m.desc}</small>
                    </span>
                  </button>
                );
              })}
            </div>
            {c.gatewayMotor === 'ollama' && (
              <Modelo valor={c.modelo} lista={modelosOl} aoMudar={(modelo) => setC({ ...c, modelo })} />
            )}
            {c.gatewayMotor !== 'ollama' && (
              <div className="campo">
                <label>Modelo (opcional — vazio usa o padrão da sua CLI)</label>
                <input value={c.modelo} onChange={(e) => setC({ ...c, modelo: e.target.value })} placeholder="padrão da CLI" />
                <span className="aviso">Pela assinatura cada resposta leva alguns segundos. Para conversa por voz mais fluida, use o Ollama.</span>
              </div>
            )}
            <p className="dica">
              Voz deste PC: ouvir {saude?.stt?.ok ? `✓ ${saude.stt.engine}` : '— usa o navegador'} · falar {saude?.tts?.ok ? `✓ ${saude.tts.engine}` : '— usa o navegador'}
            </p>
          </>
        )}

        {c.tipo === 'ollama-direto' && (
          <>
            <div className="campo">
              <label>Endereço do Ollama</label>
              <input value={c.ollamaUrl} onChange={(e) => setC({ ...c, ollamaUrl: e.target.value })} />
            </div>
            <Modelo valor={c.modelo} lista={modelosOl} aoMudar={(modelo) => setC({ ...c, modelo })} />
          </>
        )}

        {c.tipo === 'webllm' && (
          <div className="campo">
            <label>Modelo no navegador</label>
            <select value={c.modelos.webllm} onChange={(e) => setC({ ...c, modelos: { ...c.modelos, webllm: e.target.value } })}>
              {WEBLLM_MODELOS.map((m) => (
                <option key={m}>{m}</option>
              ))}
            </select>
            <span className="aviso">O primeiro uso baixa 1–2 GB. Precisa de Chrome/Edge com WebGPU. Modelos pequenos interpretam pior; é o modo grátis.</span>
          </div>
        )}

        {c.tipo === 'openrouter' && (
          <>
            <div className="linha">
              <button className="btn principal" onClick={() => iniciarLoginOpenRouter()}>
                Entrar com OpenRouter
              </button>
              <span className="dica">{c.chaves.openrouter ? 'Conta conectada ✓' : 'ou cole uma chave abaixo'}</span>
            </div>
            <Chave rotulo="Chave OpenRouter" valor={c.chaves.openrouter} aoMudar={(v) => setC({ ...c, chaves: { ...c.chaves, openrouter: v } })} />
            <ModeloLivre valor={c.modelos.openrouter} aoMudar={(v) => setC({ ...c, modelos: { ...c.modelos, openrouter: v } })} />
          </>
        )}
        {c.tipo === 'openai' && (
          <>
            <Chave rotulo="Chave OpenAI" valor={c.chaves.openai} aoMudar={(v) => setC({ ...c, chaves: { ...c.chaves, openai: v } })} />
            <ModeloLivre valor={c.modelos.openai} aoMudar={(v) => setC({ ...c, modelos: { ...c.modelos, openai: v } })} />
          </>
        )}
        {c.tipo === 'anthropic' && (
          <>
            <Chave rotulo="Chave Anthropic" valor={c.chaves.anthropic} aoMudar={(v) => setC({ ...c, chaves: { ...c.chaves, anthropic: v } })} />
            <ModeloLivre valor={c.modelos.anthropic} aoMudar={(v) => setC({ ...c, modelos: { ...c.modelos, anthropic: v } })} />
          </>
        )}
        {['openai', 'anthropic', 'openrouter'].includes(c.tipo) && (
          <p className="aviso">Com este motor, o texto da conversa vai para o provedor escolhido. As chaves ficam só neste navegador.</p>
        )}

        <div className="campo">
          <label className="linha">
            <input type="checkbox" style={{ width: 'auto' }} checked={c.vozAuto} onChange={(e) => setC({ ...c, vozAuto: e.target.checked })} />
            Falar as respostas em voz alta
          </label>
          <label className="linha">
            <input type="checkbox" style={{ width: 'auto' }} checked={c.maosLivres} onChange={(e) => setC({ ...c, maosLivres: e.target.checked })} />
            Conversa contínua (microfone aberto, sem botão)
          </label>
          <label className="linha">
            <input type="checkbox" style={{ width: 'auto' }} checked={c.pausaAuto} onChange={(e) => setC({ ...c, pausaAuto: e.target.checked })} />
            O treinador pausa sozinho quando a conversa desanda
          </label>
        </div>

        {msg && <p className="erro">{msg}</p>}

        <div className="linha" style={{ justifyContent: 'space-between', marginTop: 16 }}>
          <div className="linha">
            <button
              className="btn fantasma"
              onClick={async () => {
                const blob = new Blob([await exportar()], { type: 'application/json' });
                const a = document.createElement('a');
                a.href = URL.createObjectURL(blob);
                a.download = 'treinador-carisma-progresso.json';
                a.click();
              }}
            >
              Exportar progresso
            </button>
            <label className="btn fantasma">
              Importar
              <input
                type="file"
                accept="application/json"
                className="sr"
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  try {
                    setMsg(`${await importar(await f.text())} registros importados.`);
                  } catch (err) {
                    setMsg((err as Error).message);
                  }
                }}
              />
            </label>
          </div>
          <button className="btn principal" onClick={() => aoSalvar(c)}>
            Salvar
          </button>
        </div>
      </div>
    </div>
  );
}

function Modelo({ valor, lista, aoMudar }: { valor: string; lista: string[]; aoMudar: (v: string) => void }) {
  return (
    <div className="campo">
      <label>Modelo</label>
      <select value={valor} onChange={(e) => aoMudar(e.target.value)}>
        <option value="">— escolha —</option>
        {lista.map((m) => (
          <option key={m}>{m}</option>
        ))}
      </select>
      <span className="dica">Sugestão: um modelo de 8B ou mais (ex.: qwen3, llama3.1). Modelos muito pequenos interpretam pior.</span>
    </div>
  );
}

function Chave({ rotulo, valor, aoMudar }: { rotulo: string; valor: string; aoMudar: (v: string) => void }) {
  return (
    <div className="campo">
      <label>{rotulo}</label>
      <input type="password" autoComplete="off" value={valor} onChange={(e) => aoMudar(e.target.value.trim())} placeholder="sk-…" />
    </div>
  );
}

function ModeloLivre({ valor, aoMudar }: { valor: string; aoMudar: (v: string) => void }) {
  return (
    <div className="campo">
      <label>Modelo</label>
      <input value={valor} onChange={(e) => aoMudar(e.target.value.trim())} />
    </div>
  );
}
