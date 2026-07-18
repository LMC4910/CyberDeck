// Line chart canon widget (CD-423). Renders a sparkline from config.points.
import '../canon.css'

export default function ChartWidget({ config }: { config?: unknown }) {
  const c = (config ?? {}) as { points?: number[] }
  const pts = c.points && c.points.length > 1 ? c.points : [4, 8, 5, 9, 7, 11, 8]
  const max = Math.max(...pts)
  const min = Math.min(...pts)
  const span = max - min || 1
  const d = pts
    .map((p, i) => {
      const x = (i / (pts.length - 1)) * 100
      const y = 100 - ((p - min) / span) * 100
      return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`
    })
    .join(' ')
  return (
    <div className="cw cw-chart" data-widget-kind="chart">
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="cw-chart__svg" aria-hidden="true">
        <path d={d} className="cw-chart__line" />
      </svg>
    </div>
  )
}
