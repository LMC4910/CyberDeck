import { describe, expect, it, vi } from 'vitest'
import { CommandRegistry, seedCommands, type CommandDescriptor } from '@/platform/commands'
import { KeymapDispatcher, parseCombo, comboFromEvent, comboEquals } from '@/platform/keymap'

const cmd = (over: Partial<CommandDescriptor>): CommandDescriptor => ({
  id: 'x',
  category: 'General',
  label: 'X',
  handler: () => {},
  ...over,
})

// A minimal KeyboardEvent-like object for the dispatcher.
function key(k: string, mods: { ctrl?: boolean; meta?: boolean; shift?: boolean; alt?: boolean } = {}) {
  return {
    key: k,
    ctrlKey: !!mods.ctrl,
    metaKey: !!mods.meta,
    shiftKey: !!mods.shift,
    altKey: !!mods.alt,
    preventDefault: vi.fn(),
  } as unknown as KeyboardEvent & { preventDefault: ReturnType<typeof vi.fn> }
}

describe('combo parsing + platform mapping', () => {
  it('parses design tokens and matches a Ctrl event on non-mac', () => {
    const combo = parseCombo(['⌘', 'K'])
    expect(combo).toEqual({ mod: true, shift: false, alt: false, key: 'k' })
    const ev = comboFromEvent(key('k', { ctrl: true }), 'other')
    expect(comboEquals(combo, ev)).toBe(true)
  })

  it('⌘ maps to meta on mac, ctrl on other', () => {
    const combo = parseCombo(['⌘', 'B'])
    expect(comboEquals(combo, comboFromEvent(key('b', { meta: true }), 'mac'))).toBe(true)
    expect(comboEquals(combo, comboFromEvent(key('b', { ctrl: true }), 'other'))).toBe(true)
    // meta on non-mac is NOT the primary modifier
    expect(comboEquals(combo, comboFromEvent(key('b', { meta: true }), 'other'))).toBe(false)
  })
})

describe('KeymapDispatcher — dispatch + match', () => {
  it('dispatches a matching global command', () => {
    const r = new CommandRegistry()
    const handler = vi.fn()
    r.register(cmd({ id: 'togL', keys: ['⌘', 'B'], handler }))
    const km = new KeymapDispatcher(r, { platform: 'other' })
    km.loadDefaults()
    const ev = key('b', { ctrl: true })
    expect(km.dispatch(ev, {})).toBe(true)
    expect(ev.preventDefault).toHaveBeenCalled()
    expect(handler).toHaveBeenCalled()
  })

  it('returns false for an unbound combo', () => {
    const r = new CommandRegistry()
    r.register(cmd({ id: 'togL', keys: ['⌘', 'B'], handler: () => {} }))
    const km = new KeymapDispatcher(r, { platform: 'other' })
    km.loadDefaults()
    expect(km.dispatch(key('q', { ctrl: true }), {})).toBe(false)
  })
})

describe('KeymapDispatcher — specificity', () => {
  it('a context-specific binding wins over a global one for the same combo', () => {
    const r = new CommandRegistry()
    const globalH = vi.fn()
    const scopedH = vi.fn()
    r.register(cmd({ id: 'global', keys: ['⌘', 'D'], handler: globalH }))
    r.register(cmd({ id: 'scoped', keys: ['⌘', 'D'], when: 'selectionKind == widget', handler: scopedH }))
    const km = new KeymapDispatcher(r, { platform: 'other' })
    km.loadDefaults()

    // In the widget context both match; the scoped (has when) wins.
    expect(km.resolve(parseCombo(['⌘', 'D']), { selectionKind: 'widget' })).toBe('scoped')
    // Without the context the scoped binding is gated out → global wins.
    expect(km.resolve(parseCombo(['⌘', 'D']), { selectionKind: 'none' })).toBe('global')
  })
})

describe('KeymapDispatcher — rebinding (user override round-trip)', () => {
  it('a user rebind shadows the default and resolves', () => {
    const r = new CommandRegistry()
    const handler = vi.fn()
    r.register(cmd({ id: 'palette', keys: ['⌘', 'K'], handler }))
    const km = new KeymapDispatcher(r, { platform: 'other' })
    km.loadDefaults()
    // rebind palette to Ctrl+P
    km.rebind('palette', ['⌘', 'P'])
    expect(km.resolve(parseCombo(['⌘', 'P']), {})).toBe('palette')
    // both the default and the user binding point at palette (no conflict, same cmd)
    km.dispatch(key('p', { ctrl: true }), {})
    expect(handler).toHaveBeenCalled()
  })
})

describe('KeymapDispatcher — conflict detection', () => {
  it('flags two commands bound to the same combo in the same context', () => {
    const r = new CommandRegistry()
    r.register(cmd({ id: 'a', keys: ['⌘', 'E'], handler: () => {} }))
    r.register(cmd({ id: 'b', keys: ['⌘', 'E'], handler: () => {} }))
    const km = new KeymapDispatcher(r, { platform: 'other' })
    km.loadDefaults()
    const conflicts = km.conflicts()
    expect(conflicts).toHaveLength(1)
    expect(conflicts[0]?.commandIds.sort()).toEqual(['a', 'b'])
  })

  it('the design seed set has no default conflicts within a context', () => {
    const r = new CommandRegistry()
    r.registerAll(seedCommands())
    const km = new KeymapDispatcher(r, { platform: 'other' })
    km.loadDefaults()
    // layout and devprev share ⌥⌘P / ⇧⌘P respectively — verify no *same-combo* clash
    const sameComboConflicts = km.conflicts().filter((c) => c.when === '')
    expect(sameComboConflicts).toEqual([])
  })
})
