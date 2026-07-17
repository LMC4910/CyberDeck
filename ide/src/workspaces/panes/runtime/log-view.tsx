// Execution log (CD-407). A virtualized view over the Runtime ring-buffer store,
// fed by the RuntimeFeed seam. Two properties earn the AC:
//  - arrivals are coalesced into ONE commit per animation frame, so a sustained
//    50 events/s costs ~60 commits/s of a ~20-row window, not 50 list rebuilds;
//  - pausing stops committing (arrivals queue in `pending`) rather than freezing a
//    moving list, so the scroll position simply never moves — and Step releases
//    exactly one queued entry.
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { RuntimeLogEvent } from '@/shared/contract'
import { appendRuntime, RUNTIME_CAP, useStore, type RuntimeState, type Store } from '@/stores'
import { useVirtualRows } from '@/shared/virtual'
import type { RuntimeFeed } from './runtime-feed'
import {
  allLevels,
  eventsPerMinute,
  filterEntries,
  LOG_LEVELS,
  sourceOf,
  sourcesOf,
  trimArrivals,
  type LogLevel,
} from './log-model'

const ROW_H = 22
/** Treat "within a row of the bottom" as pinned, so follow survives rounding. */
const FOLLOW_EPSILON = ROW_H

export interface LogViewProps {
  feed: RuntimeFeed
  store: Store<RuntimeState>
  /** Injectable clock + frame scheduler; the pane passes the real ones. */
  now?: () => number
  scheduleFlush?: (fn: () => void) => number
  cancelFlush?: (handle: number) => void
}

const defaultSchedule = (fn: () => void): number =>
  typeof requestAnimationFrame === 'function'
    ? requestAnimationFrame(() => fn())
    : (setTimeout(fn, ROW_H) as unknown as number)

const defaultCancel = (h: number): void => {
  if (typeof cancelAnimationFrame === 'function') cancelAnimationFrame(h)
  else clearTimeout(h)
}

