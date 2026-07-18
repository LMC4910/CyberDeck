// Permission prompt controller (CD-422). Bridges the broker's async `prompt` port
// to a React modal: a first-use gated capability enqueues a request here and the
// broker's promise resolves when the user clicks Grant/Deny. FIFO — concurrent
// requests queue and are shown one at a time. Assembly wires
// `broker.prompt = controller.prompt`; the shell mounts <WidgetPermissionPrompt>.
import type {
  PermissionDecision,
  WidgetPermissionPrompt,
  WidgetPermissionRequest,
} from '@/services/widgets'

interface Pending {
  request: WidgetPermissionRequest
  resolve: (decision: PermissionDecision) => void
}

export class PermissionPromptController {
  private readonly queue: Pending[] = []
  private readonly listeners = new Set<() => void>()

  /** The port injected into the broker. Resolves when the user decides. */
  readonly prompt: WidgetPermissionPrompt = (request) =>
    new Promise<PermissionDecision>((resolve) => {
      this.queue.push({ request, resolve })
      this.notify()
    })

  /** The request currently shown (head of queue), or null when idle. */
  current(): WidgetPermissionRequest | null {
    return this.queue[0]?.request ?? null
  }

  /** Resolve the current request and advance the queue. */
  decide(decision: PermissionDecision): void {
    const head = this.queue.shift()
    head?.resolve(decision)
    this.notify()
  }

  /** Pending count (badge / tests). */
  get size(): number {
    return this.queue.length
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  private notify(): void {
    for (const l of this.listeners) l()
  }
}
