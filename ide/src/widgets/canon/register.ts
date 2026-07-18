// Canon registration (CD-423). Registers every canon manifest into the platform
// registry at boot; CD-421's useInsertCatalog then surfaces them across Insert /
// Library / palette / canvas. Kept as a plain function over a minimal registry
// interface so it needs no value import of the WidgetRegistry class.
import type { WidgetManifest } from '@/services/widgets'
import { CANON_MANIFESTS } from './manifests'

/** The registry surface registration needs — satisfied by services/widgets' WidgetRegistry. */
export interface CanonRegistryTarget {
  register(manifest: WidgetManifest): unknown
}

/** Register the full canon set. Idempotent per id (the registry replaces on re-register). */
export function registerCanonWidgets(registry: CanonRegistryTarget): void {
  for (const manifest of CANON_MANIFESTS) registry.register(manifest)
}
