// Deck Designer pane (CD-203 shell → CD-303 board). Hosts the authoring canvas: a
// shared PanZoomSurface (CD-301) whose world layer is the model-driven Board
// (CD-303). The ProjectModel is the single source of truth. Selection, drag/resize,
// snapping, inspector and layers arrive across CD-305…328; this pane is where they
// compose. Its own chunk via import() (pane-host lazy loads it).
import { useMemo, useRef } from 'react'
import { PanZoomSurface } from '@/shared/canvas'
import { ProjectModel } from '@/shared/project'
import { Board } from './deck-designer/board'
import { ProjectModelProvider } from './deck-designer/use-project-model'
import { demoProject } from './deck-designer/demo-project'
import './deck-designer/deck-designer.css'

export default function DeckDesignerPane() {
  // Stable model instance for the pane's lifetime (replaced by the project store at
  // CD-304). useRef so pan/zoom re-renders never rebuild the document.
  const modelRef = useRef<ProjectModel>(null)
  if (modelRef.current === null) modelRef.current = new ProjectModel(demoProject())
  const model = modelRef.current
  const pageId = useMemo(() => model.pages()[0]!.id, [model])
  const canvas = model.page(pageId)?.canvas

  return (
    <section className="dd-pane" data-pane="deck-designer" aria-label="Deck Designer workspace">
      <ProjectModelProvider value={model}>
        <PanZoomSurface
          aria-label="Deck canvas"
          getFitBounds={() =>
            canvas?.w && canvas?.h ? { x: 0, y: 0, w: canvas.w, h: canvas.h } : null
          }
        >
          <Board model={model} pageId={pageId} />
        </PanZoomSurface>
      </ProjectModelProvider>
    </section>
  )
}
