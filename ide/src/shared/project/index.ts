// ProjectModel domain module (CD-302). The in-memory authoring document + its
// invariants. Consumed by the canvas workspace, ProjectService, and stores.
export {
  ProjectModel,
  validateDocument,
  type ModelChange,
  type ModelListener,
} from './project-model'
export {
  GROUP_TYPE,
  isContainer,
  childIdsOf,
  type ProjectDocument,
  type Page,
  type WidgetInstance,
  type Frame,
  type Binding,
  type ComponentDef,
  type Variant,
  type StateDef,
  type Inverse,
  type Diagnostic,
} from './types'
export { IdAllocator, isStableId, ID_PREFIX } from './id'
export type { RandomSource } from './id'
export { starterProject } from './starter'
