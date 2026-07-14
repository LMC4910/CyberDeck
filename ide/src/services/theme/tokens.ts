// Theme token schema + the design's Dark Cyber tokens (CD-134), extracted from
// the Phase-4 design CSS custom properties. A theme is a flat token→value map
// applied to :root as CSS variables; a second minimal theme proves the pipeline.

export type ThemeMode = 'dark' | 'light'

export interface Theme {
  id: string
  name: string
  mode: ThemeMode
  /** token name (without the leading --) → CSS value. */
  tokens: Record<string, string>
}

// Dark Cyber — the design's default theme (design :root CSS vars).
export const CYBER_DARK: Theme = {
  id: 'cyber-dark',
  name: 'Dark Cyber',
  mode: 'dark',
  tokens: {
    accent: '#4CC2FF',
    'accent-rgb': '76,194,255',
    good: '#37e08a',
    warn: '#f5b14c',
    bad: '#ff6b7d',
    panel: '#0e0e1c',
    panel2: '#12121f',
    line: 'rgba(255,255,255,.07)',
    line2: 'rgba(255,255,255,.12)',
    ink: '#EAEAF6',
    ink2: '#8a8cb4',
    ink3: '#6a6c92',
    bg: '#0a0a14',
  },
}

// A second, minimal theme — same token keys, light values — proving hot-swap.
export const CYBER_LIGHT: Theme = {
  id: 'cyber-light',
  name: 'Light',
  mode: 'light',
  tokens: {
    accent: '#0066cc',
    'accent-rgb': '0,102,204',
    good: '#1a8f4e',
    warn: '#b5730a',
    bad: '#c22133',
    panel: '#ffffff',
    panel2: '#f4f4f8',
    line: 'rgba(0,0,0,.08)',
    line2: 'rgba(0,0,0,.14)',
    ink: '#12121f',
    ink2: '#55566f',
    ink3: '#84869c',
    bg: '#eef0f6',
  },
}

export const BUILTIN_THEMES: Theme[] = [CYBER_DARK, CYBER_LIGHT]

/** The token key set the app relies on — a theme must define all of them. */
export const REQUIRED_TOKENS = Object.keys(CYBER_DARK.tokens)
