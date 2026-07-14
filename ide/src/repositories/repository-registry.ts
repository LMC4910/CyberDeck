// RepositoryRegistry (CD-124). Instantiates the 7 domain repositories bound to a
// single gateway, and exposes them by name. Resolved from the ServiceContainer at
// assembly; the gateway is Mock (CD-127) or Engine (M5), selected by config.
import type { Gateway } from './gateway'
import type { RepositoryBase, RouteGroup } from './repository-base'
import {
  VariablesRepository,
  ProjectsRepository,
  FlowsRepository,
  WidgetManifestsRepository,
  AssetsRepository,
  DevicesRepository,
  AiThreadsRepository,
} from './domain-repositories'

export class RepositoryRegistry {
  readonly variables: VariablesRepository
  readonly projects: ProjectsRepository
  readonly flows: FlowsRepository
  readonly widgetManifests: WidgetManifestsRepository
  readonly assets: AssetsRepository
  readonly devices: DevicesRepository
  readonly aiThreads: AiThreadsRepository

  constructor(gateway: Gateway) {
    this.variables = new VariablesRepository(gateway)
    this.projects = new ProjectsRepository(gateway)
    this.flows = new FlowsRepository(gateway)
    this.widgetManifests = new WidgetManifestsRepository(gateway)
    this.assets = new AssetsRepository(gateway)
    this.devices = new DevicesRepository(gateway)
    this.aiThreads = new AiThreadsRepository(gateway)
  }

  /** All repositories, for iteration (e.g. the inspector). */
  all(): Array<{ name: string; repo: RepositoryBase<unknown>; routes: RouteGroup }> {
    return [
      { name: 'variables', repo: this.variables, routes: this.variables.routes },
      { name: 'projects', repo: this.projects, routes: this.projects.routes },
      { name: 'flows', repo: this.flows, routes: this.flows.routes },
      { name: 'widgetManifests', repo: this.widgetManifests, routes: this.widgetManifests.routes },
      { name: 'assets', repo: this.assets, routes: this.assets.routes },
      { name: 'devices', repo: this.devices, routes: this.devices.routes },
      { name: 'aiThreads', repo: this.aiThreads, routes: this.aiThreads.routes },
    ]
  }
}
