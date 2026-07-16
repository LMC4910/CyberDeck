// Sandboxed expression module (CD-323). A no-`eval` parser + interpreter shared by
// the binding editor (CD-324/325) and validated to agree with the engine's
// flow/expr semantics. `analyze` powers the editor's friendly diagnostics.
export { ExprError } from './lexer'
export { parse, type Ast } from './parser'
export {
  evaluate,
  FUNCTIONS,
  FORBIDDEN,
  type ExprValue,
  type VarResolver,
  type EvalOptions,
} from './interpreter'

import { parse, type Ast } from './parser'
import { ExprError } from './lexer'
import { FORBIDDEN, FUNCTIONS } from './interpreter'

/** All distinct variable paths referenced by an expression. */
export function collectVars(ast: Ast): string[] {
  const out = new Set<string>()
  const walk = (n: Ast): void => {
    switch (n.t) {
      case 'var': out.add(n.path); break
      case 'unary': walk(n.e); break
      case 'bin': case 'logic': walk(n.l); walk(n.r); break
      case 'ternary': walk(n.c); walk(n.a); walk(n.b); break
      case 'call': n.args.forEach(walk); break
    }
  }
  walk(ast)
  return [...out]
}

export interface ExprAnalysis {
  ok: boolean
  /** Friendly parse/validation error, when ok is false. */
  error?: string
  /** All variable paths the expression references. */
  vars: string[]
  /** Referenced variables NOT in `known` (drives "Unknown variable 'x'" hints). */
  unknownVars: string[]
  /** Whitelisted functions used. */
  functions: string[]
}

/**
 * Statically analyze an expression for the editor: parse errors, unknown-variable
 * hints (against a known catalog), forbidden identifiers, and unknown functions.
 */
export function analyze(src: string, known?: Iterable<string>): ExprAnalysis {
  let ast: Ast
  try {
    ast = parse(src)
  } catch (e) {
    return { ok: false, error: e instanceof ExprError ? e.message : String(e), vars: [], unknownVars: [], functions: [] }
  }
  const vars = collectVars(ast)
  // Forbidden identifiers anywhere → hard error.
  for (const path of vars) {
    for (const seg of path.split('.')) {
      if (FORBIDDEN.has(seg)) return { ok: false, error: `forbidden identifier '${seg}'`, vars, unknownVars: [], functions: [] }
    }
  }
  const functions = usedFunctions(ast)
  for (const fn of functions) {
    if (!(fn in FUNCTIONS)) return { ok: false, error: `Unknown function '${fn}'`, vars, unknownVars: [], functions }
  }
  const knownSet = new Set(known ?? [])
  const unknownVars = known ? vars.filter((v) => !knownSet.has(v)) : []
  const firstUnknown = unknownVars[0]
  return {
    ok: !firstUnknown,
    error: firstUnknown ? `Unknown variable '${firstUnknown}'` : undefined,
    vars,
    unknownVars,
    functions,
  }
}

function usedFunctions(ast: Ast): string[] {
  const out = new Set<string>()
  const walk = (n: Ast): void => {
    switch (n.t) {
      case 'call': out.add(n.name); n.args.forEach(walk); break
      case 'unary': walk(n.e); break
      case 'bin': case 'logic': walk(n.l); walk(n.r); break
      case 'ternary': walk(n.c); walk(n.a); walk(n.b); break
    }
  }
  walk(ast)
  return [...out]
}
