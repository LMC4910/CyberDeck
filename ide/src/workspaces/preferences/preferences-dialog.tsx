// Preferences (CD-208): a focus-trapped dialog with General + Appearance panes.
// Every control writes through ConfigurationService (user layer) — NO local state
// for setting values (useConfigValue mirrors the live config). The theme picker
// also drives ThemeService so the swap is immediate.
import type { ConfigurationService } from '@/services/configuration'
import type { ThemeService } from '@/services/theme'
import type { CommandRegistry } from '@/platform/commands'
import type { KeymapDispatcher } from '@/platform/keymap'
import { Dialog, Tabs, TabList, Tab, TabPanel } from '@/shared/a11y'
import { useConfigValue } from './use-config-value'
import { KeyboardPane } from './keyboard-pane'
import './preferences.css'

export type PreferencesTab = 'general' | 'appearance' | 'keyboard'

export interface PreferencesDialogProps {
  config: ConfigurationService
  theme: ThemeService
  open: boolean
  onClose: () => void
  tab: PreferencesTab
  onTabChange: (t: PreferencesTab) => void
  /** Keyboard pane inputs (optional — omit to hide the Keyboard tab). */
  commands?: CommandRegistry
  dispatcher?: KeymapDispatcher
  onKeymapChange?: () => void
}

export function PreferencesDialog({
  config,
  theme,
  open,
  onClose,
  tab,
  onTabChange,
  commands,
  dispatcher,
  onKeymapChange,
}: PreferencesDialogProps) {
  if (!open) return null
  const showKeyboard = !!commands && !!dispatcher
  return (
    <Dialog open={open} onClose={onClose} label="Preferences">
      <div className="prefs">
        <h2 className="prefs-title">Preferences</h2>
        <Tabs value={tab} onValueChange={(t) => onTabChange(t as PreferencesTab)} label="Preferences">
          <TabList label="Preference sections">
            <Tab value="general">General</Tab>
            <Tab value="appearance">Appearance</Tab>
            {showKeyboard && <Tab value="keyboard">Keyboard</Tab>}
          </TabList>
          <TabPanel value="general">
            <GeneralPane config={config} />
          </TabPanel>
          <TabPanel value="appearance">
            <AppearancePane config={config} theme={theme} />
          </TabPanel>
          {showKeyboard && (
            <TabPanel value="keyboard">
              <KeyboardPane registry={commands} dispatcher={dispatcher} onChange={onKeymapChange} />
            </TabPanel>
          )}
        </Tabs>
      </div>
    </Dialog>
  )
}

function GeneralPane({ config }: { config: ConfigurationService }) {
  const telemetry = useConfigValue(config, 'telemetry.enabled', false)
  const density = useConfigValue(config, 'density', 'comfortable')
  return (
    <div className="prefs-pane">
      <label className="prefs-row">
        <span>Send anonymous telemetry</span>
        <button
          role="switch"
          aria-checked={telemetry}
          data-setting="telemetry.enabled"
          className={telemetry ? 'prefs-switch on' : 'prefs-switch'}
          onClick={() => config.set('telemetry.enabled', !telemetry, 'user')}
        >
          {telemetry ? 'On' : 'Off'}
        </button>
      </label>
      <label className="prefs-row">
        <span>Density</span>
        <select
          data-setting="density"
          value={density}
          onChange={(e) => config.set('density', e.target.value, 'user')}
        >
          <option value="comfortable">Comfortable</option>
          <option value="compact">Compact</option>
          <option value="spacious">Spacious</option>
        </select>
      </label>
    </div>
  )
}

function AppearancePane({ config, theme }: { config: ConfigurationService; theme: ThemeService }) {
  const activeTheme = useConfigValue(config, 'theme.id', 'cyber-dark')
  return (
    <div className="prefs-pane">
      <div className="prefs-row">
        <span>Theme</span>
        <div role="radiogroup" aria-label="Theme" className="prefs-themes">
          {theme.list().map((t) => (
            <button
              key={t.id}
              role="radio"
              aria-checked={t.id === activeTheme}
              data-theme-option={t.id}
              className={t.id === activeTheme ? 'prefs-theme on' : 'prefs-theme'}
              onClick={() => {
                config.set('theme.id', t.id, 'user')
                theme.apply(t.id) // immediate swap
              }}
            >
              {t.name}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
