// Bindings section + popover (CD-324). Each bindable prop shows either a locked
// binding chip (with unbind) or a link icon that opens a keyboard-complete popover:
// Static (literal), Variable (searchable catalog with live values), or Expression
// (edited fully at CD-325). Bindings persist in the document (doc.bindings).
import { useEffect, useRef, useState } from 'react'
import { useFocusTrap } from '@/shared/a11y'
import { analyze, evaluate } from '@/shared/expr'
import type { ProjectModel, Binding } from '@/shared/project'
import type { UndoStack } from '@/platform/undo'
import { InspectorSection } from './inspector-fields'
import { BINDABLE_PROPS, bindingLabel, setBinding, clearBinding, type BindCtx } from './binding-ops'
import { searchVariables, variableValue, catalogResolver, KNOWN_VARIABLE_PATHS } from './variables-catalog'
import './bindings.css'

export function BindingsSection({ model, widgetId, undo }: { model: ProjectModel; widgetId: string; undo: UndoStack }) {
  const ctx: BindCtx = { model, undo }
  const binds = model.bindingsOf(widgetId) ?? {}
  const [editing, setEditing] = useState<string | null>(null)
  return (
    <InspectorSection title="Bindings">
      {BINDABLE_PROPS.map((prop) => {
        const b = binds[prop]
        return (
          <div key={prop} className="dd-bind-row" data-bind-prop={prop}>
            <span className="dd-field-label">{prop}</span>
            {b ? (
              <span className="dd-bind-chip" data-testid={`bindchip-${prop}`} data-mode={b.mode}>
                {bindingLabel(b)}
                <button type="button" className="dd-bind-x" data-testid={`unbind-${prop}`} aria-label={`Unbind ${prop}`} onClick={() => clearBinding(ctx, widgetId, prop)}>
                  ×
                </button>
              </span>
            ) : (
              <button type="button" className="dd-bind-link" data-testid={`bindlink-${prop}`} aria-label={`Bind ${prop}`} onClick={() => setEditing(prop)}>
                🔗
              </button>
            )}
            {editing === prop && (
              <BindingPopover
                current={b}
                onClose={() => setEditing(null)}
                onApply={(binding) => {
                  setBinding(ctx, widgetId, prop, binding)
                  setEditing(null)
                }}
                onRemove={b ? () => { clearBinding(ctx, widgetId, prop); setEditing(null) } : undefined}
              />
            )}
          </div>
        )
      })}
    </InspectorSection>
  )
}

type Mode = 'static' | 'variable' | 'expression'

function BindingPopover({ current, onClose, onApply, onRemove }: { current?: Binding; onClose: () => void; onApply: (b: Binding) => void; onRemove?: () => void }) {
  const ref = useRef<HTMLDivElement>(null)
  useFocusTrap(ref, true)
  const [mode, setMode] = useState<Mode>(current?.mode ?? 'variable')
  const [staticVal, setStaticVal] = useState(current?.mode === 'static' ? String((current.val as { v?: unknown })?.v ?? '') : '')
  const [expr, setExpr] = useState(current?.mode === 'expression' ? (current.expr ?? '') : '')
  const [query, setQuery] = useState('')

  // Esc + outside-click close.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
      }
    }
    const onDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('keydown', onKey, true)
    document.addEventListener('pointerdown', onDown, true)
    return () => {
      document.removeEventListener('keydown', onKey, true)
      document.removeEventListener('pointerdown', onDown, true)
    }
  }, [onClose])

  const exprRef = useRef<HTMLTextAreaElement>(null)
  // Live preview via the sandbox; friendly errors from analyze() or a runtime throw.
  const exprAnalysis = mode === 'expression' && expr ? analyze(expr, KNOWN_VARIABLE_PATHS) : null
  let exprPreview: string | null = null
  let exprError: string | null = null
  if (mode === 'expression' && expr) {
    if (!exprAnalysis?.ok) {
      exprError = exprAnalysis?.error ?? 'Invalid expression'
    } else {
      try {
        exprPreview = String(evaluate(expr, { vars: catalogResolver }))
      } catch (e) {
        exprError = e instanceof Error ? e.message : String(e)
      }
    }
  }
  const insertVar = (path: string) => {
    const ta = exprRef.current
    const at = ta ? ta.selectionStart : expr.length
    setExpr(expr.slice(0, at) + path + expr.slice(ta ? ta.selectionEnd : expr.length))
    queueMicrotask(() => {
      ta?.focus()
      if (ta) ta.selectionStart = ta.selectionEnd = at + path.length
    })
  }

  return (
    <div className="dd-bind-popover" ref={ref} role="dialog" aria-label="Edit binding" data-testid="binding-popover">
      <div className="dd-bind-modes" role="group" aria-label="Binding mode">
        {(['static', 'variable', 'expression'] as Mode[]).map((m) => (
          <button key={m} type="button" className="dd-chip" aria-pressed={mode === m} data-testid={`mode-${m}`} onClick={() => setMode(m)}>
            {m[0]!.toUpperCase() + m.slice(1)}
          </button>
        ))}
      </div>

      {mode === 'static' && (
        <div className="dd-bind-body">
          <input
            className="dd-input"
            aria-label="Static value"
            value={staticVal}
            autoFocus
            onChange={(e) => setStaticVal(e.target.value)}
          />
          <button type="button" className="dd-insp-btn" data-testid="bind-apply" onClick={() => onApply({ mode: 'static', val: { v: coerce(staticVal) } })}>
            Apply
          </button>
        </div>
      )}

      {mode === 'variable' && (
        <div className="dd-bind-body">
          <input className="dd-input" type="search" aria-label="Search variables" placeholder="Search variables" value={query} onChange={(e) => setQuery(e.target.value)} />
          <ul className="dd-var-list" role="listbox" aria-label="Variables">
            {searchVariables(query).map((v) => (
              <li key={v.path}>
                <button type="button" className="dd-var-item" data-var={v.path} onClick={() => onApply({ mode: 'variable', src: v.path })}>
                  <span>{v.label}</span>
                  <span className="dd-var-value">{String(variableValue(v.path))}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {mode === 'expression' && (
        <div className="dd-bind-body">
          <textarea ref={exprRef} className="dd-input dd-expr-input" aria-label="Expression" rows={2} value={expr} onChange={(e) => setExpr(e.target.value)} />
          <div className="dd-expr-chips" aria-label="Insert variable">
            {KNOWN_VARIABLE_PATHS.slice(0, 6).map((p) => (
              <button key={p} type="button" className="dd-chip dd-expr-chip" data-var-chip={p} onClick={() => insertVar(p)}>
                {p}
              </button>
            ))}
          </div>
          {exprError && <p className="dd-expr-error" data-testid="expr-error">{exprError}</p>}
          {exprPreview != null && !exprError && <p className="dd-expr-preview" data-testid="expr-preview">= {exprPreview}</p>}
          <button type="button" className="dd-insp-btn" data-testid="bind-apply-expr" disabled={!expr || !!exprError} onClick={() => onApply({ mode: 'expression', expr })}>
            Apply
          </button>
        </div>
      )}

      {onRemove && (
        <button type="button" className="dd-insp-btn" data-testid="bind-remove" onClick={onRemove}>
          Remove binding
        </button>
      )}
    </div>
  )
}

function coerce(s: string): number | string | boolean {
  if (s === 'true') return true
  if (s === 'false') return false
  const n = Number(s)
  return s !== '' && Number.isFinite(n) ? n : s
}
