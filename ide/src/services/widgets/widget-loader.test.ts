// CD-419: manifest loader/validator. Proves the two ACs — bad-manifest fixtures
// are rejected *gracefully* (a notification, never a throw/crash) and the valid
// set registers with dependencies resolved (dependency-first order, cycles and
// missing deps detected). Also proves the `WidgetLoaded` event fires per widget
// and the loader survives a discovery blow-up. The validator is exercised both
// against the real CD-110 ajv schema (fromAjv) and via the structural fallback.
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { Ajv2020 } from 'ajv/dist/2020'
import type { WidgetLoadedEvent } from '@/shared/contract'
import { WidgetLoader, type WidgetLoaderOptions, type WidgetLoadNotice } from './widget-loader'
import { WidgetRegistry } from './widget-registry'
import {
  fromAjv,
  structuralManifestValidator,
  type ManifestValidator,
} from './manifest-validator'
import { resolveDependencies } from './dependency-resolver'
import {
  BAD_MANIFESTS,
  CYCLE,
  DUPLICATE_ID,
  MISSING_DEP,
  PLATFORM_TOO_NEW,
  VALID_WITH_DEPS,
  makeManifest,
} from './__fixtures__/manifests'
import type { WidgetManifest } from './types'

// ---- an ajv validator built from the *real* CD-110 schema (assembly's path) ----
const schemasDir = join(__dirname, '..', '..', '..', '..', 'shared', 'schemas')
const readJson = (p: string) => JSON.parse(readFileSync(p, 'utf8')) as Record<string, unknown>
const ajv = new Ajv2020({ strict: false, allErrors: true })
const ajvValidate = ajv.compile(readJson(join(schemasDir, 'widget-manifest.schema.json')))
const schemaValidator = fromAjv(ajvValidate)

// Build a loader with captured notices + emitted events; validator is pluggable so
// both validation paths (real schema / structural fallback) get the same coverage.
function makeLoader(
  discovered: unknown[] | (() => Promise<unknown[]> | unknown[]),
  validate: ManifestValidator = structuralManifestValidator,
  platformVersion = '2.0.0',
) {
  const notices: WidgetLoadNotice[] = []
  const events: WidgetLoadedEvent[] = []
  const registry = new WidgetRegistry({ emit: (e) => events.push(e), now: () => 123 })
  // Tests deliberately feed malformed input; cast at the discovery port boundary
  // (the same boundary that in production hands raw repo rows to the validator).
  const discover = (
    typeof discovered === 'function' ? discovered : () => discovered
  ) as WidgetLoaderOptions['discover']
  const loader = new WidgetLoader({
    discover,
    validate,
    registry,
    notify: (n) => notices.push(n),
    platformVersion,
  })
  return { loader, registry, notices, events }
}

describe('WidgetLoader — valid set (AC: registers with deps resolved)', () => {
  it('registers a clean set and orders dependencies first', async () => {
    const { loader, registry } = makeLoader(VALID_WITH_DEPS)
    const result = await loader.load()

    expect(result.rejected).toEqual([])
    expect([...result.registered].sort()).toEqual(['chart.line', 'gauge.circular', 'text.label'])
    // chart.line depends on gauge.circular ⇒ gauge registered before chart.
    expect(result.registered.indexOf('gauge.circular')).toBeLessThan(
      result.registered.indexOf('chart.line'),
    )
    expect(registry.size).toBe(3)
    expect(registry.get('chart.line')?.metadata.label).toBe('chart.line')
  })

  it('emits a WidgetLoaded event per registered widget', async () => {
    const { loader, events } = makeLoader(VALID_WITH_DEPS)
    await loader.load()
    expect(events.map((e) => e.widgetId).sort()).toEqual([
      'chart.line',
      'gauge.circular',
      'text.label',
    ])
    expect(events.every((e) => e.ts === 123 && e.type === e.widgetId)).toBe(true)
  })

  it('validates the real canon manifests through the ajv schema and registers them', async () => {
    const canon = readdirSync(join(schemasDir, 'widgets'))
      .filter((f) => f.endsWith('.manifest.json'))
      .map((f) => readJson(join(schemasDir, 'widgets', f)))
    const { loader, registry } = makeLoader(canon, schemaValidator)
    const result = await loader.load()
    expect(result.rejected).toEqual([])
    expect(registry.size).toBe(canon.length)
  })
})

