// repositories layer — per-domain data access, the only layer that talks to a
// gateway. See ide/README.md for the boundary matrix.
export {
  type Gateway,
  type RequestOptions,
  type RequestLogEntry,
} from './gateway'
export {
  RepositoryBase,
  UnsupportedOperationError,
  type QueryParams,
  type Page,
  type SortSpec,
  type RouteGroup,
} from './repository-base'
export * from './domain-repositories'
export { RepositoryRegistry } from './repository-registry'
export * from './middleware'
