import { describe, expect, it } from 'vitest'
import {
  createRuntimeStore,
  appendRuntime,
  createNotificationStore,
  projectNotification,
  RUNTIME_CAP,
} from '@/stores'
import { createAllStores, storesManifest } from '@/stores'
import type { RuntimeLogEvent, NotificationReceivedEvent } from '@/shared/contract'

describe('Runtime store — capped ring buffer', () => {
  it('keeps at most the cap, dropping oldest', () => {
    const store = createRuntimeStore()
    for (let i = 0; i < 10; i++) {
      appendRuntime(store, { level: 'info', message: `m${i}` } as RuntimeLogEvent, 3)
    }
    const entries = store.getState().entries
    expect(entries).toHaveLength(3)
    expect(entries.map((e) => e.message)).toEqual(['m7', 'm8', 'm9'])
  })

  it('defaults to RUNTIME_CAP', () => {
    const store = createRuntimeStore()
    for (let i = 0; i < RUNTIME_CAP + 50; i++) {
      appendRuntime(store, { level: 'info', message: `${i}` } as RuntimeLogEvent)
    }
    expect(store.getState().entries).toHaveLength(RUNTIME_CAP)
  })
})

describe('Notification store — derived projection', () => {
  it('projects NotificationReceived events (newest first)', () => {
    const store = createNotificationStore()
    projectNotification(store, { id: 'n1', level: 'info' } as NotificationReceivedEvent)
    projectNotification(store, { id: 'n2', level: 'error' } as NotificationReceivedEvent)
    expect(store.getState().items.map((i) => i.id)).toEqual(['n2', 'n1'])
    expect(store.descriptor.kind).toBe('derived')
  })
})

describe('persistence map matches STORES() 13 rows exactly', () => {
  it('has exactly the 13 design stores with the right kinds', () => {
    const manifest = storesManifest(createAllStores())
    expect(manifest).toHaveLength(13)

    const byName = Object.fromEntries(manifest.map((r) => [r.name, r]))
    // boot-critical
    expect(byName.preferences).toMatchObject({ kind: 'persisted', location: 'cdk-prefs' })
    expect(byName.workspace).toMatchObject({ kind: 'persisted', location: 'cdk-layout' })
    expect(byName.auth).toMatchObject({ kind: 'persisted', location: 'cdk-auth' })
    expect(byName.ui).toMatchObject({ kind: 'temp' })
    // domain
    expect(byName.project).toMatchObject({ kind: 'persisted', location: 'cdk-project' })
    expect(byName.widget).toMatchObject({ kind: 'derived' })
    expect(byName.editor).toMatchObject({ kind: 'persisted', location: 'cdk-editor' })
    expect(byName.binding).toMatchObject({ kind: 'persisted', location: 'cdk-bindings' })
    expect(byName.history).toMatchObject({ kind: 'temp' })
    expect(byName.repositoryCache).toMatchObject({ kind: 'cached' })
    expect(byName.ai).toMatchObject({ kind: 'server' })
    expect(byName.runtime).toMatchObject({ kind: 'temp' })
    expect(byName.notification).toMatchObject({ kind: 'derived' })
  })

  it('every persisted store has a distinct storage location', () => {
    const persisted = storesManifest(createAllStores()).filter((r) => r.kind === 'persisted')
    const locations = persisted.map((r) => r.location)
    expect(new Set(locations).size).toBe(locations.length)
    expect(locations.every(Boolean)).toBe(true)
  })
})
