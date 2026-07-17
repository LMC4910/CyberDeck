// Variables workspace environment (CD-403). The one thing the pane needs from
// outside its own folder: navigation. A "used by" reference (variables-source.ts →
// VariableReference) points at an entity in another workspace, and clicking it must
// route there AND select the target. The workspace boundary forbids the pane from
// reaching a WorkspaceService/selection store directly, so the composition root
// injects a single `navigate(ref)` callback the pane calls — the shell binds it to
// `WorkspaceService.setActive(ref.workspace)` + selecting `ref.targetId`.
//
// Read through useVariablesEnvOptional(): an unwired shell renders the reference list
// with disabled targets and an honest reason instead of dead controls that go nowhere.
import { createContext, useContext } from 'react'
import type { VariableReference } from './variables-source'

export interface VariablesEnv {
  /** Route to a reference's workspace and select its target entity. */
  navigate: (ref: VariableReference) => void
}

const EnvContext = createContext<VariablesEnv | null>(null)
export const VariablesEnvProvider = EnvContext.Provider

/** The bound environment, or null when the shell has not wired navigation yet. */
export function useVariablesEnvOptional(): VariablesEnv | null {
  return useContext(EnvContext)
}
