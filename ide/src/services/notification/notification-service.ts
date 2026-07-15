// NotificationService (CD-211). notify() queues with dedupe + rate-limit and a
// toast policy (AUDIT M4: no ambient-success noise). It is store/bus-agnostic
// (services may not import stores): emits each accepted notification via onNotify;
// the wiring projects to the Notification store + bus and drives the toaster.

export type NotifyLevel = 'info' | 'warn' | 'error' | 'success'

export interface NotifyAction {
  id: string
  label: string
}

export interface NotifyInput {
  id?: string
  level: NotifyLevel
  source: string
  title: string
  body?: string
  /** Same key within the dedupe window collapses to one notification. */
  dedupeKey?: string
  actions?: NotifyAction[]
  /** Force/suppress a toast; default follows the policy (below). */
  toast?: boolean
}

export interface Notification {
  id: string
  level: NotifyLevel
  source: string
  title: string
  body?: string
  actions: NotifyAction[]
  ts: number
  read: boolean
  toast: boolean
}

export interface NotificationServiceOptions {
  onNotify?: (n: Notification) => void
  now?: () => number
  /** Rate limit: at most `max` notifications per `windowMs`. Default 5 / 1000ms. */
  rateLimit?: { max: number; windowMs: number }
  /** Dedupe window for repeated dedupeKeys. Default 2000ms. */
  dedupeWindowMs?: number
}

export class NotificationService {
  private readonly onNotify?: (n: Notification) => void
  private readonly now: () => number
  private readonly rateLimit: { max: number; windowMs: number }
  private readonly dedupeWindowMs: number
  private recentTimes: number[] = []
  private readonly lastByKey = new Map<string, number>()
  private seq = 0

  constructor(options: NotificationServiceOptions = {}) {
    this.onNotify = options.onNotify
    this.now = options.now ?? (() => Date.now())
    this.rateLimit = options.rateLimit ?? { max: 5, windowMs: 1000 }
    this.dedupeWindowMs = options.dedupeWindowMs ?? 2000
  }

  /**
   * Queue a notification. Returns the accepted Notification, or null if it was
   * deduped or rate-limited.
   */
  notify(input: NotifyInput): Notification | null {
    const t = this.now()

    // dedupe
    if (input.dedupeKey) {
      const last = this.lastByKey.get(input.dedupeKey)
      if (last !== undefined && t - last < this.dedupeWindowMs) return null
      this.lastByKey.set(input.dedupeKey, t)
    }

    // rate limit (sliding window)
    this.recentTimes = this.recentTimes.filter((x) => t - x < this.rateLimit.windowMs)
    if (this.recentTimes.length >= this.rateLimit.max) return null
    this.recentTimes.push(t)

    const notification: Notification = {
      id: input.id ?? `ntf_${(++this.seq).toString(36)}`,
      level: input.level,
      source: input.source,
      title: input.title,
      body: input.body,
      actions: input.actions ?? [],
      ts: t,
      read: false,
      toast: input.toast ?? defaultToast(input),
    }
    this.onNotify?.(notification)
    return notification
  }
}

// Toast policy (AUDIT M4): errors/warnings and anything with an action toast;
// ambient success (success with no action) does NOT toast — no success noise.
function defaultToast(input: NotifyInput): boolean {
  if (input.actions?.length) return true
  if (input.level === 'error' || input.level === 'warn') return true
  return false
}
