// Platform Inspector (CD-137). A dev surface (behind the devTools flag, lazy
// chunk) that renders LIVE kernel state — no fixtures: services from the
// container's registrations, stores from their live persistence descriptors, and
// feature flags that toggle ConfigurationService (emitting SettingsChanged).
import { useState } from 'react'
import type { ServiceContainer } from '@/platform/container'
import type { ConfigurationService } from '@/services/configuration'
import type { Store } from '@/stores'
import { useStore } from '@/stores'

export interface InspectorProps {
  container: ServiceContainer
  stores: Array<Store<unknown>>
  config: ConfigurationService
}

type Tab = 'services' | 'stores' | 'flags'

export function InspectorPanel({ container, stores, config }: InspectorProps) {
  const [tab, setTab] = useState<Tab>('services')
  return (
    <section className="inspector" aria-label="Platform Inspector">
      <div role="tablist" className="inspector-tabs">
        {(['services', 'stores', 'flags'] as Tab[]).map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={tab === t ? 'on' : ''}
          >
            {t}
          </button>
        ))}
      </div>
      <div role="tabpanel">
        {tab === 'services' && <ServicesTab container={container} />}
        {tab === 'stores' && <StoresTab stores={stores} />}
        {tab === 'flags' && <FlagsTab config={config} />}
      </div>
    </section>
  )
}

function ServicesTab({ container }: { container: ServiceContainer }) {
  const rows = container.registrations_snapshot()
  return (
    <table>
      <tbody>
        {rows.map((r) => (
          <tr key={r.id} data-service={r.id}>
            <td>{r.id}</td>
            <td>{r.instantiated ? 'ready' : r.lazy ? 'lazy' : 'eager'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function StoresTab({ stores }: { stores: Array<Store<unknown>> }) {
  return (
    <table>
      <tbody>
        {stores.map((s) => (
          <tr key={s.descriptor.name} data-store={s.descriptor.name}>
            <td>{s.descriptor.name}</td>
            <td>{s.descriptor.kind}</td>
            <td>{s.descriptor.location ?? '—'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function FlagsTab({ config }: { config: ConfigurationService }) {
  const features = (config.get<Record<string, boolean>>('features') ?? {}) as Record<string, boolean>
  const ids = Object.keys(features)
  return (
    <table>
      <tbody>
        {ids.map((id) => (
          <FlagRow key={id} config={config} id={id} />
        ))}
      </tbody>
    </table>
  )
}

function FlagRow({ config, id }: { config: ConfigurationService; id: string }) {
  // live value: re-render is driven by re-reading after a toggle (config.set →
  // SettingsChanged); we keep a local mirror updated on toggle for immediate UI.
  const [value, setValue] = useState<boolean>(config.get<boolean>(`features.${id}`) ?? false)
  return (
    <tr data-flag={id}>
      <td>{id}</td>
      <td>
        <button
          role="switch"
          aria-checked={value}
          data-flag-toggle={id}
          onClick={() => {
            const next = !value
            config.set(`features.${id}`, next, 'runtime') // emits SettingsChanged
            setValue(next)
          }}
        >
          {value ? 'on' : 'off'}
        </button>
      </td>
    </tr>
  )
}

// Store-driven live example: a small badge that reflects a store's state so the
// Inspector proves "live, not fixtures" via useStore too.
export function StoreBadge<S>({ store, label }: { store: Store<S>; label: string }) {
  const state = useStore(store, (s) => s)
  return <span data-badge={label}>{JSON.stringify(state)}</span>
}
