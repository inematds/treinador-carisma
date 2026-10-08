// Rosto ilustrado em SVG: expressão + boca animada (0..1) para sincronizar com a voz.
import { memo, useId } from 'react';
import type { Expressao } from '../tipos';
import { rosto, type ParamRosto } from './catalogo';

function tom(hex: string, f: number): string {
  const n = parseInt(hex.slice(1), 16);
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(f < 0 ? v * (1 + f) : v + (255 - v) * f)));
  return `#${[(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => c(v).toString(16).padStart(2, '0')).join('')}`;
}

const EXP: Record<Expressao, { sobrancelha: number; angulo: number; curva: number; olho: number }> = {
  neutro: { sobrancelha: 0, angulo: 0, curva: 0.15, olho: 1 },
  aberto: { sobrancelha: 3, angulo: -2, curva: 0.45, olho: 1.05 },
  fechado: { sobrancelha: -2, angulo: 2, curva: -0.15, olho: 0.8 },
  irritado: { sobrancelha: -3, angulo: 9, curva: -0.4, olho: 0.85 },
  sorrindo: { sobrancelha: 2, angulo: -3, curva: 0.9, olho: 0.72 },
};

function CabeloAtras({ p }: { p: ParamRosto }) {
  const c = p.cabelo.cor;
  switch (p.cabelo.estilo) {
    case 'longo':
      return <path d="M56 92 C52 34 148 34 144 92 L150 176 C128 186 72 186 50 176 Z" fill={tom(c, -0.15)} />;
    case 'ondulado':
      return (
        <path
          d="M56 90 C50 30 150 30 144 90 C152 110 140 122 150 140 C158 156 142 170 148 184 C120 192 80 192 52 184 C58 170 42 156 50 140 C60 122 48 110 56 90 Z"
          fill={tom(c, -0.15)}
        />
      );
    case 'chanel':
      return <path d="M56 92 C52 36 148 36 144 92 L148 132 C130 140 70 140 52 132 Z" fill={tom(c, -0.15)} />;
    case 'cacheado':
      return (
        <g fill={tom(c, -0.1)}>
          {[
            [62, 60], [78, 44], [100, 38], [122, 44], [138, 60], [146, 82], [54, 82], [148, 104], [52, 104], [142, 124], [58, 124],
          ].map(([x, y], i) => (
            <circle key={i} cx={x} cy={y} r={17} />
          ))}
        </g>
      );
    case 'rabo':
      return <path d="M136 70 C162 76 166 120 150 150 C146 126 140 104 132 92 Z" fill={tom(c, -0.15)} />;
    case 'coque':
      return <circle cx={100} cy={40} r={17} fill={tom(c, -0.05)} />;
    default:
      return null;
  }
}

function CabeloFrente({ p }: { p: ParamRosto }) {
  const c = p.cabelo.cor;
  const brilho = tom(c, 0.18);
  switch (p.cabelo.estilo) {
    case 'curto':
      return <path d="M61 90 C58 48 80 36 100 36 C122 36 142 48 139 90 C134 70 124 58 100 57 C78 58 66 70 61 90 Z" fill={c} />;
    case 'lateral':
      return (
        <g>
          <path d="M61 92 C56 50 82 34 104 36 C128 38 144 54 139 92 C137 72 128 60 114 55 C96 64 76 64 61 92 Z" fill={c} />
          <path d="M84 44 C96 40 112 40 124 46" stroke={brilho} strokeWidth={2.2} fill="none" opacity={0.6} strokeLinecap="round" />
        </g>
      );
    case 'careca':
      return (
        <g fill={c} opacity={0.85}>
          <path d="M60 96 C59 84 61 76 64 72 L67 98 Z" />
          <path d="M140 96 C141 84 139 76 136 72 L133 98 Z" />
        </g>
      );
    case 'longo':
    case 'ondulado':
    case 'chanel':
      return <path d="M60 100 C56 46 84 34 100 36 C120 34 146 48 140 100 C134 70 120 56 104 52 C92 62 72 68 60 100 Z" fill={c} />;
    case 'coque':
    case 'rabo':
      return <path d="M61 92 C58 48 82 36 100 36 C120 36 142 48 139 92 C132 68 120 56 100 55 C80 56 68 68 61 92 Z" fill={c} />;
    case 'cacheado':
      return (
        <g fill={c}>
          {[[70, 58], [86, 48], [102, 46], [118, 50], [132, 60], [64, 74], [138, 76]].map(([x, y], i) => (
            <circle key={i} cx={x} cy={y} r={11} />
          ))}
        </g>
      );
  }
}

