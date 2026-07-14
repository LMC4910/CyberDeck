// Boot-critical stores (CD-131). Preferences, Workspace, Auth and UI — the stores
// that must be restored before first paint (design STORES rows). Auth persists a
// TOKEN ONLY: no credential material ever touches web storage (§Security).
import type {
  CyberDeckUserPreferences,
  CyberDeckWorkspaceLayoutConfiguration,
} from '@/shared/contract'
import { createStore, type Store } from '../store-base'

// --- Preferences (persisted · cdk-prefs · boot·blocking) ---
export type PreferencesState = CyberDeckUserPreferences

export function createPreferencesStore(
  initial: PreferencesState = { version: 1 },
): Store<PreferencesState> {
  return createStore(initial, {
    name: 'preferences',
    kind: 'persisted',
    location: 'cdk-prefs',
    restoreAt: 'boot-blocking',
  })
}

// --- Workspace (persisted · cdk-layout · boot·blocking) ---
export type WorkspaceState = CyberDeckWorkspaceLayoutConfiguration

export function createWorkspaceStore(
  initial: WorkspaceState = { version: 1, workspaceId: 'home', panels: [] },
): Store<WorkspaceState> {
  return createStore(initial, {
    name: 'workspace',
    kind: 'persisted',
    location: 'cdk-layout',
    restoreAt: 'boot-blocking',
  })
}

// --- Auth (persisted · cdk-auth · boot·blocking · TOKEN ONLY) ---
// SECURITY: this is the ONLY thing persisted for auth. Never a password, API key,
// refresh secret, or profile — the engine (core/security) owns real security state.
export interface AuthState {
  token: string | null
  /** Opaque session id (not a secret). */
  sessionId: string | null
  /** Unix ms expiry, for offline-first restore. */
  expiresAt: number | null
}

export const AUTH_ALLOWED_KEYS: readonly (keyof AuthState)[] = ['token', 'sessionId', 'expiresAt']

export function createAuthStore(
  initial: AuthState = { token: null, sessionId: null, expiresAt: null },
): Store<AuthState> {
  return createStore(initial, {
    name: 'auth',
    kind: 'persisted',
    location: 'cdk-auth',
    restoreAt: 'boot-blocking',
  })
}

// --- UI (temp · memory) ---
export interface UIState {
  openMenuId: string | null
  dragging: boolean
  commandPaletteOpen: boolean
}

export function createUIStore(
  initial: UIState = { openMenuId: null, dragging: false, commandPaletteOpen: false },
): Store<UIState> {
  return createStore(initial, { name: 'ui', kind: 'temp' })
}

export interface BootCriticalStores {
  preferences: Store<PreferencesState>
  workspace: Store<WorkspaceState>
  auth: Store<AuthState>
  ui: Store<UIState>
}

export function createBootCriticalStores(): BootCriticalStores {
  return {
    preferences: createPreferencesStore(),
    workspace: createWorkspaceStore(),
    auth: createAuthStore(),
    ui: createUIStore(),
  }
}
