// Project service (CD-304): owns the open ProjectModel + debounced autosave.
// CD-406 adds the open flow: catalog → document → model → ProjectOpened → recents.
export {
  ProjectService,
  NoCatalogError,
  type SaveState,
  type SaveStateListener,
  type ModelListener,
  type ProjectPersistence,
  type ProjectServiceOptions,
} from './project-service'
export {
  projectIdOf,
  type ProjectCatalog,
  type ProjectRecord,
  type ProjectPage,
  type ProjectQuery,
  type ProjectSort,
} from './project-catalog'
export { ProjectRecents, type RecentProject, type ProjectRecentsOptions } from './project-recents'
