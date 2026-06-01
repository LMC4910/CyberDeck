export default function StatusDot({ status = 'success', size = 8, pulse }) {
  const colors = { success: '#00E676', warning: '#FFAB40', error: '#FF5252', info: '#448AFF', offline: '#8888AA' };
  return (
    <span style={{
      display: 'inline-block', width: size, height: size, borderRadius: '50%',
      background: colors[status] || colors.offline,
      boxShadow: pulse ? `0 0 ${size}px ${colors[status]}` : 'none',
      flexShrink: 0,
    }} />
  );
}
