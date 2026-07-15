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
  ResizablePanel,
  panelFor,
  setPanelWidth,
  togglePanel,
  type PreferencesTab,
} from '@/workspaces'
import { useStore } from '@/stores'
import { LocalStorageAdapter } from '@/services/persistence'
import type { Store } from '@/stores'
import type { WhenContext } from '@/platform/commands'

const paletteRecents = new PaletteRecents({ storage: new LocalStorageAdapter() })

/** Boot loader — renders the Shell once the kernel is up. */
function App() {
  const [kernel, setKernel] = useState<BootedKernel | null>(null)

  useEffect(() => {
    let cancelled = false
    void runAppBoot().then((k) => {
      if (cancelled) return
      setKernel(k)
      window.addEventListener('beforeunload', () => k.flush())
    })
    return () => {
      cancelled = true
    }
  }, [])

  if (!kernel) {
    return (
      <div className="shell" data-boot="booting" data-testid="shell">
        <header className="shell-topbar">
          <span className="shell-brand">CyberDeck IDE</span>
        </header>
        <div className="shell-body">
          <nav className="shell-rail" aria-label="Workspaces" />
          <main className="shell-stage">
            <p>Booting platform kernel…</p>
          </main>
        </div>
        <footer className="shell-statusbar">starting</footer>
      </div>
    )
  }
  return <Shell kernel={kernel} />
}

function Shell({ kernel }: { kernel: BootedKernel }) {
  const [active, setActive] = useState<string | null>(kernel.workspaces.active())
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [prefsOpen, setPrefsOpen] = useState(false)
  const [prefsTab, setPrefsTab] = useState<PreferencesTab>('general')
  const panelsState = useStore(kernel.panels, (s) => s)

  useEffect(() => kernel.workspaces.subscribe((id) => setActive(id)), [kernel])

  const toggleSide = (side: 'left' | 'right') => {
    if (active) togglePanel(kernel.panels, active, side)
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey
      if (mod && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setPaletteOpen((v) => !v)
      } else if (mod && e.key === ',') {
        e.preventDefault()
        setPrefsOpen(true)
      } else if (mod && e.key.toLowerCase() === 'b') {
        e.preventDefault()
        toggleSide('left')
      } else if (mod && e.key.toLowerCase() === 'j') {
        e.preventDefault()
        toggleSide('right')
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const activeLabel = (active && kernel.workspaces.get(active)?.label) || ''
  const commandContext: WhenContext = {
    workspace: active ?? undefined,
    flags: kernel.config.get<Record<string, boolean>>('features'),
  }
  const panel = active ? panelFor(panelsState, active) : undefined

  return (
    <div className="shell" data-boot="interactive" data-testid="shell">
      <header className="shell-topbar">
        <span className="shell-brand">CyberDeck IDE</span>
        <Breadcrumb
          activeWorkspace={active}
          context={{ projectName: 'Untitled', leaf: activeLabel }}
          onNavigate={(id) => kernel.workspaces.setActive(id)}
        />
      </header>
      <div className="shell-body">
        <WorkspaceRail service={kernel.workspaces} active={active} />
        {panel && active && (
          <ResizablePanel
            side="left"
            width={panel.leftWidth}
            visible={panel.leftVisible}
            label="Explorer"
            onResize={(w) => setPanelWidth(kernel.panels, active, 'left', w)}
            onToggle={() => toggleSide('left')}
          >
            <div className="panel-placeholder">Explorer — arrives in M3.</div>
          </ResizablePanel>
        )}
        <PaneHost service={kernel.workspaces} active={active} />
      </div>
      <StatusBar
        activeWorkspaceLabel={activeLabel}
        editorStore={kernel.stores.editor as unknown as Store<{ selection: string[] }>}
        savedLabel="Ready"
      />
      <CommandPalette
        registry={kernel.commands}
        context={commandContext}
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        onExecute={(id) => {
          if (id === 'prefs') setPrefsOpen(true)
          else if (id === 'togL') toggleSide('left')
          else if (id === 'togR') toggleSide('right')
          else void kernel.commands.execute(id, undefined, commandContext)
        }}
        recents={paletteRecents.list()}
        onUse={(id) => paletteRecents.record(id)}
      />
      <PreferencesDialog
        config={kernel.config}
        theme={kernel.theme}
        open={prefsOpen}
        onClose={() => setPrefsOpen(false)}
        tab={prefsTab}
        onTabChange={setPrefsTab}
        commands={kernel.commands}
        dispatcher={kernel.keymap}
      />
    </div>
  )
}

export default App
