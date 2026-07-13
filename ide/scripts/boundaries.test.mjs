// CD-103 AC: prove the eslint boundary rules actually deny cross-feature
// imports. Lints the committed fixture (a cross-workspace import) WITHOUT the
// ignore-pattern that `pnpm lint` uses, and asserts the violation is reported.
// Run: pnpm test:boundaries
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import { ESLint } from 'eslint'

const ideRoot = fileURLToPath(new URL('..', import.meta.url))
const eslint = new ESLint({ cwd: ideRoot })

test('cross-workspace import fails boundaries/dependencies', async () => {
  const results = await eslint.lintFiles(['src/workspaces/__fixture-b__/index.ts'])
  const boundaryErrors = results
    .flatMap((r) => r.messages)
    .filter((m) => m.ruleId === 'boundaries/dependencies')
  assert.ok(
    boundaryErrors.length > 0,
    'expected the cross-workspace import in __fixture-b__ to be reported as a boundary violation',
  )
})

test('layer-respecting file has no boundary errors', async () => {
  const results = await eslint.lintFiles(['src/platform/index.ts'])
  const boundaryErrors = results
    .flatMap((r) => r.messages)
    .filter((m) => m.ruleId === 'boundaries/dependencies')
  assert.equal(boundaryErrors.length, 0)
})
