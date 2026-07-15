import { useEffect, useState } from 'react'
import './App.css'
import { runAppBoot, type BootedKernel } from '@/boot-sequence'
import { WorkspaceRail, PaneHost, Breadcrumb, StatusBar } from '@/workspaces'
import type { Store } from '@/stores'

/**
 * Shell (progressively assembled through M2). Boots the kernel, then renders the
 * workspace rail, breadcrumb, lazy pane host, and status bar. Palette/prefs/dock
 * land in later M2 tickets.
 */
function App() {
  const [kernel, setKernel] = useState<BootedKernel | null>(null)
  const [active, setActive] = useState<string | null>(null)

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

  const booted = kernel !== null
  const activeLabel = (active && kernel?.workspaces.get(active)?.label) || ''

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
    </div>
  )
}

export default App
