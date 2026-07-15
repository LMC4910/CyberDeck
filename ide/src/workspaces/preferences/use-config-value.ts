// useConfigValue (CD-208): subscribe to a ConfigurationService path so a settings
// control renders the LIVE config value with zero local component state — the
// config is the single source of truth; this hook only mirrors it (like useStore).
import { useCallback, useSyncExternalStore } from 'react'
import type { ConfigurationService } from '@/services/configuration'

export function useConfigValue<T>(
  config: ConfigurationService,
  path: string,
  fallback: T,
): T {
  const subscribe = useCallback(
    (onChange: () => void) => config.watch(path, () => onChange()),
    [config, path],
  )
  const getSnapshot = useCallback(() => config.get<T>(path) ?? fallback, [config, path, fallback])
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}
