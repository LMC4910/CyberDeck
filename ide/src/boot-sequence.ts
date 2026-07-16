// App boot sequence (CD-136). Assembles the kernel services and runs the ordered
// boot phases (BOOTSEQ) via the BootManager. This is the real, observable boot the
// Playwright E2E drives: it ends by marking the app interactive. Kept minimal for
// M1 — later milestones add extension host, widget registry, background services.
import { runBoot, type BootPhase, type BootReport } from '@/platform/boot'
import { ConfigurationService } from '@/services/configuration'
import { ThemeService } from '@/services/theme'
import { WorkspaceService } from '@/services/workspace'
import { SessionManager } from '@/services/session'
import { LocalStorageAdapter } from '@/services/persistence'
import { CommandRegistry, seedCommands } from '@/platform/commands'
import { KeymapDispatcher, detectPlatform } from '@/platform/keymap'
import { DockManager } from '@/platform/dock'
import { UndoStack } from '@/platform/undo'
import { EventBus, TypedEventBus } from '@/platform/eventbus'
import { NotificationService, type Notification } from '@/services/notification'
import { ProjectService } from '@/services/project'
import { ProjectModel, starterProject, type ProjectDocument } from '@/shared/project'
import {
  createAllStores,
  createStore,
  StoreManager,
  createSelectionStore,
  SelectionEngine,
  type AllStores,
  type Store,
  type SelectionState,
} from '@/stores'
import { WORKSPACE_CONTRIBUTIONS, registerCanvasCommands, type PanelsState, type LayoutPreset } from '@/workspaces'

export interface BootedKernel {
  config: ConfigurationService
  theme: ThemeService
  workspaces: WorkspaceService
  commands: CommandRegistry
  keymap: KeymapDispatcher
  bus: TypedEventBus
  stores: AllStores
  session: SessionManager
  panels: Store<PanelsState>
  userPresets: Store<{ presets: LayoutPreset[] }>
  dock: DockManager
  undo: UndoStack
  notifications: NotificationService
  /** Owns the open ProjectModel + debounced autosave (CD-304). */
  project: ProjectService
  /** The single selection source every panel subscribes to (CD-305, AUDIT C2). */
  selection: SelectionEngine
  selectionStore: Store<SelectionState>
  /** Canvas authoring settings — snap toggle + grid (CD-307). */
  canvasSettings: Store<{ snap: boolean; grid: number }>
  /** Drawer projection (all notifications) + active toasts. */
  notificationStore: Store<{ items: Notification[] }>
  toastStore: Store<{ items: Notification[] }>
  /** Persist the current dock layout (call after a dock transition). */
  saveDock: () => void
  /** Flush all pending write-behind persistence (wire to beforeunload / quit). */
  flush: () => void
  report: BootReport
}

/** The default feature flags (design FLAGDEFS defaults). */
function defaultConfig(): ConfigurationService {
  return new ConfigurationService({
    layers: {
      defaults: {
        features: {
          expWidgets: false,
          devTools: true,
          aiProviders: true,
          marketplace: false,
          cloudSync: false,
          automation: true,
          pluginSandbox: true,
        },
        theme: { id: 'cyber-dark', mode: 'dark' },
      },
    },
  })
}

