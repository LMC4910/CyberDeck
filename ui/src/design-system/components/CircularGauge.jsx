export default function CircularGauge({
  value = 0,
  label = '',
  sublabel = '',
  size = 140,
  color = 'var(--gauge-fill)',
  unit = '%',
  warnAt = 80,
  critAt = 90,
}) {
  const radius = (size - 24) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const circumference = 2 * Math.PI * radius;
  const numVal = parseFloat(value) || 0;
  const clampedVal = Math.min(100, Math.max(0, numVal));
  const fillLength = (clampedVal / 100) * circumference;

  // Dynamic color based on thresholds
  let fillColor = color;
  if (numVal >= critAt) fillColor = 'var(--color-status-error)';
  else if (numVal >= warnAt) fillColor = 'var(--color-status-warning)';

  const gaugeId = `gauge-${Math.random().toString(36).slice(2)}`;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <defs>
        <filter id={gaugeId} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>

      {/* Track */}
      <circle
        cx={cx} cy={cy} r={radius}
        fill="none"
        stroke="var(--gauge-track)"
        strokeWidth="10"
        strokeLinecap="round"
      />

      {/* Fill arc */}
      <circle
        cx={cx} cy={cy} r={radius}
        fill="none"
        stroke={fillColor}
        strokeWidth="10"
        strokeLinecap="round"
        strokeDasharray={`${fillLength} ${circumference - fillLength}`}
        strokeDashoffset={circumference * 0.25}
        transform={`rotate(-90 ${cx} ${cy})`}
        style={{ filter: `drop-shadow(0 0 6px ${fillColor})` }}
      />

      {/* Center value */}
      <text x={cx} y={cy - 6} textAnchor="middle" fill="var(--color-text-primary)"
        fontSize={size * 0.18} fontFamily="var(--font-mono)" fontWeight="500">
        {value === '--' ? '--' : `${Math.round(numVal)}`}
        <tspan fontSize={size * 0.1} fill="var(--color-text-secondary)">{unit}</tspan>
      </text>

      {/* Sublabel */}
      {sublabel && (
        <text x={cx} y={cy + size * 0.13} textAnchor="middle" fill="var(--color-text-secondary)"
          fontSize={size * 0.09} fontFamily="var(--font-mono)">
          {sublabel}
        </text>
      )}

      {/* Label below */}
      {label && (
        <text x={cx} y={size - 6} textAnchor="middle" fill="var(--color-text-muted)"
          fontSize={size * 0.08} fontFamily="var(--font-heading)" letterSpacing="0.05em">
          {label}
        </text>
      )}
    </svg>
  );
}
