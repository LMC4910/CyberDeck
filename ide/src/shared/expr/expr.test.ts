import { describe, it, expect } from 'vitest'
import { evaluate, analyze, ExprError } from './index'

// Conformance corpus mirrored from engine/core/flow/expr/expr_test.go — the IDE
// sandbox and the engine must agree on these results (CD-323).
describe('conformance corpus — operator matrix (engine parity)', () => {
  const cases: Record<string, unknown> = {
    '1 + 2 * 3': 7,
    '(1 + 2) * 3': 9,
    '10 / 4': 2.5,
    '10 % 3': 1,
    '-5 + 2': -3,
    '2 > 1': true,
    '2 < 1': false,
    '3 >= 3': true,
    '1 == 1': true,
    '1 != 2': true,
    'true && false': false,
    'true || false': true,
    '!false': true,
    "'a' + 'b'": 'ab',
    "'x' == 'x'": true,
    '2 + 3 > 4 && 1 < 2': true,
    '10.5 % 3': 1.5,
    'true ? 10 : 20': 10,
    'false ? 10 : 20': 20,
    'min(3, 7)': 3,
    'max(3, 7)': 7,
    'clamp(12, 0, 10)': 10,
    'round(2.6)': 3,
    'abs(-4)': 4,
  }
  it.each(Object.entries(cases))('%s', (src, want) => {
    expect(evaluate(src)).toBe(want)
  })
})

describe('variable resolution + safe defaults (engine parity)', () => {
  const vars = { 'system.cpu.percent': 90, 'var.threshold': 50, 'var.name': 'deck', flag: true }

  it('resolves dotted + bare variable paths', () => {
    expect(evaluate('system.cpu.percent > var.threshold', { vars })).toBe(true)
    expect(evaluate("var.name == 'deck' && flag", { vars })).toBe(true)
  })

  it('missing tokens → safe default (comparisons false, no crash)', () => {
    for (const src of ['missing.token > 5', 'missing.token == 1', 'missing.token + 1 > 0', 'system.gpu.temp >= 80']) {
      expect(evaluate(src, { vars })).toBe(false)
    }
  })
})

describe('type mismatches error, not coerce (engine parity)', () => {
  it.each(["'a' * 2", 'true - 1', "'a' < 2", "-'x'"])('%s throws', (src) => {
    expect(() => evaluate(src)).toThrow(ExprError)
  })
})

describe('division by zero errors', () => {
  it.each(['1 / 0', '5 % 0'])('%s throws', (src) => {
    expect(() => evaluate(src)).toThrow(/division by zero/)
  })
})

describe('malformed input rejected at parse (engine parity)', () => {
  it.each(['', '1 +', '(1 + 2', '1 2', 'system.', 'a = 1', '`backtick`', '1 ; 2', '1 :: 2'])('%s rejected', (src) => {
    expect(() => evaluate(src)).toThrow(ExprError)
  })
})

describe('injection corpus — globals / prototype / constructor escapes rejected', () => {
  const attacks = [
    'constructor',
    'window',
    'globalThis',
    'process.env',
    '__proto__',
    'this.constructor',
    'a.__proto__.polluted',
    'eval',
    "constructor('alert(1)')",
    'Function',
    "Function('return 1')()",
    'require("fs")',
    'import("x")',
  ]
  it.each(attacks)('%s is rejected', (src) => {
    // Either a parse rejection or a forbidden-identifier throw — never evaluated.
    expect(() => evaluate(src, { vars: () => 1 })).toThrow(ExprError)
  })
})

describe('runaway expressions terminated by limits', () => {
  it('op-count limit aborts a huge expression', () => {
    const huge = Array.from({ length: 5000 }, () => '1').join(' + ')
    expect(() => evaluate(huge, { maxOps: 500 })).toThrow(/op limit/)
  })

  it('time limit aborts when the clock passes the deadline', () => {
    let t = 0
    const now = () => (t += 1000) // each tick advances 1s
    expect(() => evaluate('1 + 2 + 3 + 4 + 5', { maxMs: 10, now })).toThrow(/timed out/)
  })
})

describe('analyze — editor diagnostics', () => {
  it('reports unknown variables against a known catalog', () => {
    const r = analyze('fps.current + fps.max', ['fps.current'])
    expect(r.ok).toBe(false)
    expect(r.error).toBe("Unknown variable 'fps.max'")
    expect(r.unknownVars).toEqual(['fps.max'])
    expect(r.vars.sort()).toEqual(['fps.current', 'fps.max'])
  })

  it('reports parse errors and unknown functions', () => {
    expect(analyze('1 +').ok).toBe(false)
    expect(analyze('bogus(1)').error).toMatch(/Unknown function 'bogus'/)
  })

  it('ok when every variable is known', () => {
    expect(analyze('a + b', ['a', 'b']).ok).toBe(true)
  })

  it('flags forbidden identifiers', () => {
    expect(analyze('constructor').ok).toBe(false)
  })
})
