export default function Sparkline({ data = [], width = 120, height = 40, color = '#7B2FBE', fillOpacity = 0.25 }) {
  if (!data || data.length < 2) return <svg width={width} height={height} />;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const pad = 2;
  const w = width - pad * 2;
  const h = height - pad * 2;
  const points = data.map((v, i) => [
    pad + (i / (data.length - 1)) * w,
    pad + h - ((v - min) / range) * h,
  ]);
  const polyline = points.map(([x, y]) => `${x},${y}`).join(' ');
  const fillPath = `M ${points[0][0]},${height} L ${points.map(([x,y]) => `${x},${y}`).join(' L ')} L ${points[points.length-1][0]},${height} Z`;
  const gradId = `spark-${Math.random().toString(36).slice(2)}`;

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={fillOpacity} />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={fillPath} fill={`url(#${gradId})`} />
      <polyline points={polyline} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}
