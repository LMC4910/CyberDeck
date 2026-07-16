// Command registry context (CD-308). Gives authoring panels access to the shared
// command registry so the selection minibar (and later toolbars) dispatch registered
// commands rather than calling operations directly.
import { createContext, useContext } from 'react'
import type { CommandRegistry } from '@/platform/commands'

const CommandsContext = createContext<CommandRegistry | null>(null)
export const CommandsProvider = CommandsContext.Provider

export function useCommands(): CommandRegistry {
  const commands = useContext(CommandsContext)
  if (!commands) throw new Error('useCommands must be used within a CommandsProvider')
  return commands
}
