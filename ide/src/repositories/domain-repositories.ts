// The 7 domain repositories (CD-124), each bound to its CD-114 route group
// (shared/schemas/control-plane/routes.v1.json) with domain-specific operations
// layered on the RepositoryBase CRUD/subscribe.
import type {
  CyberDeckProjectDocumentCyberdeckProject as ProjectDocument,
  CyberDeckFlowDocumentCyberdeckFlow as FlowDocument,
  CyberDeckWidgetManifestV2 as WidgetManifest,
  VariableChangedEvent,
  DeviceHeartbeatEvent,
} from '@/shared/contract'
import type { Gateway } from './gateway'
import { RepositoryBase } from './repository-base'

export class VariablesRepository extends RepositoryBase<unknown> {
  constructor(gateway: Gateway) {
    super(gateway, {
      list: 'variables.query',
      get: 'variables.get',
      update: 'variables.write',
      subscribe: 'variables.subscribe',
    })
  }
  /** Write a variable value (alias for update with the value body). */
  write(id: string, value: unknown): Promise<unknown> {
    return this.update(id, { value })
  }
  onChanged(handler: (e: VariableChangedEvent) => void, params?: Record<string, unknown>): () => void {
    return this.gateway.subscribe<VariableChangedEvent>('variables.subscribe', params, handler)
  }
}

export class ProjectsRepository extends RepositoryBase<ProjectDocument> {
  constructor(gateway: Gateway) {
    super(gateway, {
      list: 'projects.list',
      get: 'projects.get',
      create: 'projects.create',
      update: 'projects.update',
      remove: 'projects.delete',
    })
  }
  open(id: string): Promise<ProjectDocument> {
    return this.gateway.request<ProjectDocument>('projects.open', { params: { id } })
  }
}

export class FlowsRepository extends RepositoryBase<FlowDocument> {
  constructor(gateway: Gateway) {
    super(gateway, {
      list: 'flows.list',
      get: 'flows.get',
      create: 'flows.create',
      update: 'flows.update',
      remove: 'flows.delete',
    })
  }
  deploy(id: string): Promise<void> {
    return this.gateway.request<void>('flows.deploy', { params: { id } })
  }
  arm(id: string, armed: boolean): Promise<void> {
    return this.gateway.request<void>('flows.arm', { params: { id }, body: { armed } })
  }
  trace(id: string, handler: (event: unknown) => void): () => void {
    return this.gateway.subscribe('flows.trace', { id }, handler)
  }
}

export class WidgetManifestsRepository extends RepositoryBase<WidgetManifest> {
  constructor(gateway: Gateway) {
    super(gateway, { list: 'widgets.manifests', get: 'widgets.manifest.get' })
  }
}

export class AssetsRepository extends RepositoryBase<unknown> {
  constructor(gateway: Gateway) {
    super(gateway, { list: 'assets.list', get: 'assets.get' })
  }
}

export class DevicesRepository extends RepositoryBase<unknown> {
  constructor(gateway: Gateway) {
    super(gateway, { list: 'devices.list', subscribe: 'devices.heartbeat' })
  }
  heartbeat(handler: (e: DeviceHeartbeatEvent) => void): () => void {
    return this.gateway.subscribe<DeviceHeartbeatEvent>('devices.heartbeat', undefined, handler)
  }
  assign(id: string, pageId: string): Promise<void> {
    return this.gateway.request<void>('devices.assign', { params: { id }, body: { pageId } })
  }
  revoke(id: string): Promise<void> {
    return this.gateway.request<void>('devices.revoke', { params: { id } })
  }
}

export class AiThreadsRepository extends RepositoryBase<unknown> {
  constructor(gateway: Gateway) {
    super(gateway, { list: 'ai.threads.list' })
  }
  suggestLayout(body: unknown): Promise<unknown> {
    return this.gateway.request('ai.threads.suggest', { body })
  }
}
