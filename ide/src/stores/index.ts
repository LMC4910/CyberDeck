// stores layer — domain state stores; UI subscribes, never mutates directly.
// See ide/README.md for the boundary matrix.
export {
  createStore,
  type Store,
  type StoreDescriptor,
  type StoreKind,
  type RestoreAt,
  type Updater,
} from './store-base'
export { useStore } from './use-store'
export { StoreManager, type StoreManagerOptions, type StoreNotice } from './store-manager'
export * from './boot-critical'
