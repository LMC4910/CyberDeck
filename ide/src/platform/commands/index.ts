export {
  CommandRegistry,
  DuplicateCommandError,
  UnknownCommandError,
  CommandNotAvailableError,
  CommandArgsError,
  type CommandDescriptor,
  type CommandRegistryOptions,
  type WhenContext,
} from './command-registry'
export { evaluateWhen } from './when-clause'
export { seedCommands, SEED_CATEGORIES, type ActionDispatch } from './seed-commands'
