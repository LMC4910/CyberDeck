// Key combo parsing + platform mapping (CD-122). A combo normalizes to a primary
// modifier (⌘ on macOS, Ctrl elsewhere) plus shift/alt and a key. Design tokens
// (['⌘','K']) and KeyboardEvents both reduce to this shape so matching is trivial.

export type Platform = 'mac' | 'other'

export interface KeyCombo {
  /** The primary modifier — ⌘ on mac, Ctrl elsewhere. */
  mod: boolean
  shift: boolean
  alt: boolean
  /** The main key, lower-cased (e.g. 'k', ',', 'z'). */
  key: string
}

const MOD_TOKENS = new Set(['⌘', 'cmd', 'command', 'ctrl', 'control', 'meta'])
const SHIFT_TOKENS = new Set(['⇧', 'shift'])
const ALT_TOKENS = new Set(['⌥', 'alt', 'option', 'opt'])

/** Parse design tokens (['⌘','K']) or a '+'-joined string ('Ctrl+K') into a combo. */
export function parseCombo(input: string[] | string): KeyCombo {
  const tokens = (Array.isArray(input) ? input : input.split('+')).map((t) => t.trim())
  const combo: KeyCombo = { mod: false, shift: false, alt: false, key: '' }
  for (const raw of tokens) {
    const t = raw.toLowerCase()
    if (MOD_TOKENS.has(t)) combo.mod = true
    else if (SHIFT_TOKENS.has(t)) combo.shift = true
    else if (ALT_TOKENS.has(t)) combo.alt = true
    else if (raw !== '') combo.key = t
  }
  return combo
}

/** Build a combo from a keydown event, using the platform's primary modifier. */
export function comboFromEvent(e: KeyboardEvent, platform: Platform = detectPlatform()): KeyCombo {
  return {
    mod: platform === 'mac' ? e.metaKey : e.ctrlKey,
    shift: e.shiftKey,
    alt: e.altKey,
    key: e.key.toLowerCase(),
  }
}

export function comboEquals(a: KeyCombo, b: KeyCombo): boolean {
  return a.mod === b.mod && a.shift === b.shift && a.alt === b.alt && a.key === b.key
}

/** Canonical string for grouping/conflict keys, e.g. "mod+shift+z". */
export function comboToString(c: KeyCombo): string {
  return [c.mod && 'mod', c.shift && 'shift', c.alt && 'alt', c.key].filter(Boolean).join('+')
}

/** Human display label, e.g. "⌘⇧K" (mac) or "Ctrl+Shift+K" (other). */
export function comboLabel(c: KeyCombo, platform: Platform = 'other'): string {
  const mod = platform === 'mac' ? '⌘' : 'Ctrl'
  const parts: string[] = []
  if (c.mod) parts.push(mod)
  if (c.shift) parts.push(platform === 'mac' ? '⇧' : 'Shift')
  if (c.alt) parts.push(platform === 'mac' ? '⌥' : 'Alt')
  parts.push(c.key.length === 1 ? c.key.toUpperCase() : c.key)
  return platform === 'mac' ? parts.join('') : parts.join('+')
}

export function detectPlatform(): Platform {
  try {
    const p = typeof navigator !== 'undefined' ? navigator.platform : ''
    return /mac|iphone|ipad/i.test(p) ? 'mac' : 'other'
  } catch {
    return 'other'
  }
}
