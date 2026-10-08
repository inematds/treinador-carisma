// Radar das competências (0-10).
interface Props {
  eixos: { id: string; nome: string }[];
  valores: Record<string, number>;
  tamanho?: number;
}

export function Radar({ eixos, valores, tamanho = 320 }: Props) {
  const c = tamanho / 2;
  const r = c - 78;
  const ponto = (i: number, v: number) => {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / eixos.length;
    return [c + Math.cos(a) * r * (v / 10), c + Math.sin(a) * r * (v / 10)];
  };
  const poligono = eixos.map((e, i) => ponto(i, valores[e.id] ?? 0).join(',')).join(' ');
  return (
    <svg className="radar" viewBox={`0 0 ${tamanho} ${tamanho}`} width="100%" style={{ maxWidth: tamanho }} role="img" aria-label="Radar das competências">
      {[2.5, 5, 7.5, 10].map((v) => (
        <polygon key={v} points={eixos.map((_, i) => ponto(i, v).join(',')).join(' ')} fill="none" stroke="#2f271d" />
      ))}
      {eixos.map((_, i) => {
        const [x, y] = ponto(i, 10);
        return <line key={i} x1={c} y1={c} x2={x} y2={y} stroke="#2f271d" />;
      })}
      <polygon points={poligono} fill="var(--acento)" fillOpacity={0.25} stroke="var(--acento)" strokeWidth={2} />
      {eixos.map((e, i) => {
        const [x, y] = ponto(i, 11.6);
        const ancora = x < c - 8 ? 'end' : x > c + 8 ? 'start' : 'middle';
        return (
          <text key={e.id} x={x} y={y} textAnchor={ancora} dominantBaseline="middle">
            {e.nome}
            {valores[e.id] !== undefined ? ` ${valores[e.id]}` : ''}
          </text>
        );
      })}
    </svg>
  );
}
