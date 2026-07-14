// When-clause engine (CD-121). Evaluates command visibility/enablement against
// a context (workspace, selectionKind, flags.*). Supports a focused subset:
//   atom:   key | !key | key == value | key != value
//   combine: && (higher precedence) and || (lower)
// e.g. "workspace == deck-designer && flags.devTools"
//      "selectionKind == widget || selectionKind == component"

export interface WhenContext {
  workspace?: string
  selectionKind?: string
  flags?: Record<string, boolean>
  [key: string]: unknown
}

function lookup(ctx: WhenContext, key: string): unknown {
  let cur: unknown = ctx
  for (const seg of key.split('.')) {
    if (cur == null || typeof cur !== 'object') return undefined
    cur = (cur as Record<string, unknown>)[seg]
  }
  return cur
}

function evalAtom(atom: string, ctx: WhenContext): boolean {
  const trimmed = atom.trim()
  if (trimmed === '') return true

  for (const op of ['==', '!='] as const) {
    const idx = trimmed.indexOf(op)
    if (idx !== -1) {
      const key = trimmed.slice(0, idx).trim()
      const rhs = trimmed.slice(idx + op.length).trim().replace(/^['"]|['"]$/g, '')
      const lhs = lookup(ctx, key)
      const eq = String(lhs) === rhs
      return op === '==' ? eq : !eq
    }
  }

  if (trimmed.startsWith('!')) return !truthy(lookup(ctx, trimmed.slice(1).trim()))
  return truthy(lookup(ctx, trimmed))
}

function truthy(v: unknown): boolean {
  return v !== undefined && v !== null && v !== false && v !== ''
}

/** Evaluate a when-clause. An empty/undefined clause is always true. */
export function evaluateWhen(clause: string | undefined, ctx: WhenContext): boolean {
  if (!clause || clause.trim() === '') return true
  // || is lowest precedence
  return clause.split('||').some((orPart) =>
    orPart.split('&&').every((andPart) => evalAtom(andPart, ctx)),
  )
}
