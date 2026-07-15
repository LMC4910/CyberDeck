import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

// CD-301 AC: "no consumer-specific code inside the module". The pan/zoom surface is
// shared by the authoring canvas (M3) and the Flows graph (CD-410). This guard fails
// if any file in the module reaches into a consumer layer (workspaces/widgets/
// stores/services/repositories) or hard-codes a consumer concept. The eslint
// boundary rules also forbid these imports; this makes the intent explicit + local.
const HERE = dirname(fileURLToPath(import.meta.url))

const FORBIDDEN = [
  /from\s+['"].*\/(workspaces|widgets|stores|services|repositories|platform)\b/,
  /from\s+['"]@\/(workspaces|widgets|stores|services|repositories|platform)\b/,
  // consumer domain nouns that would leak intent into a generic module
  /\b(ProjectModel|WidgetInstance|FlowNode|deck-designer|inspector)\b/i,
]

describe('canvas module purity (CD-301)', () => {
  const files = readdirSync(HERE).filter(
    (f) => (f.endsWith('.ts') || f.endsWith('.tsx')) && !f.endsWith('.test.ts') && !f.endsWith('.test.tsx'),
  )

  it('scans more than the barrel', () => {
    expect(files.length).toBeGreaterThan(2)
  })

  for (const file of files) {
    it(`${file} contains no consumer-specific references`, () => {
      const src = readFileSync(join(HERE, file), 'utf8')
      for (const pattern of FORBIDDEN) {
        expect(src, `${file} matched ${pattern}`).not.toMatch(pattern)
      }
    })
  }
})
