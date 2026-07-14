import { useEffect, useState } from 'react'
import './App.css'
import { runAppBoot } from '@/boot-sequence'

/**
 * Shell (CD-102 placeholder, CD-136 boot-wired). Runs the real boot sequence on
 * mount and exposes an interactive marker (`data-boot`) the E2E waits on. Real
 * workspace chrome replaces the placeholder body in M2.
 */
function App() {
  const [booted, setBooted] = useState(false)

  useEffect(() => {
    let cancelled = false
    void runAppBoot().then(() => {
      if (!cancelled) setBooted(true)
    })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="shell" data-boot={booted ? 'interactive' : 'booting'} data-testid="shell">
      <header className="shell-topbar">CyberDeck IDE</header>
      <div className="shell-body">
        <nav className="shell-rail" aria-label="Workspaces" />
        <main className="shell-stage">
          <p>{booted ? 'Platform kernel booted.' : 'Booting platform kernel…'}</p>
        </main>
      </div>
      <footer className="shell-statusbar">{booted ? 'ready' : 'starting'}</footer>
    </div>
  )
}

export default App
