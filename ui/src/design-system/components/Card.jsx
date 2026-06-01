import './Card.css';
export default function Card({ children, className = '', style, onClick, noPadding, glowing }) {
  return (
    <div
      className={`cd-card ${glowing ? 'cd-card--glowing' : ''} ${onClick ? 'cd-card--clickable' : ''} ${noPadding ? 'cd-card--no-padding' : ''} ${className}`}
      style={style}
      onClick={onClick}
    >
      {children}
    </div>
  );
}
