// Boundary-rule fixture (CD-103): a minimal "workspace" that __fixture-b__
// illegally imports from. Excluded from `pnpm lint`; linted only by
// scripts/boundaries.test.mjs, which asserts the violation is reported.
export const fixtureA = 'fixture-a'
