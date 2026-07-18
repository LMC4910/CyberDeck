// Canon widget set (CD-423) — the M3 widgets as platform manifests + lazily-imported
// modules. Assembly registers CANON_MANIFESTS into the WidgetRegistry (surfacing them
// across every catalog via CD-421) and feeds `canonResolver` to the widget host so each
// module code-splits and loads on first render. No canon widget is statically imported
// (enforced by zero-static-imports.test.ts).
export { CANON_MANIFESTS, CANON_IDS } from './manifests'
export { canonResolver, hasCanonModule, type CanonModule } from './resolver'
export { registerCanonWidgets, type CanonRegistryTarget } from './register'
