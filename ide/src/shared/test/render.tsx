// Render helper skeleton (CD-107). Today it only forwards to RTL's render;
// as the platform grows it wraps the UI in the providers every component
// expects (stores, theme, container) so feature tests never assemble
// providers by hand. Import from '@/shared/test' in any feature folder —
// shared is importable everywhere without a boundary violation.
import type { ReactElement } from 'react'
import { render, type RenderOptions, type RenderResult } from '@testing-library/react'

// Becomes an interface with container/store/theme overrides alongside
// CD-119/CD-130/CD-134.
export type ProviderOptions = RenderOptions

export function renderWithProviders(
  ui: ReactElement,
  options?: ProviderOptions,
): RenderResult {
  return render(ui, options)
}
