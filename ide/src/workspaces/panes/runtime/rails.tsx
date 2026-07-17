// Runtime rails (CD-408): Running Flows / Execution Queue / Timers. These are the
// flow engine's LIVE execution state, not authored-flow data — so the pane reads
// them from the RuntimeFeed seam (the injection point it already owns for logs and
// perf), NOT from a FlowRepository or the Flows workspace's pane files. There is no
// committed flow store/service seam yet; until one lands (or the M5 engine feed is
// injected), the mock feed simulates the execution state, and every value here
// updates from the stream on each step — nothing is a frozen fixture.
import { useEffect, useState, type ReactNode } from 'react'
import type { FlowRuntimeState, RuntimeFeed } from './runtime-feed'
import { formatDuration, timerRemainingPct } from './runtime-model'

export interface RailsProps {
  feed: RuntimeFeed
}

export function Rails({ feed }: RailsProps) {
  // Seed from the feed's current snapshot so the first paint is honest (timers are
  // already counting), then track every push.
  const [state, setState] = useState<FlowRuntimeState>(() => feed.flows())

  useEffect(() => feed.onFlows(setState), [feed])

  const { running, queued, timers } = state

  return (
    <div className="rt-rails" data-testid="runtime-rails">
      <Rail title="Running Flows" count={running.length} testid="rail-running" empty="No flows running">
        {running.map((flow) => (
          <li className="rt-rail-row" key={flow.id} data-testid="running-row">
            <span className="rt-rail-name">{flow.name}</span>
            <span className="rt-rail-sub">on {flow.node}</span>
          </li>
        ))}
      </Rail>

      <Rail title="Execution Queue" count={queued.length} testid="rail-queue" empty="Queue empty">
        {queued.map((run) => (
          <li className="rt-rail-row" key={run.id} data-testid="queue-row">
            <span className="rt-rail-name">{run.flow}</span>
            <span className="rt-rail-sub">{run.trigger}</span>
          </li>
        ))}
      </Rail>

      <Rail title="Timers" count={timers.length} testid="rail-timers" empty="No timers">
        {timers.map((timer) => (
          <li className="rt-rail-row rt-timer-row" key={timer.id} data-testid="timer-row">
            <span className="rt-rail-name">{timer.label}</span>
            <div
              className="rt-meter rt-timer-meter"
              role="meter"
              aria-label={`${timer.label} time remaining`}
              aria-valuemin={0}
              aria-valuemax={timer.intervalMs}
              aria-valuenow={Math.max(0, timer.remainingMs)}
              aria-valuetext={formatDuration(timer.remainingMs)}
            >
              <span
                className="rt-meter-fill"
                style={{ width: `${timerRemainingPct(timer.remainingMs, timer.intervalMs)}%` }}
              />
            </div>
            <span className="rt-rail-sub" data-testid="timer-remaining">
              {formatDuration(timer.remainingMs)}
            </span>
          </li>
        ))}
      </Rail>
    </div>
  )
}

function Rail({
  title,
  count,
  testid,
  empty,
  children,
}: {
  title: string
  count: number
  testid: string
  empty: string
  children: ReactNode
}) {
  return (
    <section className="rt-rail" aria-label={title} data-testid={testid}>
      <h3 className="rt-section-title">
        {title}
        <span className="rt-rail-count" data-testid={`${testid}-count`}>
          {count}
        </span>
      </h3>
      {count === 0 ? (
        <p className="rt-empty" data-testid={`${testid}-empty`}>
          {empty}
        </p>
      ) : (
        <ul className="rt-rail-list" role="list" aria-label={title}>
          {children}
        </ul>
      )}
    </section>
  )
}
