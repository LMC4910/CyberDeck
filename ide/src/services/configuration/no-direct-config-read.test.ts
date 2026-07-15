// CD-117 AC: no consumer reads config JSON directly — everything goes through
// ConfigurationService.get(). This is the grep guard: no source file outside the
// configuration/persistence layer may touch `localStorage` or parse config JSON.
// It passes trivially today (ConfigurationService is the first config code) and
// catches the first future violation.
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const srcDir = join(__dirname, '..', '..')

// Files/dirs allowed to touch storage directly: the config layer itself (and
// the CD-118 persistence adapter, when it lands).
const ALLOWED = [
  join('services', 'configuration'),
  join('services', 'persistence'),
]

function walk(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry)
    if (statSync(p).isDirectory()) out.push(...walk(p))
    else if (/\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry)) out.push(p)
  }
  return out
}

// Strip line + block comments so the guard checks real code, not prose that
// mentions localStorage (the StorageAdapter abstraction is the sanctioned path).
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')
}

describe('no direct config JSON reads (CD-117 grep guard)', () => {
  it('only the config layer touches localStorage (in code, not comments)', () => {
    const offenders = walk(srcDir)
      .filter((f) => !ALLOWED.some((a) => f.includes(a)))
      .filter((f) => /\blocalStorage\b/.test(stripComments(readFileSync(f, 'utf8'))))
    expect(offenders).toEqual([])
  })
})
