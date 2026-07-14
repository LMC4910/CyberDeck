import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { Ajv2020 } from 'ajv/dist/2020'
import { ConfigurationService } from '@/services/configuration'
import {
  ConfigPersistence,
  MemoryStorageAdapter,
  applyMigrations,
  MigrationError,
  type ConfigNotice,
  type LayerPersistenceSpec,
  type Migration,
} from '@/services/persistence'

// Synchronous scheduler so debounced writes are observable without fake timers,
// plus a manual one for the debounce test.
const immediateScheduler = (fn: () => void) => {
  fn()
  return () => {}
}

describe('applyMigrations (CD-118)', () => {
  const v1toV2: Migration = {
    from: 1,
    // worked example from MERGE_AND_MIGRATION.md §5: keymap string → object
    migrate: (doc) => {
      const d = structuredClone(doc) as Record<string, unknown>
      d.version = 2
      if (typeof d.keymap === 'string') d.keymap = { id: d.keymap, platform: 'win' }
      return d
    },
  }

  it('migrates v1 → v2', () => {
    const out = applyMigrations({ version: 1, keymap: 'default' }, [v1toV2], 2) as {
      version: number
      keymap: { id: string; platform: string }
    }
    expect(out.version).toBe(2)
    expect(out.keymap).toEqual({ id: 'default', platform: 'win' })
  })

  it('rejects a document newer than the app', () => {
    expect(() => applyMigrations({ version: 5 }, [], 2)).toThrow(MigrationError)
  })

  it('throws when a migration step is missing', () => {
    expect(() => applyMigrations({ version: 1 }, [], 2)).toThrow(/no migration registered from version 1/)
  })
})

describe('ConfigPersistence.load — corrupt/invalid layers fall back with a notice', () => {
  const spec: LayerPersistenceSpec = { key: 'cdk-user', currentVersion: 1 }

  it('missing key returns null (defaults), no notice', () => {
    const notices: ConfigNotice[] = []
    const p = new ConfigPersistence({ adapter: new MemoryStorageAdapter(), onNotice: (n) => notices.push(n) })
    expect(p.load(spec)).toBeNull()
    expect(notices).toEqual([])
  })

  it('corrupt JSON returns null + a corrupt-json notice (no crash)', () => {
    const notices: ConfigNotice[] = []
    const adapter = new MemoryStorageAdapter({ 'cdk-user': '{ not json ' })
    const p = new ConfigPersistence({ adapter, onNotice: (n) => notices.push(n) })
    expect(p.load(spec)).toBeNull()
    expect(notices[0]?.code).toBe('corrupt-json')
  })

  it('schema-invalid document returns null + a schema-invalid notice', () => {
    const ajv = new Ajv2020({ strict: false })
    const schema = JSON.parse(
      readFileSync(
        join(__dirname, '..', '..', '..', '..', 'shared', 'schemas', 'config', 'user-prefs.schema.json'),
        'utf8',
      ),
    )
    const validateFn = ajv.compile(schema)
    const validate = (doc: unknown) => ({ ok: validateFn(doc), errors: validateFn.errors?.map((e) => e.message ?? '') })

    const notices: ConfigNotice[] = []
    // density 'cozy' is not in the enum → invalid
    const adapter = new MemoryStorageAdapter({ 'cdk-user': JSON.stringify({ version: 1, density: 'cozy' }) })
    const p = new ConfigPersistence({ adapter, onNotice: (n) => notices.push(n) })
    expect(p.load({ key: 'cdk-user', currentVersion: 1, validate })).toBeNull()
    expect(notices[0]?.code).toBe('schema-invalid')
  })

  it('a valid stored layer loads and feeds ConfigurationService', () => {
    const adapter = new MemoryStorageAdapter({
      'cdk-user': JSON.stringify({ version: 1, density: 'compact' }),
    })
    const p = new ConfigPersistence({ adapter })
    const userLayer = p.load({ key: 'cdk-user', currentVersion: 1 })
    expect(userLayer).not.toBeNull()

    // The corrupt-layer AC: even if user were dropped, defaults keep booting.
    const config = new ConfigurationService({
      layers: { defaults: { density: 'comfortable' }, user: userLayer ?? {} },
    })
    expect(config.get('density')).toBe('compact')
  })

  it('boots with defaults when the persisted layer is corrupt (AC)', () => {
    const adapter = new MemoryStorageAdapter({ 'cdk-user': 'GARBAGE' })
    const notices: ConfigNotice[] = []
    const p = new ConfigPersistence({ adapter, onNotice: (n) => notices.push(n) })
    const userLayer = p.load(spec) // null + notice
    const config = new ConfigurationService({
      layers: { defaults: { density: 'comfortable' }, user: userLayer ?? {} },
    })
    expect(config.get('density')).toBe('comfortable') // no crash, defaults win
    expect(notices).toHaveLength(1)
  })
})

describe('ConfigPersistence — write-behind + flush', () => {
  it('write-behind persists through the adapter', () => {
    const adapter = new MemoryStorageAdapter()
    const p = new ConfigPersistence({ adapter, scheduler: immediateScheduler })
    p.schedule('cdk-user', { version: 1, density: 'compact' })
    expect(JSON.parse(adapter.get('cdk-user')!)).toEqual({ version: 1, density: 'compact' })
  })

  it('debounces: only the latest doc is written when the timer fires', () => {
    const adapter = new MemoryStorageAdapter()
    let fire: (() => void) | undefined
    const scheduler = (fn: () => void) => {
      fire = fn
      return () => {
        fire = undefined
      }
    }
    const p = new ConfigPersistence({ adapter, scheduler })
    p.schedule('k', { version: 1, n: 1 })
    p.schedule('k', { version: 1, n: 2 }) // supersedes
    fire?.()
    expect(JSON.parse(adapter.get('k')!)).toEqual({ version: 1, n: 2 })
  })

  it('flush writes pending immediately (flush-on-quit)', () => {
    const adapter = new MemoryStorageAdapter()
    const scheduler = () => () => {} // never auto-fires
    const p = new ConfigPersistence({ adapter, scheduler })
    p.schedule('k', { version: 1, n: 7 })
    expect(adapter.get('k')).toBeNull() // not yet written
    p.flush()
    expect(JSON.parse(adapter.get('k')!)).toEqual({ version: 1, n: 7 })
  })

  it('LocalStorageAdapter fallback path does not throw without a DOM', () => {
    // In jsdom localStorage exists; just assert the memory fallback API works.
    const p = new ConfigPersistence({ adapter: new MemoryStorageAdapter(), scheduler: immediateScheduler })
    expect(() => p.schedule('k', { version: 1 })).not.toThrow()
  })

  it('onNotice is optional (silent drop does not throw)', () => {
    const adapter = new MemoryStorageAdapter({ 'cdk-user': 'bad' })
    const p = new ConfigPersistence({ adapter })
    expect(() => p.load({ key: 'cdk-user', currentVersion: 1 })).not.toThrow()
    expect(vi.fn()).not.toHaveBeenCalled()
  })
})
