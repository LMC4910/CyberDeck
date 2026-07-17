// Runtime workspace layout (CD-407 log + CD-408 perf/rails). Composes the three
// live surfaces over ONE feed + store: the execution log fills the main column,
// the performance panel and flow rails share the status aside. All three subscribe
// to the same injected RuntimeFeed, so the whole workspace moves together off a
// single stream.
import { LogView } from './log-view'
import { PerfPanel } from './perf-panel'
import { Rails } from './rails'
import type { RuntimeFeed } from './runtime-feed'
import type { RuntimeState, Store } from '@/stores'

export interface RuntimeViewProps {
  feed: RuntimeFeed
  store: Store<RuntimeState>
  /** Injectable clock, forwarded to the log view for deterministic tests. */
  now?: () => number
}

export function RuntimeView({ feed, store, now }: RuntimeViewProps) {
  return (
    <div className="rt-body">
      <div className="rt-main">
        <LogView feed={feed} store={store} now={now} />
      </div>
      <aside className="rt-aside" aria-label="Runtime status">
        <PerfPanel feed={feed} />
        <Rails feed={feed} />
      </aside>
    </div>
  )
}
