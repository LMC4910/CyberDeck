// Placeholder pane for the Projects workspace (CD-203). Real content arrives in
// M3/M4; this proves lazy code-splitting + the pane host. Its own chunk via import().
export default function ProjectsPane() {
  return (
    <section data-pane="projects" aria-label="Projects workspace">
      <h2>Projects</h2>
      <p>The Projects workspace arrives in a later milestone.</p>
    </section>
  )
}
