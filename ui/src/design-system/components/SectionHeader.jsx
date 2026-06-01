export default function SectionHeader({ title, subtitle, action }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-3)' }}>
      <div>
        <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: 13, fontWeight: 600, color: 'var(--color-text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          {title}
        </h3>
        {subtitle && <p style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 2 }}>{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}
