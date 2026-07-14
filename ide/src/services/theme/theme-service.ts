// ThemeService (CD-134). Applies theme tokens to :root as CSS custom properties
// at boot stage 5 (pre-paint → no flash), and hot-swaps at runtime by rewriting
// the variables and emitting ThemeChanged (chrome restyles with no reload). The
// `apply` used as a blocking boot phase guarantees tokens exist before first paint.
import { BUILTIN_THEMES, REQUIRED_TOKENS, type Theme } from './tokens'

const MARK = 'cyberdeck:theme:applied'

export interface ThemeChangedInfo {
  id: string
  mode: Theme['mode']
}

export interface ThemeServiceOptions {
  /** Element to set variables on. Default document.documentElement. */
  root?: { style: { setProperty(name: string, value: string): void } }
  themes?: Theme[]
  /** Emitted after a successful apply (wiring bridges to the bus + config). */
  onThemeChanged?: (info: ThemeChangedInfo) => void
}

export class ThemeMissingTokensError extends Error {
  constructor(id: string, missing: string[]) {
    super(`theme "${id}" is missing required tokens: ${missing.join(', ')}`)
    this.name = 'ThemeMissingTokensError'
  }
}

export class ThemeService {
  private readonly root: NonNullable<ThemeServiceOptions['root']>
  private readonly themes = new Map<string, Theme>()
  private readonly onThemeChanged?: (info: ThemeChangedInfo) => void
  private currentId: string | null = null

  constructor(options: ThemeServiceOptions = {}) {
    this.root =
      options.root ??
      (typeof document !== 'undefined'
        ? document.documentElement
        : { style: { setProperty() {} } })
    this.onThemeChanged = options.onThemeChanged
    for (const theme of options.themes ?? BUILTIN_THEMES) this.register(theme)
  }

  register(theme: Theme): void {
    const missing = REQUIRED_TOKENS.filter((t) => !(t in theme.tokens))
    if (missing.length) throw new ThemeMissingTokensError(theme.id, missing)
    this.themes.set(theme.id, theme)
  }

  list(): Theme[] {
    return [...this.themes.values()]
  }

  current(): string | null {
    return this.currentId
  }

  /**
   * Apply a theme: write every token to :root as `--<token>`, mark the paint
   * point, and emit ThemeChanged. Synchronous so it can gate first paint.
   */
  apply(themeId: string): void {
    const theme = this.themes.get(themeId)
    if (!theme) throw new Error(`unknown theme "${themeId}"`)
    for (const [name, value] of Object.entries(theme.tokens)) {
      this.root.style.setProperty(`--${name}`, value)
    }
    this.currentId = themeId
    safeMark(MARK)
    this.onThemeChanged?.({ id: theme.id, mode: theme.mode })
  }
}

function safeMark(name: string): void {
  try {
    performance.mark(name)
  } catch {
    /* no-op */
  }
}
