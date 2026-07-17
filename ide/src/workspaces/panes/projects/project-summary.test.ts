import { describe, it, expect } from 'vitest'
import { formatStamp, summarize, summarizeAll } from './project-summary'
import type { ProjectRecord } from '@/services/project'

function record(extra: Partial<ProjectRecord> = {}): ProjectRecord {
  return {
    format: 'cyberdeck.project',
    version: 1,
    id: 'proj_aaaaaa',
    meta: { name: 'Battlestation', workspace: 'deck-designer', createdAt: '2026-07-01T09:00:00.000Z' },
    savedAt: '2026-07-17T10:30:00.000Z',
    pages: [{ id: 'page_aaaaaa', name: 'Main', widgets: [] }],
    ...extra,
  }
}

describe('summarize (CD-405)', () => {
  it('derives meta + stats + devices from the document itself', () => {
    const s = summarize(
      record({
        pages: [
          {
            id: 'page_aaaaaa',
            name: 'Main',
            widgets: [
              { id: 'w_aaaaaa', type: 'gauge.circular', frame: { x: 0, y: 0, w: 1, h: 1 } },
              { id: 'w_bbbbbb', type: 'stat.readout', frame: { x: 0, y: 0, w: 1, h: 1 } },
            ],
          },
          { id: 'page_bbbbbb', name: 'Second', widgets: [{ id: 'w_cccccc', type: 'core.box', frame: { x: 0, y: 0, w: 1, h: 1 } }] },
        ],
        components: [
          { id: 'cmp_aaaaaa', name: 'Card', widgets: [{ id: 'w_dddddd', type: 'core.box', frame: { x: 0, y: 0, w: 1, h: 1 } }] },
        ],
        bindings: { w_aaaaaa: { value: { mode: 'variable', src: 'sys.cpu.load' } } },
        styles: { sty_aaaaaa: { kind: 'fill', name: 'Accent' } },
        assets: [{ id: 'ast_aaaaaa', kind: 'image', uri: 'asset://a.png' }],
        devices: [{ id: 'dev_aaaaaa', name: 'Studio iPad', deviceClass: 'ipad', pageId: 'page_aaaaaa' }],
      }),
    )!

    expect(s.id).toBe('proj_aaaaaa')
    expect(s.name).toBe('Battlestation')
    expect(s.workspace).toBe('deck-designer')
    expect(s.createdAt).toBe('2026-07-01T09:00:00.000Z')
    expect(s.savedAt).toBe('2026-07-17T10:30:00.000Z')
    expect(s.stats).toEqual({ pages: 2, widgets: 3, components: 1, styles: 1, assets: 1, bound: 1 })
    expect(s.devices).toHaveLength(1)
    expect(s.devices[0]?.name).toBe('Studio iPad')
  })

  it('reports zeroes for the registries a document simply does not have', () => {
    const s = summarize(record())!
    expect(s.stats).toEqual({ pages: 1, widgets: 0, components: 0, styles: 0, assets: 0, bound: 0 })
    expect(s.devices).toEqual([])
  })

  it('skips a record with no storage key — the table has nothing to act on', () => {
    const { id: _id, ...unkeyed } = record()
    expect(summarize(unkeyed)).toBeNull()
    expect(summarizeAll([unkeyed, record()])).toHaveLength(1)
  })
})

describe('formatStamp', () => {
  it('renders a stored ISO stamp and degrades honestly without one', () => {
    expect(formatStamp('2026-07-17T10:30:00.000Z')).toContain('2026')
    expect(formatStamp(undefined)).toBe('—')
    expect(formatStamp('not-a-date')).toBe('—')
  })
})
