// Boundary-rule fixture (CD-103): cross-workspace import — MUST fail
// boundaries/dependencies. Excluded from `pnpm lint`; linted only by
// scripts/boundaries.test.mjs.
import { fixtureA } from '../__fixture-a__'

export const fixtureB = `${fixtureA}-b`
