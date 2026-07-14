import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { runBoot } from '@/platform/boot'
import {
  ThemeService,
  ThemeMissingTokensError,
  CYBER_DARK,
  CYBER_LIGHT,
} from '@/services/theme'

// A fake :root that records set CSS variables.
function fakeRoot() {
  const vars = new Map<string, string>()
  return {
    vars,
    root: { style: { setProperty: (name: string, value: string) => void vars.set(name, value) } },
  }
}

describe('ThemeService — applies tokens to :root', () => {
  it('writes every token as a --var', () => {
    const { vars, root } = fakeRoot()
    const svc = new ThemeService({ root })
    svc.apply('cyber-dark')
    expect(vars.get('--accent')).toBe(CYBER_DARK.tokens.accent)
    expect(vars.get('--ink')).toBe(CYBER_DARK.tokens.ink)
    expect(svc.current()).toBe('cyber-dark')
  })

  it('rejects a theme missing required tokens', () => {
    const svc = new ThemeService({ root: fakeRoot().root })
    expect(() =>
      svc.register({ id: 'broken', name: 'B', mode: 'dark', tokens: { accent: '#000' } }),
    ).toThrow(ThemeMissingTokensError)
  })

  it('unknown theme id throws', () => {
    const svc = new ThemeService({ root: fakeRoot().root })
    expect(() => svc.apply('ghost')).toThrow(/unknown theme/)
  })
})

describe('ThemeService — hot-swap without reload; ThemeChanged observed', () => {
  it('rewrites variables and emits ThemeChanged on swap', () => {
    const { vars, root } = fakeRoot()
    const changed: string[] = []
    const svc = new ThemeService({ root, onThemeChanged: (i) => changed.push(i.id) })

    svc.apply('cyber-dark')
    expect(vars.get('--panel')).toBe(CYBER_DARK.tokens.panel)

    svc.apply('cyber-light') // hot swap — same keys, new values
    expect(vars.get('--panel')).toBe(CYBER_LIGHT.tokens.panel)
    expect(vars.get('--ink')).toBe(CYBER_LIGHT.tokens.ink)

    expect(changed).toEqual(['cyber-dark', 'cyber-light'])
  })

  it('the second theme proves the pipeline (both builtins registered)', () => {
    const svc = new ThemeService({ root: fakeRoot().root })
    expect(svc.list().map((t) => t.id).sort()).toEqual(['cyber-dark', 'cyber-light'])
  })
})

describe('ThemeService — no flash (applied before first paint)', () => {
  beforeEach(() => performance.clearMarks?.())
  afterEach(() => performance.clearMarks?.())

  it('as a blocking boot phase, tokens are set before a later paint phase', async () => {
    const { vars, root } = fakeRoot()
    const svc = new ThemeService({ root })
    let paintedWith: string | undefined

    await runBoot(
      [
        { id: 'theme-engine', blocking: true, run: () => svc.apply('cyber-dark') },
        {
          id: 'first-paint',
          blocking: false,
          run: () => {
            paintedWith = vars.get('--accent') // paint reads the applied token
            performance.mark('cyberdeck:paint')
          },
        },
      ],
      { order: ['theme-engine', 'first-paint'], now: (() => { let t = 0; return () => ++t })() },
    )

    // tokens were present at paint time (no flash)
    expect(paintedWith).toBe(CYBER_DARK.tokens.accent)
    // and the theme mark precedes the paint mark
    const names = performance.getEntriesByType('mark').map((m) => m.name)
    expect(names.indexOf('cyberdeck:theme:applied')).toBeLessThan(names.indexOf('cyberdeck:paint'))
  })
})
