// Widget platform shared types (CD-419). The loader/registry/permissions live in
// the services layer (headless, injected-port design mirroring CD-118 persistence);
// the React surface (host/error-boundary/cards) lives in src/widgets/host and
// imports these. Discovery flows through an injected port so this layer never
// imports repositories (boundary-clean) — assembly wires WidgetManifestsRepository.
import type { CyberDeckWidgetManifestV2 } from '@/shared/contract'

/** The v2 widget manifest (generated from shared/schemas/widget-manifest.schema.json). */
export type WidgetManifest = CyberDeckWidgetManifestV2

/** Declared capability vocabulary — exactly the design's PERMS() set (§12). */
export type WidgetCapability = NonNullable<WidgetManifest['permissions']>[number]

/** Runtime list of the known capabilities (schema enum mirror). */
export const KNOWN_CAPABILITIES: readonly WidgetCapability[] = [
  'network',
  'notifications',
  'media',
  'git',
  'devices',
  'environment',
  'filesystem',
  'clipboard',
  'automation',
]

export function isKnownCapability(value: unknown): value is WidgetCapability {
  return typeof value === 'string' && (KNOWN_CAPABILITIES as readonly string[]).includes(value)
}
