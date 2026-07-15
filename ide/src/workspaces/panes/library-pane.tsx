// Placeholder pane for the Library workspace (CD-203). Real content arrives in
// M3/M4; this proves lazy code-splitting + the pane host. Its own chunk via import().
export default function LibraryPane() {
  return (
    <section data-pane="library" aria-label="Library workspace">
      <h2>Library</h2>
      <p>The Library workspace arrives in a later milestone.</p>
    </section>
  )
}
