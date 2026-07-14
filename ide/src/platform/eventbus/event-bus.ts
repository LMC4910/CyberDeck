// EventBus (CD-120). Async (microtask) pub/sub with wildcard subscriptions,
// bounded per-subscriber queues (drop-oldest + log on overflow), replay-on-
// subscribe for designated replayable topics, and a dev tap. The typed facade
// over the 13 EVCAT events lives in catalog.ts. Cross-feature communication goes
// through this bus, never direct calls (01_Architecture_Baseline.md §1).

export interface BusEvent<T = unknown> {
  topic: string
  payload: T
}

export type Handler<T = unknown> = (payload: T, topic: string) => void

export interface SubscribeOptions {
  /** Max buffered events before drop-oldest kicks in. Default 1000. */
  queueLimit?: number
}

export interface EventBusOptions {
  /** Topics whose recent events are replayed to new subscribers. */
  replayable?: Record<string, number> // topic → ring-buffer size
  /** Microtask scheduler (tests inject a manual drainer). Default queueMicrotask. */
  schedule?: (fn: () => void) => void
}

interface Subscription {
  topic: string
  handler: Handler
  queue: BusEvent[]
  queueLimit: number
  draining: boolean
}

const matches = (pattern: string, topic: string): boolean => {
  if (pattern === '*') return true
  if (pattern === topic) return true
  // prefix wildcard: "variable.*" matches "variable.changed"
  if (pattern.endsWith('.*')) return topic.startsWith(pattern.slice(0, -1))
  return false
}

export class EventBus {
  private readonly subs = new Set<Subscription>()
  private readonly taps = new Set<(e: BusEvent) => void>()
  private readonly replayCfg: Record<string, number>
  private readonly history = new Map<string, BusEvent[]>()
  private readonly schedule: (fn: () => void) => void
  private drops = 0

  constructor(options: EventBusOptions = {}) {
    this.replayCfg = options.replayable ?? {}
    this.schedule = options.schedule ?? ((fn) => queueMicrotask(fn))
  }

  /** Publish an event. Delivery is asynchronous (microtask), FIFO per subscriber. */
  emit<T>(topic: string, payload: T): void {
    const event: BusEvent<T> = { topic, payload }
    for (const tap of this.taps) tap(event)

    // Record history for replayable topics.
    const cap = this.replayCfg[topic]
    if (cap && cap > 0) {
      const buf = this.history.get(topic) ?? []
      buf.push(event)
      while (buf.length > cap) buf.shift()
      this.history.set(topic, buf)
    }

    for (const sub of this.subs) {
      if (matches(sub.topic, topic)) this.enqueue(sub, event)
    }
  }

  /**
   * Subscribe to a topic (exact, `prefix.*`, or `*`). Returns an unsubscribe.
   * Replayable-topic history is delivered (asynchronously) to the new subscriber.
   */
  subscribe<T>(topic: string, handler: Handler<T>, options: SubscribeOptions = {}): () => void {
    const sub: Subscription = {
      topic,
      handler: handler as Handler,
      queue: [],
      queueLimit: options.queueLimit ?? 1000,
      draining: false,
    }
    this.subs.add(sub)

    // Replay history for any replayable topic this subscription matches.
    for (const [t, buf] of this.history) {
      if (matches(topic, t)) for (const event of buf) this.enqueue(sub, event)
    }

    return () => {
      this.subs.delete(sub)
    }
  }

  /** Observe every event (dev surfaces: Platform Inspector). Returns an untap. */
  tap(fn: (event: BusEvent) => void): () => void {
    this.taps.add(fn)
    return () => this.taps.delete(fn)
  }

  /** Total events dropped due to queue overflow (for the inspector / tests). */
  get droppedCount(): number {
    return this.drops
  }

  private enqueue(sub: Subscription, event: BusEvent): void {
    sub.queue.push(event)
    if (sub.queue.length > sub.queueLimit) {
      sub.queue.shift() // drop oldest
      this.drops++
      console.warn(
        `[EventBus] subscriber for "${sub.topic}" overflowed (limit ${sub.queueLimit}); dropped oldest event`,
      )
    }
    if (!sub.draining) {
      sub.draining = true
      this.schedule(() => this.drain(sub))
    }
  }

  private drain(sub: Subscription): void {
    // The subscription may have been removed before the microtask ran.
    while (sub.queue.length > 0) {
      const event = sub.queue.shift()!
      if (!this.subs.has(sub)) break
      try {
        sub.handler(event.payload, event.topic)
      } catch (err) {
        // A throwing handler must not stall delivery to others.
        console.error(`[EventBus] handler for "${sub.topic}" threw`, err)
      }
    }
    sub.draining = false
  }
}
