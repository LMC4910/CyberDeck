// Publish / flatten v0 (CD-416) — the shared, pure projection of a
// `cyberdeck.project` authoring document into per-device `cyberdeck.layout`
// documents, plus the byte-stable canonical JSON serializer that pins the exact
// bytes the Go engine (CD-506) must reproduce.
//
// This module is `shared`: it imports ONLY other `shared` code, performs no IO,
// touches no DOM/React/stores/repositories, and never reads a clock or RNG. Every
// non-deterministic input is supplied by the caller through FlattenOptions.
export {
  flattenProject,
  flattenForDevice,
  CircularComponentError,
  type FlattenOptions,
  type DeviceLayout,
} from './flatten'
export { canonicalStringify } from './canonical-json'
