// Performance panel (CD-408). CPU/GPU/mem/exec heat bars fed live from the
// RuntimeFeed's perf stream — the same boundary-safe seam the log view reads, so
// the panel never reaches for a repository. Each bar is a real <meter> (labelled,
// value-texted) rather than a bare div, and the width is always the latest sample:
// there are no fixture-frozen numbers here, only whatever the stream last pushed.
import { useEffect, useState } from 'react'
import type { PerfSample, RuntimeFeed } from './runtime-feed'
import { PERF_METRICS, formatPercent, heatOf } from './runtime-model'

export interface PerfPanelProps {
  feed: RuntimeFeed
}

export function PerfPanel({ feed }: PerfPanelProps) {
  const [sample, setSample] = useState<PerfSample | null>(null)

  useEffect(() => feed.onPerf(setSample), [feed])

  return (
    <section className="rt-perf" aria-label="Performance" data-testid="runtime-perf">
      <h3 className="rt-section-title">Performance</h3>
      <div className="rt-perf-bars">
        {PERF_METRICS.map((metric) => {
          const value = sample ? sample[metric.key] : null
          const heat = value === null ? 'ok' : heatOf(value)
          return (
            <div className="rt-perf-bar" key={metric.key} data-testid={`perf-${metric.key}`}>
              <span className="rt-perf-label">{metric.label}</span>
              <div
                className="rt-meter"
                role="meter"
                aria-label={`${metric.label} ${metric.hint}`}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={value ?? undefined}
                aria-valuetext={value === null ? 'awaiting telemetry' : formatPercent(value)}
                data-heat={heat}
              >
                <span className="rt-meter-fill" style={{ width: `${value ?? 0}%` }} data-heat={heat} />
              </div>
              <span className="rt-perf-value" data-testid={`perf-${metric.key}-value`}>
                {value === null ? '—' : formatPercent(value)}
              </span>
            </div>
          )
        })}
      </div>
      {sample === null && (
        <p className="rt-empty" data-testid="perf-awaiting">
          Awaiting telemetry…
        </p>
      )}
    </section>
  )
}
