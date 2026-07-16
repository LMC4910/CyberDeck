// Binding runtime React glue (CD-326). Resolves a widget's bound props against the
// live VariableRuntime and re-renders the widget ONLY when one of its dependency
// paths ticks (event-driven, no polling). Expressions re-evaluate only on a
// dependency change because the widget subscribes to exactly its dependency paths.
import { createContext, useContext, useEffect, useReducer } from 'react'
import { evaluate, parse, collectVars, type ExprValue } from '@/shared/expr'
import type { VariableRuntime } from '@/stores'
import type { ProjectModel, Binding } from '@/shared/project'

const RuntimeContext = createContext<VariableRuntime | null>(null)
export const VariableRuntimeProvider = RuntimeContext.Provider
export function useVariableRuntimeOptional(): VariableRuntime | null {
  return useContext(RuntimeContext)
}

/** Dependency paths of every binding on a widget (variable src + expression vars). */
export function widgetDependencies(model: ProjectModel, widgetId: string): string[] {
  const binds = model.bindingsOf(widgetId)
  if (!binds) return []
  const deps = new Set<string>()
  for (const b of Object.values(binds)) {
    if (b.mode === 'variable' && b.src) deps.add(b.src)
    else if (b.mode === 'expression' && b.expr) {
      try {
        for (const p of collectVars(parse(b.expr))) deps.add(p)
      } catch {
        /* invalid expression → no deps */
      }
    }
  }
  return [...deps]
}

/** Resolve one binding to its live value. */
export function resolveBinding(runtime: VariableRuntime, b: Binding): ExprValue {
  if (b.mode === 'variable') return coerce(b.src ? runtime.get(b.src) : undefined)
  if (b.mode === 'expression') {
    try {
      return b.expr ? evaluate(b.expr, { vars: runtime.resolver }) : undefined
    } catch {
      return undefined
    }
  }
  const v = (b.val as { v?: unknown } | undefined)?.v
  return coerce(v)
}

function coerce(v: unknown): ExprValue {
  return typeof v === 'number' || typeof v === 'string' || typeof v === 'boolean' ? v : undefined
}

/**
 * Subscribe a widget to its binding dependency paths; returns a tick counter that
 * bumps (forcing a re-render) whenever a dependency changes. Re-subscribes when the
 * widget's bindings change (keyed on `bindingsRev`).
 */
export function useBindingTick(runtime: VariableRuntime | null, model: ProjectModel, widgetId: string, bindingsRev: number): number {
  const [tick, force] = useReducer((x: number) => x + 1, 0)
  useEffect(() => {
    if (!runtime) return
    const deps = widgetDependencies(model, widgetId)
    const unsubs = deps.map((p) => runtime.subscribePath(p, force))
    return () => unsubs.forEach((u) => u())
  }, [runtime, model, widgetId, bindingsRev])
  return tick
}

/** All resolved bound values for a widget: prop → live value. */
export function resolvedBindings(runtime: VariableRuntime, model: ProjectModel, widgetId: string): Record<string, ExprValue> {
  const binds = model.bindingsOf(widgetId)
  const out: Record<string, ExprValue> = {}
  if (binds) for (const [prop, b] of Object.entries(binds)) out[prop] = resolveBinding(runtime, b)
  return out
}
