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
  DockHost,
  LayoutPresetMenu,
  Toaster,
  NotificationDrawer,
  ProjectModelProvider,
  SelectionProvider,
  UndoProvider,
  CanvasSettingsProvider,
  CommandsProvider,
  LayersPanel,
  InsertPanel,
  DeckInspectorPanel,
  Minimap,
  LiveMirror,
  CanvasViewProvider,
  type PreferencesTab,
} from '@/workspaces'
import { useStore } from '@/stores'
import { LocalStorageAdapter } from '@/services/persistence'
import type { SaveState } from '@/services/project'
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
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [leftTab, setLeftTab] = useState<'layers' | 'insert'>('layers')
  const [dockRows, setDockRows] = useState(kernel.dock.list())
  const panelsState = useStore(kernel.panels, (s) => s)
  const userPresets = useStore(kernel.userPresets, (s) => s)
  const toasts = useStore(kernel.toastStore, (s) => s.items)
  const unread = useStore(kernel.notificationStore, (s) => s.items.filter((n) => !n.read).length)
  const [saveState, setSaveState] = useState<SaveState>(kernel.project.saveState)
  const snapEnabled = useStore(kernel.canvasSettings, (s) => s.snap)

  useEffect(() => kernel.workspaces.subscribe((id) => setActive(id)), [kernel])
  useEffect(() => kernel.project.subscribe(setSaveState), [kernel])

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
      } else if (mod && !e.shiftKey && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        kernel.undo.undo()
      } else if (mod && e.shiftKey && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        kernel.undo.redo()
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
  const savedLabel = SAVE_LABELS[saveState]

  return (
   <ProjectModelProvider value={kernel.project.model}>
   <SelectionProvider value={kernel.selection}>
   <UndoProvider value={kernel.undo}>
   <CanvasSettingsProvider value={kernel.canvasSettings}>
   <CommandsProvider value={kernel.commands}>
   <CanvasViewProvider value={kernel.canvasView}>
    <div className="shell" data-boot="interactive" data-testid="shell">
      <header className="shell-topbar">
        <span className="shell-brand">CyberDeck IDE</span>
        <Breadcrumb
          activeWorkspace={active}
          context={{ projectName: 'Untitled', leaf: activeLabel }}
          onNavigate={(id) => kernel.workspaces.setActive(id)}
        />
        <button
          className="shell-bell"
          data-testid="notifications-bell"
          aria-label={`Notifications${unread > 0 ? ` (${unread} unread)` : ''}`}
          onClick={() => setDrawerOpen((v) => !v)}
        >
          🔔{unread > 0 && <span className="shell-bell-badge">{unread}</span>}
        </button>
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
            {active === 'deck-designer' && kernel.project.model ? (
              <div className="dd-leftpanel">
                <div className="dd-leftpanel-tabs" role="tablist" aria-label="Left panel">
                  <button type="button" role="tab" aria-selected={leftTab === 'layers'} onClick={() => setLeftTab('layers')}>
                    Layers
                  </button>
                  <button type="button" role="tab" aria-selected={leftTab === 'insert'} onClick={() => setLeftTab('insert')}>
                    Insert
                  </button>
                </div>
                {leftTab === 'layers' ? (
                  <LayersPanel pageId={kernel.project.model.pages()[0]!.id} />
                ) : (
                  <InsertPanel pageId={kernel.project.model.pages()[0]!.id} />
                )}
              </div>
            ) : (
              <div className="panel-placeholder">Explorer — arrives in M3.</div>
            )}
          </ResizablePanel>
        )}
        <PaneHost service={kernel.workspaces} active={active} />
        {panel && active === 'deck-designer' && kernel.project.model && (
          <ResizablePanel
            side="right"
            width={panel.rightWidth}
            visible={panel.rightVisible}
            label="Inspector"
            onResize={(w) => setPanelWidth(kernel.panels, active, 'right', w)}
            onToggle={() => toggleSide('right')}
          >
            <DeckInspectorPanel pageId={kernel.project.model.pages()[0]!.id} />
          </ResizablePanel>
        )}
        <DockHost
          manager={kernel.dock}
          windows={dockRows}
          content={{
            mirror:
              active === 'deck-designer' && kernel.project.model ? (
                <LiveMirror pageId={kernel.project.model.pages()[0]!.id} />
              ) : (
                <div className="panel-placeholder">Live Mirror — select the Deck Designer.</div>
              ),
            minimap:
              active === 'deck-designer' && kernel.project.model ? (
                <Minimap pageId={kernel.project.model.pages()[0]!.id} />
              ) : (
                <div className="panel-placeholder">Minimap — select the Deck Designer.</div>
              ),
          }}
          onChange={() => {
            setDockRows(kernel.dock.list())
            kernel.saveDock()
          }}
        />
      </div>
      <div className="shell-footer">
        <StatusBar
          activeWorkspaceLabel={activeLabel}
          editorStore={kernel.stores.editor as unknown as Store<{ selection: string[] }>}
          savedLabel={savedLabel}
          snapEnabled={snapEnabled}
          onToggleSnap={() => kernel.canvasSettings.setState((s) => ({ ...s, snap: !s.snap }))}
        />
        {active && (
          <LayoutPresetMenu
            store={kernel.panels}
            workspaceId={active}
            userPresets={userPresets.presets}
            onSaveUserPreset={(p) =>
              kernel.userPresets.setState((s) => ({ presets: [...s.presets, p] }))
            }
            onDeleteUserPreset={(name) =>
              kernel.userPresets.setState((s) => ({ presets: s.presets.filter((x) => x.name !== name) }))
            }
          />
        )}
      </div>
      <CommandPalette
        registry={kernel.commands}
        context={commandContext}
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        onExecute={(id) => {
          if (id === 'prefs') setPrefsOpen(true)
          else if (id === 'togL') toggleSide('left')
          else if (id === 'togR') toggleSide('right')
          else if (id === 'drawer') setDrawerOpen((v) => !v)
          else if (id === 'undo') kernel.undo.undo()
          else if (id === 'redo') kernel.undo.redo()
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
      <Toaster
        toasts={toasts}
        onDismiss={(id) =>
          kernel.toastStore.setState((s) => ({ items: s.items.filter((t) => t.id !== id) }))
        }
        onAction={(_id, actionId) => {
          if (actionId === 'undo') kernel.undo.undo()
        }}
      />
      <NotificationDrawer
        store={kernel.notificationStore}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onMarkAllRead={() =>
          kernel.notificationStore.setState((s) => ({ items: s.items.map((n) => ({ ...n, read: true })) }))
        }
      />
    </div>
   </CanvasViewProvider>
   </CommandsProvider>
   </CanvasSettingsProvider>
   </UndoProvider>
   </SelectionProvider>
   </ProjectModelProvider>
  )
}

/** Saved-state indicator copy (CD-304), driven by ProjectService.saveState. */
const SAVE_LABELS: Record<SaveState, string> = {
  saved: 'Saved',
  dirty: 'Unsaved changes',
  saving: 'Saving…',
  error: 'Save failed',
}

export default App
