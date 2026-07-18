// Input field canon widget (CD-423). A display-only field preview (the player wires
// real input; the designer shows the placeholder/value).
import '../canon.css'

export default function InputWidget({ config }: { config?: unknown }) {
  const c = (config ?? {}) as { value?: string; placeholder?: string; inputKind?: string }
  return (
    <div className="cw cw-input" data-widget-kind="input" data-input-kind={c.inputKind ?? 'text'}>
      <span className="cw-input__text">{c.value || c.placeholder || 'Input'}</span>
    </div>
  )
}
