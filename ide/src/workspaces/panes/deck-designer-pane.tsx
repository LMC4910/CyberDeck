// Deck Designer pane (CD-203 shell → CD-303 board → CD-304 shared model). Hosts the
// authoring canvas: a shared PanZoomSurface (CD-301) whose world layer is the
// model-driven Board (CD-303). The ProjectModel is the single source of truth,
// provided by the kernel (ProjectModelProvider at the shell) and owned by
// ProjectService (autosave). Selection, drag/resize, snapping, inspector and layers
// arrive across CD-305…328. Its own chunk via import() (pane-host lazy loads it).
import { useMemo } from 'react'
import { PanZoomSurface } from '@/shared/canvas'
import { Board } from './deck-designer/board'
import { useProjectModel } from './deck-designer/use-project-model'
import './deck-designer/deck-designer.css'

export default function DeckDesignerPane() {
  const model = useProjectModel()
  const pageId = useMemo(() => model.pages()[0]!.id, [model])
  const canvas = model.page(pageId)?.canvas

  return (
    <section className="dd-pane" data-pane="deck-designer" aria-label="Deck Designer workspace">
      <PanZoomSurface
        aria-label="Deck canvas"
        getFitBounds={() => (canvas?.w && canvas?.h ? { x: 0, y: 0, w: canvas.w, h: canvas.h } : null)}
      >
        <Board model={model} pageId={pageId} />
      </PanZoomSurface>
    </section>
  )
}
