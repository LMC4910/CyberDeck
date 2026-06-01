import './ProgressBar.css';
export default function ProgressBar({ value = 0, color = 'default', height = 6, label, showValue }) {
  const clampedVal = Math.min(100, Math.max(0, parseFloat(value) || 0));
  const colorMap = {
    default: 'linear-gradient(90deg, #7B2FBE, #00B4D8)',
    success: 'linear-gradient(90deg, #00B4D8, #00E676)',
    warning: 'linear-gradient(90deg, #FFAB40, #FF6B20)',
    error: 'linear-gradient(90deg, #FF5252, #FF1744)',
    info: 'linear-gradient(90deg, #448AFF, #00B4D8)',
  };
  return (
    <div className="cd-progress">
      {label && <span className="cd-progress__label">{label}</span>}
      <div className="cd-progress__track" style={{ height }}>
        <div
          className="cd-progress__fill"
          style={{ width: `${clampedVal}%`, background: colorMap[color] || colorMap.default }}
        />
      </div>
      {showValue && <span className="cd-progress__value">{Math.round(clampedVal)}%</span>}
    </div>
  );
}