export function LogView({
  feed,
  store,
  now = () => Date.now(),
  scheduleFlush = defaultSchedule,
  cancelFlush = defaultCancel,
}: LogViewProps) {
  const entries = useStore(store, (s) => s.entries)
  const [paused, setPaused] = useState(false)
  const [pendingCount, setPendingCount] = useState(0)
  const [rate, setRate] = useState(0)
  const [levels, setLevels] = useState<ReadonlySet<LogLevel>>(allLevels)
  const [source, setSource] = useState<string | null>(null)

  // Arrivals land in a ref (never state) so the stream can never schedule a render
  // per event; the frame flush is the only thing that touches the store.
  const pending = useRef<RuntimeLogEvent[]>([])
  const arrivals = useRef<number[]>([])
  const pausedRef = useRef(paused)
  pausedRef.current = paused
  const frame = useRef(0)

  const scroller = useRef<HTMLDivElement | null>(null)
  const follow = useRef(true)

  const commit = useCallback(
    (batch: RuntimeLogEvent[]) => {
      // appendRuntime owns the cap; a batch is still one React commit.
      for (const entry of batch) appendRuntime(store, entry)
    },
    [store],
  )

  const flush = useCallback(() => {
    frame.current = 0
    const t = now()
    arrivals.current = trimArrivals(arrivals.current, t)
    setRate(eventsPerMinute(arrivals.current, t))
    if (pausedRef.current) {
      setPendingCount(pending.current.length)
      return
    }
    const batch = pending.current
    pending.current = []
    setPendingCount(0)
    commit(batch)
  }, [commit, now])

  const wake = useCallback(() => {
    if (!frame.current) frame.current = scheduleFlush(flush)
  }, [flush, scheduleFlush])

  useEffect(() => {
    const unsubscribe = feed.onLog((entry) => {
      pending.current.push(entry)
      // The paused queue is a ring too — a long pause drops the oldest, never grows.
      if (pending.current.length > RUNTIME_CAP) {
        pending.current.splice(0, pending.current.length - RUNTIME_CAP)
      }
      arrivals.current.push(now())
      wake()
    })
    return () => {
      unsubscribe()
      if (frame.current) cancelFlush(frame.current)
      frame.current = 0
    }
  }, [feed, now, wake, cancelFlush])

  // Let the rate decay while the stream is quiet (no arrivals → no flushes).
  useEffect(() => {
    const h = setInterval(() => {
      const t = now()
      arrivals.current = trimArrivals(arrivals.current, t)
      setRate(eventsPerMinute(arrivals.current, t))
    }, 1000)
    return () => clearInterval(h)
  }, [now])

  const sources = useMemo(() => sourcesOf(entries), [entries])
  const rows = useMemo(() => filterEntries(entries, { levels, source }), [entries, levels, source])
  const v = useVirtualRows(rows.length, ROW_H)

  // Follow the tail only while live and pinned to the bottom: a paused (or
  // scrolled-back) reader keeps their position no matter what arrives.
  useLayoutEffect(() => {
    const el = scroller.current
    if (!el || paused || !follow.current) return
    el.scrollTop = el.scrollHeight
  }, [rows.length, paused])

  const onScroll = useCallback(
    (e: React.UIEvent<HTMLDivElement>) => {
      const el = e.currentTarget
      follow.current = el.scrollHeight - el.scrollTop - el.clientHeight <= FOLLOW_EPSILON
      v.onScroll(e)
    },
    [v],
  )

  const toggleLevel = (level: LogLevel) =>
    setLevels((prev) => {
      const next = new Set(prev)
      if (next.has(level)) next.delete(level)
      else next.add(level)
      return next
    })

  const resume = () => {
    setPaused(false)
    follow.current = true
    wake() // release everything queued during the pause
  }

  const step = () => {
    const next = pending.current.shift()
    if (!next) return
    setPendingCount(pending.current.length)
    commit([next])
  }

  const clear = () => {
    pending.current = []
    arrivals.current = []
    setPendingCount(0)
    setRate(0)
    follow.current = true
    store.setState({ entries: [] })
  }

  return (
    <div className="rt-log" data-testid="runtime-log">
      <div className="rt-log-toolbar">
        <div className="rt-log-levels" role="group" aria-label="Filter by level">
          {LOG_LEVELS.map((level) => (
            <button
              key={level}
              type="button"
              className="rt-chip"
              data-level={level}
              data-testid={`log-level-${level}`}
              aria-pressed={levels.has(level)}
              onClick={() => toggleLevel(level)}
            >
              {level}
            </button>
          ))}
        </div>
        <label className="rt-log-source">
          <span className="rt-log-source-label">Source</span>
          <select
            value={source ?? ''}
            data-testid="log-source"
            onChange={(e) => setSource(e.target.value === '' ? null : e.target.value)}
          >
            <option value="">All sources</option>
            {sources.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <div className="rt-log-transport" role="group" aria-label="Stream controls">
          <button
            type="button"
            className="rt-btn"
            data-testid="log-pause"
            aria-pressed={paused}
            onClick={() => (paused ? resume() : setPaused(true))}
          >
            {paused ? 'Resume' : 'Pause'}
          </button>
          <button
            type="button"
            className="rt-btn"
            data-testid="log-step"
            disabled={!paused || pendingCount === 0}
            title={
              !paused
                ? 'Pause the stream to step through queued events'
                : pendingCount === 0
                  ? 'No queued events to step'
                  : 'Append the next queued event'
            }
            onClick={step}
          >
            Step
          </button>
          <button
            type="button"
            className="rt-btn"
            data-testid="log-clear"
            disabled={entries.length === 0 && pendingCount === 0}
            title={entries.length === 0 && pendingCount === 0 ? 'The log is already empty' : 'Clear the log'}
            onClick={clear}
          >
            Clear
          </button>
        </div>
      </div>

      <div
        className="rt-log-scroll"
        ref={(el) => {
          scroller.current = el
          v.containerRef(el)
        }}
        onScroll={onScroll}
        tabIndex={0}
        role="list"
        aria-label="Execution log"
        data-testid="log-scroll"
      >
        <div style={{ height: v.totalHeight, position: 'relative' }}>
          <div style={{ transform: `translateY(${v.offsetY}px)` }}>
            {rows.slice(v.start, v.end).map((entry, i) => (
              <div
                key={`${v.start + i}-${entry.ts ?? ''}`}
                className="rt-log-row"
                role="listitem"
                data-level={entry.level}
                data-testid="log-row"
                style={{ height: ROW_H }}
              >
                <span className="rt-log-level">{entry.level}</span>
                <span className="rt-log-src">{sourceOf(entry)}</span>
                <span className="rt-log-msg">{entry.message}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <footer className="rt-log-footer">
        <span data-testid="log-count">
          {rows.length === entries.length
            ? `${entries.length} entries`
            : `${rows.length} of ${entries.length} entries`}
        </span>
        <span data-testid="log-rate">{rate} events/min</span>
        {paused && (
          <span className="rt-log-buffered" data-testid="log-buffered">
            paused · {pendingCount} queued
          </span>
        )}
      </footer>
    </div>
  )
}
