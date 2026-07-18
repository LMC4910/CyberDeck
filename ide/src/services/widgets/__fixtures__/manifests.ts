// Owned test fixtures for the widget loader (CD-419). Good/bad manifests for the
// dependency + validation paths the shared canon fixtures don't cover (cycles,
// missing deps, duplicates, platform mismatch). The real schema good/bad fixtures
// live in shared/schemas/widgets and are read read-only by the validator tests.
import type { WidgetManifest } from '../types'

/** Build a minimal-but-valid manifest, overridable per test. */
export function makeManifest(id: string, over: Partial<WidgetManifest> = {}): WidgetManifest {
  return {
    id,
    version: '1.0.0',
    metadata: { label: id },
    dependencies: { platform: '>=2.0', widgets: [] },
    lifecycle: { lazy: true, chunk: id.split('.')[0] },
    ...over,
  }
}

/** A clean set with a real dependency edge: chart depends on gauge. */
export const VALID_WITH_DEPS: WidgetManifest[] = [
  makeManifest('chart.line', { dependencies: { platform: '>=2.0', widgets: ['gauge.circular'] } }),
  makeManifest('gauge.circular'),
  makeManifest('text.label'),
]

/** chart depends on a widget that was never discovered. */
export const MISSING_DEP: WidgetManifest[] = [
  makeManifest('chart.line', { dependencies: { widgets: ['gauge.circular'] } }),
  makeManifest('text.label'),
]

/** a → b → a. */
export const CYCLE: WidgetManifest[] = [
  makeManifest('alpha.one', { dependencies: { widgets: ['beta.two'] } }),
  makeManifest('beta.two', { dependencies: { widgets: ['alpha.one'] } }),
  makeManifest('text.label'),
]

/** Two manifests claiming the same id. */
export const DUPLICATE_ID: WidgetManifest[] = [
  makeManifest('gauge.circular', { metadata: { label: 'First' } }),
  makeManifest('gauge.circular', { metadata: { label: 'Second' } }),
]

/** Needs a newer platform than the host. */
export const PLATFORM_TOO_NEW: WidgetManifest[] = [
  makeManifest('future.widget', { dependencies: { platform: '>=9.0' } }),
]

/** Structurally broken manifests (rejected by validation, never registered). */
export const BAD_MANIFESTS: unknown[] = [
  null,
  42,
  { version: '1.0.0', metadata: { label: 'no id' } }, // missing id
  { id: 'Bad_Id', version: '1.0.0', metadata: { label: 'bad id' } }, // id pattern
  { id: 'bad.semver', version: 'not-semver', metadata: { label: 'x' } },
  { id: 'no.label', version: '1.0.0', metadata: {} }, // missing label
  {
    id: 'undeclared.perm',
    version: '1.0.0',
    metadata: { label: 'x' },
    permissions: ['telepathy'],
  }, // undeclared capability
  {
    id: 'poll.nointerval',
    version: '1.0.0',
    metadata: { label: 'x' },
    refresh: { strategy: 'poll' },
  }, // poll without interval
]
