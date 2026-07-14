// CD-138 Inspector surfaces: Repositories tab (request-log tap), Event Bus tab
// (bus.tap stream + catalog), Architecture Mode (the 21 ARCH notes), and the Boot
// Replay overlay (recorded stage timings). All render LIVE data — no fixtures.
import { useEffect, useState } from 'react'
import type { EventBus, BusEvent } from '@/platform/eventbus'
import { EVENT_NAMES } from '@/platform/eventbus'
import type { BootReport } from '@/platform/boot'
import { ARCH_NOTES } from './arch-notes'

const RING = 100

// A request-log row (structural — the workspace layer must not import the
// repositories layer; the app-shell wiring passes the gateway's tap as `subscribe`).
export interface RequestRow {
  route: string
  ok?: boolean
  durationMs?: number
}
export type RequestTap = (fn: (entry: RequestRow) => void) => () => void

// --- Repositories tab: live request log from an injected tap ---
export function ReposTab({ subscribe }: { subscribe: RequestTap }) {
  const [rows, setRows] = useState<RequestRow[]>([])
  useEffect(() => {
    return subscribe((entry) => {
      setRows((prev) => [entry, ...prev].slice(0, RING))
    })
  }, [subscribe])
  return (
    <table>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i} data-request={r.route}>
            <td>{r.route}</td>
            <td>{r.ok === false ? 'error' : 'ok'}</td>
            <td>{r.durationMs != null ? `${r.durationMs} ms` : '—'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

// --- Event Bus tab: live stream from bus.tap + the 13-event catalog ---
export function EventsTab({ bus }: { bus: EventBus }) {
  const [events, setEvents] = useState<BusEvent[]>([])
  useEffect(() => {
    return bus.tap((e) => setEvents((prev) => [e, ...prev].slice(0, RING)))
  }, [bus])
  return (
    <div>
      <ul data-catalog>
        {EVENT_NAMES.map((n) => (
          <li key={n} data-event-type={n}>
            {n}
          </li>
        ))}
      </ul>
      <table>
        <tbody>
          {events.map((e, i) => (
            <tr key={i} data-event={e.topic}>
              <td>{e.topic}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// --- Architecture Mode: the 21 ARCH notes as markers ---
export function ArchitectureMode() {
  return (
    <div className="arch-mode" aria-label="Architecture Mode">
      {ARCH_NOTES.map((note) => (
        <article key={note.id} data-arch-note={note.id}>
          <h4>{note.title}</h4>
          <p className="arch-what">{note.what}</p>
          <p className="arch-how">{note.how}</p>
          <p className="arch-why">{note.why}</p>
        </article>
      ))}
    </div>
  )
}

// --- Boot Replay: renders recorded BootReport stage timings ---
export function BootReplay({ report }: { report: BootReport }) {
  return (
    <div className="boot-replay" aria-label="Boot Replay">
      <p data-interactive-at>{`interactive @ ${Math.round(report.interactiveAtMs)} ms`}</p>
      <ol>
        {report.stages.map((s) => (
          <li key={s.id} data-stage={s.id} data-status={s.status}>
            {s.id} · {Math.round(s.durationMs)} ms · {s.status}
          </li>
        ))}
      </ol>
    </div>
  )
}
