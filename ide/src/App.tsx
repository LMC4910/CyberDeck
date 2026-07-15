import { useEffect, useState } from 'react'
import './App.css'
import { runAppBoot, type BootedKernel } from '@/boot-sequence'
import { WorkspaceRail, PaneHost } from '@/workspaces'

/**
 * Shell (CD-102 placeholder → CD-136 boot-wired → CD-203 workspace shell). Boots
 * the kernel, then renders the workspace rail + lazy pane host. Real chrome
 * (breadcrumb, status bar, palette, prefs) fills in across M2.
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

  return (
    <div className="shell" data-boot={booted ? 'interactive' : 'booting'} data-testid="shell">
      <header className="shell-topbar">CyberDeck IDE</header>
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
      <footer className="shell-statusbar">{booted ? 'ready' : 'starting'}</footer>
    </div>
  )
}

export default App
