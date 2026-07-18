// CD-423 gate: zero statically-imported widgets. The canon widget modules must be
// reachable ONLY through the resolver's per-manifest dynamic import() — never a static
// `import X from '.../canon/modules/...'`. This is the grep/lint gate the ticket names:
// it fails the build if any code hard-wires a widget module instead of loading it from
// its manifest.
import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const SRC = join(process.cwd(), 'src')

function tsFiles(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === 'dist') continue
      out.push(...tsFiles(full))
    } else if (/\.(ts|tsx)$/.test(entry.name)) {
      out.push(full)
    }
  }
  return out
}

describe('CD-423 gate — zero statically-imported widget modules', () => {
  it('canon widget modules are referenced only via dynamic import() (never a static import)', () => {
    const offenders: string[] = []
    for (const file of tsFiles(SRC)) {
      const source = readFileSync(file, 'utf8')
      if (!source.includes('canon/modules/') && !source.includes('./modules/')) continue
      for (const line of source.split('\n')) {
        // A static import statement referencing a canon module — the thing we forbid.
        // Dynamic `import('./modules/…')` starts with `import(` and is allowed.
        const refsModule = /canon\/modules\//.test(line) || /['"]\.\/modules\//.test(line)
        const isStaticImport = /^\s*import\b/.test(line) && !/import\s*\(/.test(line)
        if (refsModule && isStaticImport) offenders.push(`${file.replace(SRC, 'src')}: ${line.trim()}`)
      }
    }
    expect(offenders).toEqual([])
  })

  it('the resolver is the single place that loads the modules', () => {
    const resolver = readFileSync(join(SRC, 'widgets/canon/resolver.ts'), 'utf8')
    // 11 dynamic module imports, one per canon widget.
    const dynamicImports = resolver.match(/import\(['"]\.\/modules\//g) ?? []
    expect(dynamicImports.length).toBe(11)
  })
})
