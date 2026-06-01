export default function Badge({ count, variant = 'normal' }) {
  if (!count || count === '0') return null;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      minWidth: 18, height: 18, padding: '0 5px',
      background: variant === 'critical' ? 'var(--color-status-error)' : 'var(--color-accent-primary)',
      borderRadius: 99, fontSize: 10, fontWeight: 600, color: '#fff',
      fontFamily: 'var(--font-label)', lineHeight: 1,
    }}>
      {count}
    </span>
  );
}
