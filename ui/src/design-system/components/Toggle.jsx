import './Toggle.css';
export default function Toggle({ checked, onChange, label, disabled }) {
  return (
    <label className={`cd-toggle ${disabled ? 'cd-toggle--disabled' : ''}`}>
      <input type="checkbox" checked={checked} onChange={e => onChange?.(e.target.checked)} disabled={disabled} />
      <span className="cd-toggle__track">
        <span className="cd-toggle__thumb" />
      </span>
      {label && <span className="cd-toggle__label">{label}</span>}
    </label>
  );
}
