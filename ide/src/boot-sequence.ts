// App boot sequence (CD-136). Assembles the kernel services and runs the ordered
// boot phases (BOOTSEQ) via the BootManager. This is the real, observable boot the
// Playwright E2E drives: it ends by marking the app interactive. Kept minimal for
// M1 — later milestones add extension host, widget registry, background services.
import { runBoot, type BootPhase, type BootReport } from '@/platform/boot'
import { ConfigurationService } from '@/services/configuration'
import { ThemeService } from '@/services/theme'
import { WorkspaceService } from '@/services/workspace'
import { CommandRegistry, seedCommands } from '@/platform/commands'
import { KeymapDispatcher, detectPlatform } from '@/platform/keymap'
import { EventBus, TypedEventBus } from '@/platform/eventbus'
import { createAllStores, type AllStores } from '@/stores'
import { WORKSPACE_CONTRIBUTIONS } from '@/workspaces'

export interface BootedKernel {
  config: ConfigurationService
  theme: ThemeService
  workspaces: WorkspaceService
  commands: CommandRegistry
  keymap: KeymapDispatcher
  bus: TypedEventBus
  stores: AllStores
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
  ]

  const report = await runBoot(phases, {
    order: ['configuration', 'theme', 'commands', 'workspaces', 'keymap'],
    onComplete: () => {
      // mark the app interactive for the E2E / perf tooling
      try {
        performance.mark('cyberdeck:boot:interactive')
      } catch {
        /* no-op */
      }
    },
  })

  return { config, theme, workspaces, commands, keymap, bus, stores, report }
}
