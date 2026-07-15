// Placeholder pane for the Flows workspace (CD-203). Real content arrives in
// M3/M4; this proves lazy code-splitting + the pane host. Its own chunk via import().
export default function FlowsPane() {
  return (
    <section data-pane="flows" aria-label="Flows workspace">
      <h2>Flows</h2>
      <p>The Flows workspace arrives in a later milestone.</p>
    </section>
  )
}
