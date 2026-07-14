import { describe, expect, it, vi } from 'vitest'
import {
  CommandRegistry,
  DuplicateCommandError,
  UnknownCommandError,
  CommandNotAvailableError,
  CommandArgsError,
  evaluateWhen,
  seedCommands,
  SEED_CATEGORIES,
  type CommandDescriptor,
} from '@/platform/commands'

const cmd = (over: Partial<CommandDescriptor> = {}): CommandDescriptor => ({
  id: 'test',
  category: 'General',
  label: 'Test',
  handler: () => {},
  ...over,
})

describe('evaluateWhen', () => {
  it('empty clause is always true', () => {
    expect(evaluateWhen(undefined, {})).toBe(true)
    expect(evaluateWhen('', {})).toBe(true)
  })
  it('equality, inequality, truthy flags, negation, && / ||', () => {
    const ctx = { workspace: 'deck-designer', selectionKind: 'widget', flags: { devTools: true } }
    expect(evaluateWhen('workspace == deck-designer', ctx)).toBe(true)
    expect(evaluateWhen('workspace != flows', ctx)).toBe(true)
    expect(evaluateWhen('flags.devTools', ctx)).toBe(true)
    expect(evaluateWhen('!flags.marketplace', ctx)).toBe(true)
    expect(evaluateWhen('workspace == deck-designer && selectionKind == widget', ctx)).toBe(true)
    expect(evaluateWhen('selectionKind == group || selectionKind == widget', ctx)).toBe(true)
    expect(evaluateWhen('workspace == flows && flags.devTools', ctx)).toBe(false)
  })
})

describe('CommandRegistry — registration', () => {
  it('duplicate id throws', () => {
    const r = new CommandRegistry()
    r.register(cmd({ id: 'x' }))
    expect(() => r.register(cmd({ id: 'x' }))).toThrow(DuplicateCommandError)
  })
  it('unknown id on execute throws', async () => {
    const r = new CommandRegistry()
    await expect(r.execute('ghost')).rejects.toThrow(UnknownCommandError)
  })
})

describe('CommandRegistry — execution pipeline', () => {
  it('context gating: when-clause blocks execution', async () => {
    const r = new CommandRegistry()
    const handler = vi.fn()
    r.register(cmd({ id: 'del', when: 'selectionKind == widget', handler }))
    expect(r.canExecute('del', { selectionKind: 'none' })).toBe(false)
    await expect(r.execute('del', undefined, { selectionKind: 'none' })).rejects.toThrow(
      CommandNotAvailableError,
    )
    expect(handler).not.toHaveBeenCalled()
    await r.execute('del', undefined, { selectionKind: 'widget' })
    expect(handler).toHaveBeenCalledOnce()
  })

  it('permission gating', async () => {
    const granted = new Set<string>()
    const r = new CommandRegistry({ grantedPermissions: () => granted })
    r.register(cmd({ id: 'net', permissions: ['network'], handler: () => {} }))
    await expect(r.execute('net')).rejects.toThrow(CommandNotAvailableError)
    granted.add('network')
    await expect(r.execute('net')).resolves.toBeUndefined()
  })

  it('args validation', async () => {
    const r = new CommandRegistry()
    r.register(cmd({ id: 'a', validateArgs: (v) => typeof v === 'number', handler: () => {} }))
    await expect(r.execute('a', 'nope')).rejects.toThrow(CommandArgsError)
    await expect(r.execute('a', 42)).resolves.toBeUndefined()
  })

  it('telemetry + undo hooks fire after a successful run', async () => {
    const onTelemetry = vi.fn()
    const onUndoRecord = vi.fn()
    const r = new CommandRegistry({ onTelemetry, onUndoRecord })
    r.register(cmd({ id: 'edit', telemetry: true, undo: true, handler: () => {} }))
    await r.execute('edit')
    expect(onTelemetry).toHaveBeenCalledWith('edit')
    expect(onUndoRecord).toHaveBeenCalledWith('edit')
  })
})

describe('CommandRegistry — seed set (design CMDS)', () => {
  it('registers the 24 seed commands across the 6 design category groups', () => {
    const r = new CommandRegistry()
    const dispatch = vi.fn()
    r.registerAll(seedCommands(dispatch))
    expect(r.list()).toHaveLength(24)
    const cats = [...r.byCategory().keys()].sort()
    expect(cats).toEqual([...SEED_CATEGORIES].sort())
  })

  it('a global seed command runs its dispatcher', async () => {
    const r = new CommandRegistry()
    const dispatch = vi.fn()
    r.registerAll(seedCommands(dispatch))
    await r.execute('palette')
    expect(dispatch).toHaveBeenCalledWith('palette')
  })

  it('a context-gated seed command (insert) needs the deck-designer workspace', () => {
    const r = new CommandRegistry()
    r.registerAll(seedCommands())
    expect(r.canExecute('insert', { workspace: 'flows' })).toBe(false)
    expect(r.canExecute('insert', { workspace: 'deck-designer' })).toBe(true)
  })
})
