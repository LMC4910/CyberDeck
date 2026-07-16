import { describe, it, expect } from 'vitest'
import { ProjectModel, GROUP_TYPE, type WidgetInstance } from '@/shared/project'
import { flattenLayers } from './layers-model'
import { filterRows, ancestorsOf } from './layers-filter'

function w(id: string, over: Partial<WidgetInstance> = {}): WidgetInstance {
  return { id, type: 'gauge.circular', frame: { x: 0, y: 0, w: 10, h: 10 }, ...over }
}

function model() {
  const m = new ProjectModel({
    format: 'cyberdeck.project',
    version: 1,
    meta: { name: 'F' },
    pages: [
      {
        id: 'page_flttst',
        name: 'P',
        widgets: [
          w('w_gauge0', { name: 'CPU Gauge' }),
          w('w_lockd0', { name: 'Locked Stat', locked: true }),
          w('w_hidde0', { name: 'Hidden Btn', config: { hidden: true } }),
          w('w_group0', { name: 'Panel', type: GROUP_TYPE, config: { childIds: ['w_gauge0'] } }),
        ],
      },
    ],
  })
  return m
}

describe('filterRows (CD-311)', () => {
  const m = model()
  const rows = flattenLayers(m, 'page_flttst', new Set())

  it('all → every row', () => {
    expect(filterRows(rows, 'all', '')).toHaveLength(rows.length)
  })
  it('containers → only container rows', () => {
    const r = filterRows(rows, 'containers', '')
    expect(r.every((x) => x.container)).toBe(true)
    expect(r.map((x) => x.id)).toContain('w_group0')
  })
  it('visible → excludes hidden', () => {
    expect(filterRows(rows, 'visible', '').some((x) => x.id === 'w_hidde0')).toBe(false)
  })
  it('locked → only locked', () => {
    expect(filterRows(rows, 'locked', '').map((x) => x.id)).toEqual(['w_lockd0'])
  })
  it('search matches names case-insensitively', () => {
    expect(filterRows(rows, 'all', 'cpu').map((x) => x.id)).toEqual(['w_gauge0'])
    expect(filterRows(rows, 'all', 'PANEL').map((x) => x.id)).toEqual(['w_group0'])
  })
})

describe('ancestorsOf (CD-311 breadcrumb)', () => {
  it('returns the nesting chain outermost → node', () => {
    const m = model()
    expect(ancestorsOf(m, 'w_gauge0').map((c) => c.id)).toEqual(['w_group0', 'w_gauge0'])
  })
  it('a root node is its own single crumb', () => {
    const m = model()
    expect(ancestorsOf(m, 'w_lockd0').map((c) => c.id)).toEqual(['w_lockd0'])
  })
})
