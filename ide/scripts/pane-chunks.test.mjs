// CD-203 AC: each workspace pane is its own chunk (bundle-analysis assertion).
// Runs against the built dist/ — invoke after `pnpm build`. Part of `pnpm test:chunks`.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'

const dist = join(fileURLToPath(new URL('..', import.meta.url)), 'dist', 'assets')

const PANES = [
  'runtime',
  'deck-designer',
  'flows',
  'variables',
  'library',
  'devices',
  'projects',
]

test('each workspace pane is emitted as its own chunk', () => {
  const files = readdirSync(dist)
  for (const pane of PANES) {
    const has = files.some((f) => f.startsWith(`${pane}-pane-`) && f.endsWith('.js'))
    assert.ok(has, `expected a code-split chunk for the "${pane}" pane in dist/assets`)
  }
})