describe('WidgetLoader — bad manifests (AC: rejected gracefully, never a crash)', () => {
  it('rejects every structurally-broken fixture with a notification and never throws', async () => {
    const { loader, registry, notices } = makeLoader(BAD_MANIFESTS)
    // The whole point: no throw even on null/number/garbage input.
    const result = await loader.load()
    expect(registry.size).toBe(0)
    expect(result.registered).toEqual([])
    expect(result.rejected.length).toBe(BAD_MANIFESTS.length)
    expect(notices.length).toBe(BAD_MANIFESTS.length)
    expect(notices.every((n) => n.code === 'schema-invalid')).toBe(true)
  })

  it('rejects the same bad fixtures through the real ajv schema validator', async () => {
    const { loader, registry, notices } = makeLoader(BAD_MANIFESTS, schemaValidator)
    await loader.load()
    expect(registry.size).toBe(0)
    expect(notices.every((n) => n.code === 'schema-invalid')).toBe(true)
  })

  it('rejects a widget declaring an undeclared capability (permission validation)', async () => {
    const bad = { id: 'x.y', version: '1.0.0', metadata: { label: 'x' }, permissions: ['telepathy'] }
    const { loader, registry, notices } = makeLoader([bad])
    await loader.load()
    expect(registry.size).toBe(0)
    expect(notices[0]?.message).toContain('undeclared permission "telepathy"')
  })

  it('survives a discovery that throws (surfaces an error notice, no crash)', async () => {
    const { loader, registry, notices } = makeLoader(() => {
      throw new Error('repo exploded')
    })
    const result = await loader.load()
    expect(registry.size).toBe(0)
    expect(result.registered).toEqual([])
    expect(notices[0]?.code).toBe('discovery-failed')
    expect(notices[0]?.level).toBe('error')
  })

  it('survives an async discovery rejection', async () => {
    const { loader, notices } = makeLoader(() => Promise.reject(new Error('async boom')))
    await expect(loader.load()).resolves.toBeDefined()
    expect(notices[0]?.code).toBe('discovery-failed')
  })
})

describe('WidgetLoader — dependency + platform gates', () => {
  it('rejects a widget whose dependency is missing, keeps the resolvable rest', async () => {
    const { loader, registry, notices } = makeLoader(MISSING_DEP)
    const result = await loader.load()
    expect(result.registered).toEqual(['text.label'])
    expect(registry.has('chart.line')).toBe(false)
    expect(notices.some((n) => n.code === 'missing-dependency' && n.widgetId === 'chart.line')).toBe(
      true,
    )
  })

  it('detects a dependency cycle and registers only the clean widget', async () => {
    const { loader, registry, notices } = makeLoader(CYCLE)
    const result = await loader.load()
    expect(result.registered).toEqual(['text.label'])
    expect(registry.has('alpha.one')).toBe(false)
    expect(registry.has('beta.two')).toBe(false)
    expect(notices.some((n) => n.code === 'dependency-cycle')).toBe(true)
  })

  it('keeps the first of a duplicate id and rejects the rest', async () => {
    const { loader, registry, notices } = makeLoader(DUPLICATE_ID)
    const result = await loader.load()
    expect(result.registered).toEqual(['gauge.circular'])
    expect(registry.get('gauge.circular')?.metadata.label).toBe('First')
    expect(notices.some((n) => n.code === 'duplicate-id')).toBe(true)
  })

  it('rejects a widget needing a newer platform than the host', async () => {
    const { loader, registry, notices } = makeLoader(PLATFORM_TOO_NEW, structuralManifestValidator, '2.1.0')
    await loader.load()
    expect(registry.size).toBe(0)
    expect(notices[0]?.code).toBe('platform-unsatisfied')
  })

  it('accepts a widget whose platform range the host satisfies', async () => {
    const ok = makeManifest('fine.widget', { dependencies: { platform: '>=2.0' } })
    const { loader, registry } = makeLoader([ok], structuralManifestValidator, '2.5.0')
    await loader.load()
    expect(registry.has('fine.widget')).toBe(true)
  })
})

describe('resolveDependencies (unit)', () => {
  it('returns dependency-first order for a chain a→b→c', () => {
    const chain: WidgetManifest[] = [
      makeManifest('a.one', { dependencies: { widgets: ['b.two'] } }),
      makeManifest('b.two', { dependencies: { widgets: ['c.three'] } }),
      makeManifest('c.three'),
    ]
    const { order, missing, cycles } = resolveDependencies(chain)
    expect(missing).toEqual([])
    expect(cycles).toEqual([])
    expect(order.indexOf('c.three')).toBeLessThan(order.indexOf('b.two'))
    expect(order.indexOf('b.two')).toBeLessThan(order.indexOf('a.one'))
  })

  it('marks a dependent of an unresolvable widget as unresolved too', () => {
    const graph: WidgetManifest[] = [
      makeManifest('top', { dependencies: { widgets: ['mid'] } }),
      makeManifest('mid', { dependencies: { widgets: ['ghost'] } }), // ghost is absent
    ]
    const { order, unresolved } = resolveDependencies(graph)
    expect(order).toEqual([])
    expect(unresolved.sort()).toEqual(['mid', 'top'])
  })
})

describe('WidgetRegistry (unit)', () => {
  it('notifies subscribers on register and unregister', () => {
    const registry = new WidgetRegistry()
    const listener = vi.fn()
    const off = registry.subscribe(listener)
    registry.register(makeManifest('a.b'))
    expect(listener).toHaveBeenCalledTimes(1)
    registry.unregister('a.b')
    expect(listener).toHaveBeenCalledTimes(2)
    off()
    registry.register(makeManifest('c.d'))
    expect(listener).toHaveBeenCalledTimes(2) // unsubscribed
  })
})
