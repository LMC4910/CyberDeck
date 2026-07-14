// BootManager (CD-116). Runs the boot lifecycle as an ordered set of phases
// whose ORDER comes from configuration (the app config boot manifest), not code
// (01_Architecture_Baseline.md §2, BOOTSEQ). Blocking phases form a barrier that
// gates "interactive"; non-blocking phases run after. Each phase is timed with
// performance.mark/measure; a failure degrades per the phase's policy instead of
// white-screening. The run produces a replayable BootReport (feeds the CD-138
// boot-replay overlay).

/** What to do when a phase's `run` throws. Default `fatal`. */
export type FailurePolicy = 'fatal' | 'skip' | 'retry-once'

export interface BootContext {
  /** Shared bag phases read/write during boot (services register here pre-EventBus). */
  readonly bag: Map<string, unknown>
  /** Emit a performance mark namespaced to boot. */
  mark: (name: string) => void
}

export interface BootPhase {
  id: string
  /** Blocking phases gate first paint; non-blocking run post-interactive. */
  blocking: boolean
  failurePolicy?: FailurePolicy
  run: (ctx: BootContext) => void | Promise<void>
  /** Optional hook invoked with the (final) error before the policy is applied. */
  onError?: (err: unknown, ctx: BootContext) => void
}

export type StageStatus = 'ok' | 'skipped' | 'failed'

export interface StageTiming {
  id: string
  blocking: boolean
  startMs: number
  durationMs: number
  status: StageStatus
  attempts: number
  error?: string
}

export interface BootReport {
  stages: StageTiming[]
  /** Time from boot start to the end of the last blocking phase (shell interactive). */
  interactiveAtMs: number
  /** Time from boot start to the end of the last phase overall. */
  totalMs: number
  ok: boolean
}

/** A boot manifest entry (matches config/application.schema.json boot.manifest). */
export interface BootManifestEntry {
  stage: string
  blocking: boolean
}

/** Thrown when the manifest and the registered phases disagree. */
export class BootConfigError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'BootConfigError'
  }
}

export interface RunOptions {
  /**
   * Config-declared stage order (ids). When present, phases run in this order
   * and the manifest is validated against the registered phases: an id in the
   * manifest with no phase — or a phase missing from the manifest — is a
   * BootConfigError. When absent, phases run in the array order given.
   */
  order?: string[]
  /** Injected clock (ms) for deterministic tests. Defaults to performance.now. */
  now?: () => number
  /** Optional sink for the timing report (the wiring layer emits BootCompleted). */
  onComplete?: (report: BootReport) => void
}

const MARK_NS = 'cyberdeck:boot'

/**
 * Runs boot phases. Blocking phases are awaited in order (the barrier); once the
 * last blocking phase finishes the shell is "interactive" and non-blocking phases
 * run. Returns the BootReport; a fatal failure in a blocking phase aborts boot
 * (ok=false) and skips the remaining phases.
 */
export async function runBoot(
  phases: BootPhase[],
  options: RunOptions = {},
): Promise<BootReport> {
  const now = options.now ?? (() => performance.now())
  const ordered = orderPhases(phases, options.order)

  const bag = new Map<string, unknown>()
  const ctx: BootContext = {
    bag,
    mark: (name: string) => safeMark(`${MARK_NS}:${name}`),
  }

  const bootStart = now()
  const stages: StageTiming[] = []
  let interactiveAtMs = 0
  let aborted = false

  // Blocking phases first (the barrier), then non-blocking.
  const groups: BootPhase[][] = [
    ordered.filter((p) => p.blocking),
    ordered.filter((p) => !p.blocking),
  ]

  for (let g = 0; g < groups.length; g++) {
    const group = groups[g]!
    for (const phase of group) {
      if (aborted) {
        stages.push({
          id: phase.id,
          blocking: phase.blocking,
          startMs: now() - bootStart,
          durationMs: 0,
          status: 'skipped',
          attempts: 0,
        })
        continue
      }
      const timing = await runPhase(phase, ctx, now, bootStart)
      stages.push(timing)
      if (timing.status === 'failed' && (phase.failurePolicy ?? 'fatal') !== 'skip') {
        // fatal (or retry-once that exhausted its retry) aborts the rest.
        aborted = true
      }
    }
    // End of the blocking group → shell interactive.
    if (g === 0) interactiveAtMs = now() - bootStart
  }

  const report: BootReport = {
    stages,
    interactiveAtMs,
    totalMs: now() - bootStart,
    ok: !aborted,
  }
  options.onComplete?.(report)
  return report
}

function orderPhases(phases: BootPhase[], order?: string[]): BootPhase[] {
  if (!order) return phases

  const byId = new Map(phases.map((p) => [p.id, p]))
  const seen = new Set<string>()
  const ordered: BootPhase[] = []
  for (const id of order) {
    const phase = byId.get(id)
    if (!phase) {
      throw new BootConfigError(
        `boot manifest declares stage "${id}" but no phase is registered for it`,
      )
    }
    ordered.push(phase)
    seen.add(id)
  }
  const missing = phases.filter((p) => !seen.has(p.id)).map((p) => p.id)
  if (missing.length) {
    throw new BootConfigError(
      `phase(s) not declared in the boot manifest: ${missing.join(', ')}`,
    )
  }
  return ordered
}

async function runPhase(
  phase: BootPhase,
  ctx: BootContext,
  now: () => number,
  bootStart: number,
): Promise<StageTiming> {
  const policy = phase.failurePolicy ?? 'fatal'
  const maxAttempts = policy === 'retry-once' ? 2 : 1
  const startMs = now() - bootStart
  const startMark = `${MARK_NS}:${phase.id}:start`
  const endMark = `${MARK_NS}:${phase.id}:end`
  safeMark(startMark)

  let attempts = 0
  let lastError: unknown
  while (attempts < maxAttempts) {
    attempts++
    try {
      await phase.run(ctx)
      safeMark(endMark)
      safeMeasure(`${MARK_NS}:${phase.id}`, startMark, endMark)
      return {
        id: phase.id,
        blocking: phase.blocking,
        startMs,
        durationMs: now() - bootStart - startMs,
        status: 'ok',
        attempts,
      }
    } catch (err) {
      lastError = err
    }
  }

  // Exhausted attempts.
  try {
    phase.onError?.(lastError, ctx)
  } catch {
    // an onError that throws must not mask the original failure
  }
  safeMark(endMark)
  safeMeasure(`${MARK_NS}:${phase.id}`, startMark, endMark)
  return {
    id: phase.id,
    blocking: phase.blocking,
    startMs,
    durationMs: now() - bootStart - startMs,
    status: policy === 'skip' ? 'skipped' : 'failed',
    attempts,
    error: errorMessage(lastError),
  }
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

// performance.mark/measure can throw in exotic hosts; boot must never die on
// instrumentation. Guard both.
function safeMark(name: string): void {
  try {
    performance.mark(name)
  } catch {
    /* no-op */
  }
}

function safeMeasure(name: string, start: string, end: string): void {
  try {
    performance.measure(name, start, end)
  } catch {
    /* no-op */
  }
}
