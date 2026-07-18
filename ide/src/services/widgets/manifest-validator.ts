// Manifest validation (CD-419). Follows the CD-118 injected-validator idiom: this
// source never imports ajv — the schema validator is injected. `fromAjv` adapts an
// already-compiled ajv validate fn (built at assembly / in tests from the real
// shared/schemas/widget-manifest.schema.json) into a ManifestValidator, and a pure
// `structuralManifestValidator` gives ajv-free defence-in-depth (and a usable
// default when no schema validator is wired). Both also run permission-vocabulary
// validation, so an undeclared/misspelled capability is rejected, never registered.
import { KNOWN_CAPABILITIES, isKnownCapability } from './types'

export interface ManifestValidationResult {
  valid: boolean
  errors: string[]
}

/** A pluggable manifest validator (schema-backed at assembly, structural in the fallback). */
export type ManifestValidator = (manifest: unknown) => ManifestValidationResult

/** Minimal shape of a compiled ajv validate function. */
export interface AjvValidateFn {
  (data: unknown): boolean
  errors?: Array<{ instancePath?: string; message?: string }> | null
}

const ID_PATTERN = /^[a-z][a-z0-9]*(\.[a-z][a-z0-9-]*)+$/
const SEMVER_PATTERN = /^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/

function asRecord(value: unknown): Record<string, unknown> | null {
  return value != null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

/**
 * Permission-vocabulary check (the "permission validation" step, distinct from
 * schema shape). Every declared permission must be in the known capability set.
 */
export function validatePermissions(manifest: unknown): string[] {
  const rec = asRecord(manifest)
  if (!rec || rec.permissions == null) return []
  if (!Array.isArray(rec.permissions)) return ['permissions must be an array']
  const errors: string[] = []
  for (const perm of rec.permissions) {
    if (!isKnownCapability(perm)) {
      errors.push(
        `undeclared permission "${String(perm)}" (allowed: ${KNOWN_CAPABILITIES.join(', ')})`,
      )
    }
  }
  return errors
}

/**
 * Adapt a compiled ajv validate fn into a ManifestValidator. Permission-vocabulary
 * errors are appended even though the schema also enforces the enum (belt & braces:
 * a validator wired without the enum still rejects bad capabilities).
 */
export function fromAjv(validate: AjvValidateFn): ManifestValidator {
  return (manifest: unknown): ManifestValidationResult => {
    const ok = validate(manifest)
    const errors = ok
      ? []
      : (validate.errors ?? []).map(
          (e) => `${e.instancePath || '(root)'} ${e.message ?? 'is invalid'}`.trim(),
        )
    const permErrors = validatePermissions(manifest)
    for (const pe of permErrors) if (!errors.includes(pe)) errors.push(pe)
    return { valid: errors.length === 0, errors }
  }
}

/**
 * Pure, ajv-free validator covering the load-blocking invariants: required fields,
 * id/version patterns, permission vocabulary, and the poll-needs-interval rule.
 * Not a full JSON-Schema check — the injected ajv validator is authoritative; this
 * is the safety net when none is wired and keeps the loader honest in isolation.
 */
export const structuralManifestValidator: ManifestValidator = (manifest) => {
  const errors: string[] = []
  const rec = asRecord(manifest)
  if (!rec) return { valid: false, errors: ['manifest must be an object'] }

  if (typeof rec.id !== 'string' || !ID_PATTERN.test(rec.id)) {
    errors.push('id must be a dotted lowercase identifier, e.g. gauge.circular')
  }
  if (typeof rec.version !== 'string' || !SEMVER_PATTERN.test(rec.version)) {
    errors.push('version must be semver, e.g. 1.2.0')
  }

  const meta = asRecord(rec.metadata)
  if (!meta) {
    errors.push('metadata is required')
  } else if (typeof meta.label !== 'string' || meta.label.length === 0) {
    errors.push('metadata.label is required')
  }

  const refresh = asRecord(rec.refresh)
  if (refresh && refresh.strategy === 'poll' && typeof refresh.interval !== 'number') {
    errors.push('refresh.interval is required when strategy = poll')
  }

  for (const pe of validatePermissions(rec)) errors.push(pe)

  return { valid: errors.length === 0, errors }
}
