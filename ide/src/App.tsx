import './App.css'

/**
 * Placeholder shell (CD-102). Replaced by the real workspace chrome in M2.
 * Regions mirror the target layout: top bar, activity rail, main stage, status bar.
 */
function App() {
  return (
    <div className="shell">
      <header className="shell-topbar">CyberDeck IDE</header>
      <div className="shell-body">
        <nav className="shell-rail" aria-label="Workspaces" />
        <main className="shell-stage">
          <p>Platform kernel not booted yet — placeholder shell (CD-102).</p>
        </main>
      </div>
      <footer className="shell-statusbar">ready</footer>
    </div>
  )
}

export default App
