// Placeholder pane for the Home workspace (CD-203). Real content arrives in
// M3/M4; this proves lazy code-splitting + the pane host. Its own chunk via import().
export default function HomePane() {
  return (
    <section data-pane="home" aria-label="Home workspace">
      <h2>Home</h2>
      <p>The Home workspace arrives in a later milestone.</p>
    </section>
  )
}
