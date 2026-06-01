import './Button.css';
export default function Button({ children, variant = 'primary', size = 'md', onClick, disabled, className = '', icon }) {
  return (
    <button
      className={`cd-btn cd-btn--${variant} cd-btn--${size} ${className}`}
      onClick={onClick}
      disabled={disabled}
    >
      {icon && <span className="cd-btn__icon">{icon}</span>}
      {children}
    </button>
  );
}
