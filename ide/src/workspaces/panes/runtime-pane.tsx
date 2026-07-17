// Runtime pane (CD-203 slot → CD-407 log view). The blueprint's seventh workspace
// (IDE-E15), which replaced the Home placeholder. The pane is pure wiring: it
// resolves the Runtime ring-buffer store + the live feed from their injection
// points and drives the feed while the workspace is open (the CD-326 precedent).
import { useEffect } from 'react'
import { LogView } from './runtime/log-view'
import { useRuntimeFeed, useRuntimeStore } from './runtime/use-runtime'
import './runtime/runtime.css'

export default function RuntimePane() {
  const feed = useRuntimeFeed()
  const store = useRuntimeStore()

  // Skipped under test (MODE==='test'), where tests emit by hand — same guard the
  // canvas uses for its mock variable ticks, and for the same reason.
  useEffect(() => {
    if (import.meta.env.MODE === 'test') return
    return feed.start()
  }, [feed])

  return (
    <section className="rt-pane" data-pane="runtime" aria-label="Runtime workspace">
      <LogView feed={feed} store={store} />
    </section>
  )
}
