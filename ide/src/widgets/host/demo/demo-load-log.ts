// Records which demo widget modules have been *evaluated*. Because each demo
// widget is dynamically imported (its own chunk), its module body — and thus this
// log entry — only runs when the host first renders it. The chunk-split test reads
// this to prove lazy, per-widget loading (nothing loads until rendered).
export const demoLoadLog: string[] = []

export function markLoaded(id: string): void {
  demoLoadLog.push(id)
}
