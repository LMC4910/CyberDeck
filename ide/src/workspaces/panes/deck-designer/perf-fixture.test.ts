import { describe, it, expect } from 'vitest'
import { ProjectModel } from '@/shared/project'
import { generatePerfProject } from './perf-fixture'

describe('generatePerfProject (CD-309)', () => {
  it('produces exactly N widgets on one page', () => {
    const doc = generatePerfProject(200)
    expect(doc.pages[0]!.widgets).toHaveLength(200)
  })

  it('is a valid, invariant-clean document', () => {
    const model = new ProjectModel(generatePerfProject(200))
    expect(model.validate()).toEqual([])
  })

  it('is deterministic (same input → identical output)', () => {
    expect(generatePerfProject(50)).toEqual(generatePerfProject(50))
  })

  it('lays widgets on a non-overlapping grid within the canvas', () => {
    const doc = generatePerfProject(200)
    const canvas = doc.pages[0]!.canvas!
    for (const w of doc.pages[0]!.widgets) {
      expect(w.frame.x + w.frame.w).toBeLessThanOrEqual(canvas.w!)
      expect(w.frame.y + w.frame.h).toBeLessThanOrEqual(canvas.h!)
    }
  })
})
