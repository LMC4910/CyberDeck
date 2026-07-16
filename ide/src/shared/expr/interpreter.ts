// Expression interpreter (CD-323). Walks the AST with:
//   • SAFE DEFAULTS for missing variables (undefined → comparisons false, arithmetic
//     propagates undefined) — matches the engine's flow/expr semantics,
//   • TYPE-MISMATCH errors (e.g. 'a' * 2, 'a' < 2, -'x') rather than silent coercion,
//   • an injection DENYLIST (constructor/__proto__/eval/window/…) that throws,
//   • whitelist-only function calls, and
//   • op-count + optional time limits so a runaway expression is terminated.
// No `eval`, no Function, no JS property access — dotted names are variable lookups.
import { ExprError } from './lexer'
import { parse, type Ast } from './parser'

export type ExprValue = number | string | boolean | undefined

/** Resolve a dotted variable path to a value (undefined = unavailable). */
export type VarResolver = (path: string) => unknown

export interface EvalOptions {
  vars?: VarResolver | Record<string, unknown>
  /** Max AST evaluations before aborting (runaway guard). Default 10000. */
  maxOps?: number
  /** Wall-clock budget (ms) + clock; both required to enable the time limit. */
  maxMs?: number
  now?: () => number
}

/** Identifier segments that must never resolve — injection/escape attempts. */
export const FORBIDDEN = new Set([
  '__proto__', 'constructor', 'prototype', 'eval', 'Function', 'function',
  'window', 'globalThis', 'global', 'process', 'require', 'import', 'this',
  'self', 'document', 'module', 'exports',
])

type Fn = (...args: ExprValue[]) => ExprValue
const num = (v: ExprValue): v is number => typeof v === 'number'
export const FUNCTIONS: Record<string, Fn> = {
  min: (...a) => (a.some((x) => !num(x)) ? undefined : Math.min(...(a as number[]))),
  max: (...a) => (a.some((x) => !num(x)) ? undefined : Math.max(...(a as number[]))),
  abs: (x) => (num(x) ? Math.abs(x) : undefined),
  round: (x) => (num(x) ? Math.round(x) : undefined),
  floor: (x) => (num(x) ? Math.floor(x) : undefined),
  ceil: (x) => (num(x) ? Math.ceil(x) : undefined),
  sqrt: (x) => (num(x) ? Math.sqrt(x) : undefined),
  clamp: (x, lo, hi) => (num(x) && num(lo) && num(hi) ? Math.min(hi, Math.max(lo, x)) : undefined),
  if: (c, a, b) => (truthy(c) ? a : b),
}

function truthy(v: ExprValue): boolean {
  return v !== undefined && v !== false && v !== 0 && v !== '' && !(typeof v === 'number' && Number.isNaN(v))
}

interface Ctx {
  resolve: VarResolver
  ops: number
  maxOps: number
  deadline: number | null
  now: (() => number) | null
}

function resolverOf(vars: EvalOptions['vars']): VarResolver {
  if (typeof vars === 'function') return vars
  if (vars && typeof vars === 'object') return (path) => (path in vars ? (vars as Record<string, unknown>)[path] : undefined)
  return () => undefined
}

function coerce(v: unknown): ExprValue {
  if (v === null || v === undefined) return undefined
  if (typeof v === 'number' || typeof v === 'string' || typeof v === 'boolean') return v
  return undefined // objects/arrays are never exposed to the sandbox
}

function tick(ctx: Ctx): void {
  if (++ctx.ops > ctx.maxOps) throw new ExprError('expression too complex (op limit exceeded)')
  if (ctx.deadline !== null && ctx.now && ctx.now() > ctx.deadline) throw new ExprError('expression timed out')
}

function ev(node: Ast, ctx: Ctx): ExprValue {
  tick(ctx)
  switch (node.t) {
    case 'num': return node.v
    case 'str': return node.v
    case 'bool': return node.v
    case 'null': return undefined
    case 'var': {
      for (const seg of node.path.split('.')) {
        if (FORBIDDEN.has(seg)) throw new ExprError(`forbidden identifier '${seg}'`)
      }
      return coerce(ctx.resolve(node.path))
    }
    case 'call': {
      if (FORBIDDEN.has(node.name)) throw new ExprError(`forbidden identifier '${node.name}'`)
      const fn = FUNCTIONS[node.name]
      if (!fn) throw new ExprError(`unknown function '${node.name}'`)
      return fn(...node.args.map((a) => ev(a, ctx)))
    }
    case 'unary': return unary(node.op, ev(node.e, ctx))
    case 'logic': {
      const l = ev(node.l, ctx)
      if (node.op === '&&') return truthy(l) ? ev(node.r, ctx) : l
      return truthy(l) ? l : ev(node.r, ctx)
    }
    case 'ternary': return truthy(ev(node.c, ctx)) ? ev(node.a, ctx) : ev(node.b, ctx)
    case 'bin': return binary(node.op, ev(node.l, ctx), ev(node.r, ctx))
  }
}

function unary(op: string, v: ExprValue): ExprValue {
  if (op === '!') return !truthy(v)
  // '-'
  if (v === undefined) return undefined
  if (typeof v !== 'number') throw new ExprError(`cannot negate ${typeof v}`)
  return -v
}

function binary(op: string, l: ExprValue, r: ExprValue): ExprValue {
  const anyUndef = l === undefined || r === undefined
  switch (op) {
    case '+':
      if (anyUndef) return undefined
      if (typeof l === 'number' && typeof r === 'number') return l + r
      if (typeof l === 'string' && typeof r === 'string') return l + r
      throw new ExprError(`type mismatch for '+' (${typeof l}, ${typeof r})`)
    case '-': case '*': case '/': case '%': {
      if (anyUndef) return undefined
      if (typeof l !== 'number' || typeof r !== 'number') throw new ExprError(`type mismatch for '${op}'`)
      if ((op === '/' || op === '%') && r === 0) throw new ExprError('division by zero')
      return op === '-' ? l - r : op === '*' ? l * r : op === '/' ? l / r : l % r
    }
    case '<': case '<=': case '>': case '>=': {
      if (anyUndef) return false // safe default
      if (typeof l !== typeof r || (typeof l !== 'number' && typeof l !== 'string')) throw new ExprError(`type mismatch for '${op}'`)
      const a = l as number | string
      const b = r as number | string
      return op === '<' ? a < b : op === '<=' ? a <= b : op === '>' ? a > b : a >= b
    }
    case '==': case '===':
      if (anyUndef) return l === undefined && r === undefined
      return l === r
    case '!=': case '!==':
      if (anyUndef) return !(l === undefined && r === undefined)
      return l !== r
  }
  throw new ExprError(`unknown operator '${op}'`)
}

/** Parse + evaluate an expression. Throws ExprError on parse/type/limit failure. */
export function evaluate(src: string, options: EvalOptions = {}): ExprValue {
  const ast = parse(src)
  const ctx: Ctx = {
    resolve: resolverOf(options.vars),
    ops: 0,
    maxOps: options.maxOps ?? 10000,
    deadline: options.maxMs != null && options.now ? options.now() + options.maxMs : null,
    now: options.now ?? null,
  }
  return ev(ast, ctx)
}
