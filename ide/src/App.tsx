import { useEffect, useState } from 'react'
import './App.css'
import { runAppBoot, type BootedKernel } from '@/boot-sequence'
import {
  WorkspaceRail,
  PaneHost,
  Breadcrumb,
  StatusBar,
  CommandPalette,
  PaletteRecents,
  PreferencesDialog,
} from '@/workspaces'
import { LocalStorageAdapter } from '@/services/persistence'
import type { Store } from '@/stores'
import type { WhenContext } from '@/platform/commands'

const paletteRecents = new PaletteRecents({ storage: new LocalStorageAdapter() })

/**
 * Shell (progressively assembled through M2). Boots the kernel, then renders the
 * workspace rail, breadcrumb, lazy pane host, and status bar. Palette/prefs/dock
 * land in later M2 tickets.
 */
function App() {
  const [kernel, setKernel] = useState<BootedKernel | null>(null)
  const [active, setActive] = useState<string | null>(null)
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [prefsOpen, setPrefsOpen] = useState(false)
  const [prefsTab, setPrefsTab] = useState<'general' | 'appearance'>('general')

  useEffect(() => {
    let cancelled = false
    void runAppBoot().then((k) => {
      if (cancelled) return
      setKernel(k)
      setActive(k.workspaces.active())
      k.workspaces.subscribe((id) => setActive(id))
    })
    return () => {
      cancelled = true
    }
  }, [])

  // ⌘K / Ctrl+K opens the palette
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setPaletteOpen((v) => !v)
      } else if ((e.metaKey || e.ctrlKey) && e.key === ',') {
        e.preventDefault()
        setPrefsOpen(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const booted = kernel !== null
  const activeLabel = (active && kernel?.workspaces.get(active)?.label) || ''
  const commandContext: WhenContext = {
    workspace: active ?? undefined,
    flags: kernel?.config.get<Record<string, boolean>>('features'),
  }

  return (
    <div className="shell" data-boot={booted ? 'interactive' : 'booting'} data-testid="shell">
      <header className="shell-topbar">
        <span className="shell-brand">CyberDeck IDE</span>
        {kernel && (
          <Breadcrumb
            activeWorkspace={active}
            context={{ projectName: 'Untitled', leaf: activeLabel }}
            onNavigate={(id) => kernel.workspaces.setActive(id)}
          />
        )}
      </header>
      <div className="shell-body">
        {kernel ? (
          <WorkspaceRail service={kernel.workspaces} active={active} />
        ) : (
          <nav className="shell-rail" aria-label="Workspaces" />
        )}
        {kernel ? (
          <PaneHost service={kernel.workspaces} active={active} />
        ) : (
          <main className="shell-stage">
            <p>Booting platform kernel…</p>
          </main>
        )}
      </div>
      {kernel ? (
        <StatusBar
          activeWorkspaceLabel={activeLabel}
          editorStore={kernel.stores.editor as unknown as Store<{ selection: string[] }>}
          savedLabel="Ready"
        />
      ) : (
        <footer className="shell-statusbar">starting</footer>
      )}
      {kernel && (
        <CommandPalette
          registry={kernel.commands}
          context={commandContext}
          open={paletteOpen}
          onClose={() => setPaletteOpen(false)}
          onExecute={(id) => {
            if (id === 'prefs') setPrefsOpen(true)
            else void kernel.commands.execute(id, undefined, commandContext)
          }}
          recents={paletteRecents.list()}
          onUse={(id) => paletteRecents.record(id)}
        />
      )}
      {kernel && (
        <PreferencesDialog
          config={kernel.config}
          theme={kernel.theme}
          open={prefsOpen}
          onClose={() => setPrefsOpen(false)}
          tab={prefsTab}
          onTabChange={setPrefsTab}
        />
      )}
    </div>
  )
}

export default App