function Roupa({ p }: { p: ParamRosto }) {
  const { tipo, cor, detalhe } = p.roupa;
  const ombros = 'M22 222 C26 186 52 166 80 160 L120 160 C148 166 174 186 178 222 Z';
  switch (tipo) {
    case 'terno':
    case 'blazer':
      return (
        <g>
          <path d={ombros} fill={cor} />
          <path d="M84 160 L100 200 L116 160 Z" fill={detalhe ?? '#f2efe9'} />
          {p.gravata && <path d="M96 166 L104 166 L106 196 L100 206 L94 196 Z" fill={p.gravata} />}
          <path d="M80 160 L100 214 L88 222 L70 170 Z" fill={tom(cor, -0.25)} />
          <path d="M120 160 L100 214 L112 222 L130 170 Z" fill={tom(cor, -0.25)} />
        </g>
      );
    case 'camisa':
      return (
        <g>
          <path d={ombros} fill={cor} />
          <path d="M84 158 L100 176 L94 186 L78 166 Z" fill={tom(cor, 0.15)} />
          <path d="M116 158 L100 176 L106 186 L122 166 Z" fill={tom(cor, 0.15)} />
          <line x1={100} y1={178} x2={100} y2={222} stroke={tom(cor, -0.2)} strokeWidth={1.5} />
        </g>
      );
    case 'vestido':
      return (
        <g>
          <path d="M22 222 C26 190 50 172 72 168 C84 186 116 186 128 168 C150 172 174 190 178 222 Z" fill={cor} />
          <path d="M72 168 C84 186 116 186 128 168" stroke={tom(cor, 0.2)} strokeWidth={2} fill="none" />
        </g>
      );
    case 'gola-alta':
      return (
        <g>
          <path d={ombros} fill={cor} />
          <rect x={84} y={136} width={32} height={30} rx={8} fill={tom(cor, 0.08)} />
        </g>
      );
    default:
      return (
        <g>
          <path d={ombros} fill={cor} />
          <path d="M82 160 C88 172 112 172 118 160" stroke={tom(cor, -0.2)} strokeWidth={3} fill="none" />
        </g>
      );
  }
}

function Barba({ p }: { p: ParamRosto }) {
  const c = p.cabelo.estilo === 'careca' ? p.cabelo.cor : p.cabelo.cor;
  if (p.barba === 'curta')
    return <path d="M64 104 C66 132 82 144 100 144 C118 144 134 132 136 104 C132 118 122 126 112 122 C104 120 96 120 88 122 C78 126 68 118 64 104 Z" fill={c} opacity={0.92} />;
  if (p.barba === 'cavanhaque')
    return (
      <g fill={c} opacity={0.92}>
        <path d="M88 111 C94 108 106 108 112 111 C106 112 94 112 88 111 Z" />
        <path d="M92 128 C96 140 104 140 108 128 C104 131 96 131 92 128 Z" />
      </g>
    );
  if (p.barba === 'por-fazer')
    return <path d="M64 104 C66 132 82 144 100 144 C118 144 134 132 136 104 C130 124 116 132 100 132 C84 132 70 124 64 104 Z" fill={c} opacity={0.22} />;
  return null;
}

interface Props {
  id: string;
  expressao?: Expressao;
  /** 0 (fechada) a 1 (aberta) — vem do volume da voz */
  boca?: number;
  tamanho?: number;
  falando?: boolean;
  className?: string;
}

