// Scopes rail (CD-401). All + the eight scopes, rendered from the SCOPES table so a
// new scope is a data row, not a component edit. Picking one sets the query's
// `scope` filter param — the rail is a query control, not a view filter.
import { useCallback, useRef, type KeyboardEvent } from 'react'
import { SCOPES, type VariableScope } from './variables-model'

const ALL = '__all__'

export interface ScopesRailProps {
  /** Active scope, or undefined for "All". */
  value: VariableScope | undefined
  onChange: (scope: VariableScope | undefined) => void
}

export function ScopesRail({ value, onChange }: ScopesRailProps) {
  const railRef = useRef<HTMLDivElement>(null)
  const ids = [ALL, ...SCOPES.map((s) => s.id)]
  const activeId = value ?? ALL

  // Radiogroup keyboard contract: arrows move *and* select, Home/End jump.
  const onKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      const dir = e.key === 'ArrowDown' ? 1 : e.key === 'ArrowUp' ? -1 : 0
      let next: string | undefined
      if (dir !== 0) next = ids[(ids.indexOf(activeId) + dir + ids.length) % ids.length]
      else if (e.key === 'Home') next = ids[0]
      else if (e.key === 'End') next = ids[ids.length - 1]
      if (!next) return
      e.preventDefault()
      onChange(next === ALL ? undefined : (next as VariableScope))
      railRef.current?.querySelector<HTMLElement>(`[data-scope-option="${next}"]`)?.focus()
    },
    [activeId, ids, onChange],
  )

  return (
    <nav className="vars-rail" aria-label="Variable scopes">
      <div className="vars-rail-title">Scopes</div>
      <div role="radiogroup" aria-label="Filter by scope" ref={railRef} onKeyDown={onKeyDown}>
        <Option
          id={ALL}
          label="All"
          hint="Every scope"
          checked={activeId === ALL}
          onSelect={() => onChange(undefined)}
        />
        {SCOPES.map((s) => (
          <Option
            key={s.id}
            id={s.id}
            label={s.label}
            hint={s.hint}
            checked={activeId === s.id}
            onSelect={() => onChange(s.id)}
          />
        ))}
      </div>
    </nav>
  )
}

function Option({
  id,
  label,
  hint,
  checked,
  onSelect,
}: {
  id: string
  label: string
  hint: string
  checked: boolean
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={checked}
      // Roving tabindex: only the active option is in the tab order.
      tabIndex={checked ? 0 : -1}
      data-scope-option={id}
      data-checked={checked || undefined}
      className="vars-rail-option"
      title={hint}
      onClick={onSelect}
    >
      {label}
    </button>
  )
}
