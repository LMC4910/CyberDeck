// CommandRegistry (CD-121). Every action resolves through one registry: palette,
// shortcuts, menus, buttons. One execution path → telemetry, permissions, undo
// and rebinding come for free (design Platform Note `cmdreg`). Execution pipeline:
// context (when-clause) → permission → args validation → handler → telemetry →
// undo record.
import { evaluateWhen, type WhenContext } from './when-clause'

export type { WhenContext } from './when-clause'

export interface CommandDescriptor<A = unknown> {
  id: string
  category: string
  label: string
  icon?: string
  /** Default keybinding tokens, e.g. ['⌘','K'] (design CMDS shape). */
  keys?: string[]
  /** When-clause gating visibility/enablement. Empty = always available. */
  when?: string
  /** Capability ids that must be granted (checked against ctx.grantedPermissions). */
  permissions?: string[]
  /** Validate the args payload; return false to reject with CommandArgsError. */
  validateArgs?: (args: unknown) => boolean
  /** Whether the command records an undo entry. */
  undo?: boolean
  /** Whether execution emits a telemetry event. */
  telemetry?: boolean
  handler: (args: A, ctx: WhenContext) => void | Promise<void>
}

export class DuplicateCommandError extends Error {
  constructor(id: string) {
    super(`command "${id}" is already registered`)
    this.name = 'DuplicateCommandError'
  }
}
export class UnknownCommandError extends Error {
  constructor(id: string) {
    super(`no command registered with id "${id}"`)
    this.name = 'UnknownCommandError'
  }
}
export class CommandNotAvailableError extends Error {
  constructor(id: string, reason: 'context' | 'permission') {
    super(`command "${id}" is not available (${reason})`)
    this.name = 'CommandNotAvailableError'
  }
}
export class CommandArgsError extends Error {
  constructor(id: string) {
    super(`invalid args for command "${id}"`)
    this.name = 'CommandArgsError'
  }
}

export interface CommandRegistryOptions {
  /** Granted capability ids (from engine core/security); default: all allowed. */
  grantedPermissions?: () => Set<string>
  /** Called after a successful execution when the command opts into telemetry. */
  onTelemetry?: (id: string) => void
  /** Called after a successful execution when the command opts into undo. */
  onUndoRecord?: (id: string) => void
}

export class CommandRegistry {
  private readonly commands = new Map<string, CommandDescriptor>()
  private readonly options: CommandRegistryOptions

  constructor(options: CommandRegistryOptions = {}) {
    this.options = options
  }

  register<A>(command: CommandDescriptor<A>): void {
    if (this.commands.has(command.id)) throw new DuplicateCommandError(command.id)
    this.commands.set(command.id, command as CommandDescriptor)
  }

  registerAll(commands: CommandDescriptor[]): void {
    for (const c of commands) this.register(c)
  }

  get(id: string): CommandDescriptor | undefined {
    return this.commands.get(id)
  }

  list(): CommandDescriptor[] {
    return [...this.commands.values()]
  }

  /** Commands grouped by their category (design category groups). */
  byCategory(): Map<string, CommandDescriptor[]> {
    const out = new Map<string, CommandDescriptor[]>()
    for (const c of this.commands.values()) {
      const group = out.get(c.category) ?? []
      group.push(c)
      out.set(c.category, group)
    }
    return out
  }

  /** True if the command exists, its when-clause passes, and permissions hold. */
  canExecute(id: string, ctx: WhenContext = {}): boolean {
    const cmd = this.commands.get(id)
    if (!cmd) return false
    if (!evaluateWhen(cmd.when, ctx)) return false
    return this.hasPermissions(cmd)
  }

  async execute(id: string, args?: unknown, ctx: WhenContext = {}): Promise<void> {
    const cmd = this.commands.get(id)
    if (!cmd) throw new UnknownCommandError(id)
    if (!evaluateWhen(cmd.when, ctx)) throw new CommandNotAvailableError(id, 'context')
    if (!this.hasPermissions(cmd)) throw new CommandNotAvailableError(id, 'permission')
    if (cmd.validateArgs && !cmd.validateArgs(args)) throw new CommandArgsError(id)

    await cmd.handler(args, ctx)

    if (cmd.telemetry) this.options.onTelemetry?.(id)
    if (cmd.undo) this.options.onUndoRecord?.(id)
  }

  private hasPermissions(cmd: CommandDescriptor): boolean {
    if (!cmd.permissions?.length) return true
    const granted = this.options.grantedPermissions?.()
    if (!granted) return true // no gate configured → allow
    return cmd.permissions.every((p) => granted.has(p))
  }
}
