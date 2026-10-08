// Entrada do usuário: texto ou microfone (gateway Whisper na Edição Local, navegador na Nuvem).
import { useRef, useState } from 'react';
import { ouvirGateway, ouvirNavegador, pararFala, sttNavegadorDisponivel, type Escuta } from '../voz/voz';
import type { Fala } from '../tipos';

interface Props {
  aoEnviar: (texto: string, voz?: Fala['voz']) => void;
  desabilitado?: boolean;
  sttGateway: boolean;
  placeholder?: string;
}

export function BarraFala({ aoEnviar, desabilitado, sttGateway, placeholder }: Props) {
  const [texto, setTexto] = useState('');
  const [ouvindo, setOuvindo] = useState(false);
  const [vol, setVol] = useState(0);
  const [erro, setErro] = useState<string | null>(null);
  const escuta = useRef<Escuta | null>(null);
  const temMic = sttGateway || sttNavegadorDisponivel();

  const enviar = (t = texto, voz?: Fala['voz']) => {
    const limpo = t.trim();
    if (!limpo || desabilitado) return;
    aoEnviar(limpo, voz);
    setTexto('');
  };

  const alternarMic = async () => {
    setErro(null);
    if (ouvindo) {
      escuta.current?.parar();
      return;
    }
    pararFala();
    try {
      escuta.current = sttGateway ? ouvirGateway(setVol) : ouvirNavegador((p) => setTexto(p));
      setOuvindo(true);
      const r = await escuta.current.resultado;
      setOuvindo(false);
      if (r.texto) {
        const pal = r.texto.split(/\s+/).length;
        enviar(r.texto, r.duracao_s > 0.5 ? { duracao_s: r.duracao_s, palavras_min: Math.round((pal / r.duracao_s) * 60) } : undefined);
      }
    } catch (e) {
      setOuvindo(false);
      setErro((e as Error).message);
    }
  };

  return (
    <div>
      <div className="barra-fala">
        {temMic && (
          <button
            type="button"
            className={`mic ${ouvindo ? 'ouvindo' : ''}`}
            style={{ ['--vol' as string]: vol }}
            onClick={alternarMic}
            disabled={desabilitado && !ouvindo}
            aria-label={ouvindo ? 'Parar e enviar' : 'Falar'}
            title={ouvindo ? 'Clique para parar e enviar' : 'Clique e fale'}
          >
            {ouvindo ? (
              <svg width="20" height="20" viewBox="0 0 24 24"><rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor" /></svg>
            ) : (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <rect x="9" y="3" width="6" height="11" rx="3" />
                <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
              </svg>
            )}
          </button>
        )}
        <textarea
          rows={1}
          value={texto}
          placeholder={ouvindo ? 'Ouvindo… clique no quadrado para enviar' : (placeholder ?? 'Escreva sua fala e tecle Enter')}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              enviar();
            }
          }}
          disabled={desabilitado}
          aria-label="Sua fala"
        />
        <button type="button" className="btn principal" onClick={() => enviar()} disabled={desabilitado || !texto.trim()}>
          Enviar
        </button>
      </div>
      {erro && <p className="erro">{erro}</p>}
      {!sttGateway && temMic && <p className="dica">No Chrome/Edge, o reconhecimento de voz do navegador envia o áudio ao serviço de voz do Google.</p>}
    </div>
  );
}