function RostoBase({ id, expressao = 'neutro', boca = 0, tamanho = 220, falando, className }: Props) {
  const p = rosto(id);
  const e = EXP[expressao];
  const uid = useId().replace(/:/g, '');
  const sombra = tom(p.pele, -0.18);
  const abre = Math.max(0, Math.min(1, boca));
  const yBoca = 120;
  const larg = 13 + e.curva * 2 + abre * 1.5;
  const canto = yBoca - e.curva * 4;
  const meio = yBoca + e.curva * 4;
  const olhoRy = 4.2 * e.olho;
  return (
    <svg viewBox="0 0 200 222" width={tamanho} height={tamanho * 1.11} className={className} role="img" aria-label={`Rosto de ${id}`} data-falando={falando ? 'sim' : 'nao'}>
      <defs>
        <radialGradient id={`f${uid}`} cx="50%" cy="38%" r="70%">
          <stop offset="0" stopColor={p.fundo[0]} />
          <stop offset="1" stopColor={p.fundo[1]} />
        </radialGradient>
        <radialGradient id={`p${uid}`} cx="45%" cy="40%" r="65%">
          <stop offset="0" stopColor={tom(p.pele, 0.08)} />
          <stop offset="1" stopColor={p.pele} />
        </radialGradient>
      </defs>
      <rect width={200} height={222} rx={22} fill={`url(#f${uid})`} />
      <CabeloAtras p={p} />
      <path d="M86 128 L114 128 L116 166 C108 172 92 172 84 166 Z" fill={sombra} />
      <Roupa p={p} />
      <ellipse cx={61} cy={98} rx={6} ry={10} fill={sombra} />
      <ellipse cx={139} cy={98} rx={6} ry={10} fill={sombra} />
      {p.brinco && (
        <g fill="#e6c36a">
          <circle cx={60} cy={110} r={2.6} />
          <circle cx={140} cy={110} r={2.6} />
        </g>
      )}
      <path d="M62 86 C62 50 80 40 100 40 C120 40 138 50 138 86 C138 118 124 142 100 144 C76 142 62 118 62 86 Z" fill={`url(#p${uid})`} />
      <Barba p={p} />
      {/* bochechas */}
      <ellipse cx={78} cy={112} rx={8} ry={4.5} fill="#d9767a" opacity={expressao === 'sorrindo' ? 0.28 : 0.12} />
      <ellipse cx={122} cy={112} rx={8} ry={4.5} fill="#d9767a" opacity={expressao === 'sorrindo' ? 0.28 : 0.12} />
      {/* olhos */}
      <g className="olhos">
        {[84, 116].map((x) => (
          <g key={x}>
            <ellipse cx={x} cy={93} rx={6.4} ry={olhoRy} fill="#fbf8f4" />
            <circle cx={x} cy={93.3} r={Math.min(3.4, olhoRy)} fill={p.olhos} />
            <circle cx={x} cy={93.3} r={Math.min(1.6, olhoRy * 0.5)} fill="#0b0806" />
            <circle cx={x + 1.2} cy={92} r={0.9} fill="#fff" opacity={0.9} />
            <path d={`M${x - 7} ${93 - olhoRy * 0.6} Q${x} ${93 - olhoRy * 1.5} ${x + 7} ${93 - olhoRy * 0.6}`} stroke={tom(p.pele, -0.55)} strokeWidth={1.6} fill="none" strokeLinecap="round" />
          </g>
        ))}
      </g>
      {p.idade === 'maduro' && (
        <g stroke={tom(p.pele, -0.3)} strokeWidth={0.9} fill="none" opacity={0.6}>
          <path d="M78 101 Q84 103 90 101" />
          <path d="M110 101 Q116 103 122 101" />
          <path d="M90 64 Q100 62 110 64" />
        </g>
      )}
      {/* sobrancelhas */}
      <g stroke={tom(p.cabelo.estilo === 'careca' ? '#3a2a20' : p.cabelo.cor, -0.1)} strokeWidth={3.2} strokeLinecap="round" fill="none">
        <path d={`M76 ${82 - e.sobrancelha - e.angulo * -0.3} Q84 ${78 - e.sobrancelha} 92 ${81 - e.sobrancelha + e.angulo * 0.45}`} />
        <path d={`M108 ${81 - e.sobrancelha + e.angulo * 0.45} Q116 ${78 - e.sobrancelha} 124 ${82 - e.sobrancelha - e.angulo * -0.3}`} />
      </g>
      {/* nariz */}
      <path d="M100 96 C98 104 95 108 97 110 C99 111 102 111 104 110" stroke={tom(p.pele, -0.28)} strokeWidth={1.8} fill="none" strokeLinecap="round" />
      {/* boca */}
      {abre > 0.05 ? (
        <g>
          <path
            d={`M${100 - larg} ${canto} Q100 ${meio - 3} ${100 + larg} ${canto} Q100 ${meio + 4 + abre * 12} ${100 - larg} ${canto} Z`}
            fill="#3b1416"
          />
          <path d={`M${100 - larg * 0.7} ${canto + 0.6} Q100 ${meio - 1.5} ${100 + larg * 0.7} ${canto + 0.6}`} stroke="#f4efe9" strokeWidth={2.4} fill="none" opacity={0.85} />
        </g>
      ) : (
        <path
          d={`M${100 - larg} ${canto} Q100 ${meio + 3} ${100 + larg} ${canto}`}
          stroke={p.batom ?? tom(p.pele, -0.42)}
          strokeWidth={p.batom ? 3.6 : 2.6}
          fill="none"
          strokeLinecap="round"
        />
      )}
      {p.batom && abre > 0.05 && (
        <path d={`M${100 - larg} ${canto} Q100 ${meio - 3} ${100 + larg} ${canto}`} stroke={p.batom} strokeWidth={2.6} fill="none" strokeLinecap="round" />
      )}
      <CabeloFrente p={p} />
      {p.oculos && (
        <g stroke="#1a1a1a" strokeWidth={2} fill="#ffffff" fillOpacity={0.06}>
          <rect x={73} y={85} width={22} height={16} rx={6} />
          <rect x={105} y={85} width={22} height={16} rx={6} />
          <path d="M95 92 L105 92" />
        </g>
      )}
    </svg>
  );
}

export const Rosto = memo(RostoBase);