export async function runAppBoot(): Promise<BootedKernel> {
  const config = defaultConfig()
  const theme = new ThemeService()
  const commands = new CommandRegistry()
  const bus = new TypedEventBus(new EventBus())
  // WorkspaceService bridges onChanged → WorkspaceChanged on the bus.
  const workspaces = new WorkspaceService({ onChanged: (id) => bus.emit('WorkspaceChanged', { workspaceId: id }) })
  const stores = createAllStores()
  const keymap = new KeymapDispatcher(commands, { platform: detectPlatform() })
  const session = new SessionManager({ adapter: new LocalStorageAdapter() })
  // Per-workspace resizable-panel widths/visibility, persisted (CD-213).
  const panels = createStore<PanelsState>({ panels: {} }, { name: 'panels', kind: 'persisted', location: 'cdk-panels' })
  // Dock tool windows (CD-214/215): the Live Mirror tool window, persisted.
  const dock = new DockManager()
  dock.register({ id: 'mirror', defaultSide: 'right', minSize: 220, defaultSize: 280 })
  // A second tool window registered purely declaratively (CD-216) — zero new dock
  // code: it docks/pins/peeks/floats through the same DockManager + DockHost.
  dock.register({ id: 'minimap', defaultSide: 'left', minSize: 160, defaultSize: 200 })
  const dockStore = createStore<{ rows: ReturnType<DockManager['serialize']> }>(
    { rows: [] },
    { name: 'dock', kind: 'persisted', location: 'cdk-dock' },
  )
  const saveDock = () => dockStore.setState({ rows: dock.serialize() })
  // Undo/redo + notifications (CD-218 wiring). onNotify projects to the drawer
  // store and, for toast-flagged notifications, the transient toast store.
  const undo = new UndoStack()
  const notificationStore = createStore<{ items: Notification[] }>({ items: [] }, { name: 'notification', kind: 'derived' })
  const toastStore = createStore<{ items: Notification[] }>({ items: [] }, { name: 'toasts', kind: 'temp' })
  const notifications = new NotificationService({
    onNotify: (n) => {
      notificationStore.setState((s) => ({ items: [n, ...s.items] }))
      if (n.toast) toastStore.setState((s) => ({ items: [n, ...s.items] }))
    },
  })
  // User-saved layout presets (CD-217), persisted.
  const userPresets = createStore<{ presets: LayoutPreset[] }>(
    { presets: [] },
    { name: 'presets', kind: 'persisted', location: 'cdk-presets' },
  )
  const storeManager = new StoreManager({ adapter: new LocalStorageAdapter() })
  storeManager.register(panels)
  storeManager.register(dockStore as unknown as Store<unknown>)
  storeManager.register(userPresets as unknown as Store<unknown>)
  // Project document autosave (CD-304): the ProjectService serializes the open model
  // and writes it into the persisted `project` store, whose write-behind lands it in
  // localStorage now (and the gateway-backed ProjectsRepository at the M5 swap).
  storeManager.register(stores.project as unknown as Store<unknown>)
  const project = new ProjectService({
    persistence: {
      save: async (doc) => {
        stores.project.setState({ doc } as never)
      },
    },
  })
  // The single selection source (CD-305): canvas ring, layers, inspector, breadcrumb
  // all subscribe to this one store; the engine is the only writer.
  const selectionStore = createSelectionStore()
  const selection = new SelectionEngine(selectionStore)
  // Canvas authoring commands (CD-308): the minibar + palette dispatch these; the
  // handler resolves the live model/selection/undo at execution time.
  registerCanvasCommands(commands, () =>
    project.model ? { model: project.model, engine: selection, undo } : null,
  )
  // Canvas authoring settings (CD-307): snap-to-guides toggle + grid size, persisted.
  const canvasSettings = createStore<{ snap: boolean; grid: number }>(
    { snap: true, grid: 8 },
    { name: 'canvas', kind: 'persisted', location: 'cdk-canvas' },
  )
  storeManager.register(canvasSettings as unknown as Store<unknown>)

  const phases: BootPhase[] = [
    { id: 'configuration', blocking: true, run: () => void config.getAll() },
    {
      id: 'theme',
      blocking: true,
      run: () => theme.apply(config.get<string>('theme.id') ?? 'cyber-dark'),
    },
    { id: 'commands', blocking: true, run: () => commands.registerAll(seedCommands()) },
    {
      id: 'workspaces',
      blocking: true,
      run: () => {
        workspaces.registerAll(WORKSPACE_CONTRIBUTIONS)
        // nav-history commands (CD-204): ⌘[ back / ⌘] forward
        commands.register({
          id: 'workspace.back',
          category: 'View',
          label: 'Back',
          keys: ['⌘', '['],
          handler: () => void workspaces.back(),
        })
        commands.register({
          id: 'workspace.forward',
          category: 'View',
          label: 'Forward',
          keys: ['⌘', ']'],
          handler: () => void workspaces.forward(),
        })
      },
    },
    // Keymap defaults after all commands are registered (CD-209).
    { id: 'keymap', blocking: true, run: () => keymap.loadDefaults() },
    // Restore persisted panel widths (CD-213) + dock layout (CD-215) — non-blocking.
    {
      id: 'panels-restore',
      blocking: false,
      run: () => {
        storeManager.restore()
        const rows = dockStore.getState().rows
        if (rows.length) dock.hydrate(rows)
      },
    },
    // Open the project model AFTER the project store is restored (CD-304): restore a
    // saved document, or seed the starter. A corrupt blob falls back to the starter.
    {
      id: 'project-open',
      blocking: false,
      run: () => {
        const saved = (stores.project.getState() as { doc: ProjectDocument | null }).doc
        let model: ProjectModel
        try {
          model = saved ? ProjectModel.restore(saved) : new ProjectModel(starterProject())
        } catch {
          model = new ProjectModel(starterProject())
        }
        project.open(model)
      },
    },
    // Session restore (CD-212, boot stage 4): restore the last workspace + editor
    // state, then wire debounced write-behind. Corrupt blob → defaults (SessionManager notices).
    {
      id: 'session-restore',
      blocking: true,
      run: () => {
        const blob = session.load()
        if (blob?.activeWorkspace && workspaces.get(blob.activeWorkspace)) {
          workspaces.setActive(blob.activeWorkspace)
        }
        if (blob) {
          stores.editor.setState({ zoom: blob.zoom ?? 1, selection: blob.selection ?? [] })
        }
        const persist = () =>
          session.save({
            activeWorkspace: workspaces.active() ?? undefined,
            selection: (stores.editor.getState() as { selection: string[] }).selection,
            zoom: (stores.editor.getState() as { zoom: number }).zoom,
          })
        workspaces.subscribe(persist)
        stores.editor.subscribe(persist)
      },
    },
  ]

  const report = await runBoot(phases, {
    order: ['configuration', 'theme', 'commands', 'workspaces', 'keymap', 'session-restore', 'panels-restore', 'project-open'],
    onComplete: () => {
      // mark the app interactive for the E2E / perf tooling
      try {
        performance.mark('cyberdeck:boot:interactive')
      } catch {
        /* no-op */
      }
    },
  })

  const flush = () => {
    void project.flush()
    session.flush()
    storeManager.flush()
  }
  // A welcome notification so the drawer isn't empty on first run (info, no toast).
  notifications.notify({ level: 'info', source: 'CyberDeck', title: 'Welcome to CyberDeck', body: 'The shell is ready.' })
  return {
    config, theme, workspaces, commands, keymap, bus, stores, session, panels, userPresets,
    dock, undo, notifications, project, selection, selectionStore, canvasSettings,
    notificationStore, toastStore, saveDock, flush, report,
  }
}
