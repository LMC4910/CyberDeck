// Placeholder pane for the Devices workspace (CD-203). Real content arrives in
// M3/M4; this proves lazy code-splitting + the pane host. Its own chunk via import().
export default function DevicesPane() {
  return (
    <section data-pane="devices" aria-label="Devices workspace">
      <h2>Devices</h2>
      <p>The Devices workspace arrives in a later milestone.</p>
    </section>
  )
}
