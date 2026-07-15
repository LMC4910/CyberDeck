// A11y primitives (CD-201): Button, Tabs/Tab/TabPanel, Tree/TreeItem, Dialog.
// Every primitive carries the right roles + labels, is keyboard-operable, and
// shows a focus-visible ring (a11y.css). The rest of the chrome builds on these.
import {
  createContext,
  useContext,
  useId,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type ReactNode,
} from 'react'
import { activateOnKey } from './activation'
import { useFocusTrap } from './focus'
import './a11y.css'

// --- Button ---
export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label?: string
}
export function Button({ label, children, ...rest }: ButtonProps) {
  return (
    <button type="button" className="a11y-btn" aria-label={label} {...rest}>
      {children}
    </button>
  )
}

// --- Tabs (roving tabindex) ---
interface TabsCtx {
  value: string
  setValue: (v: string) => void
  baseId: string
}
const TabsContext = createContext<TabsCtx | null>(null)

export function Tabs({
  value,
  onValueChange,
  label,
  children,
}: {
  value: string
  onValueChange: (v: string) => void
  label: string
  children: ReactNode
}) {
  const baseId = useId()
  return (
    <TabsContext.Provider value={{ value, setValue: onValueChange, baseId }}>
      <div className="a11y-tabs" aria-label={label}>
        {children}
      </div>
    </TabsContext.Provider>
  )
}

export function TabList({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div role="tablist" aria-label={label} className="a11y-tablist">
      {children}
    </div>
  )
}

export function Tab({ value, children }: { value: string; children: ReactNode }) {
  const ctx = useTabs()
  const selected = ctx.value === value
  return (
    <button
      role="tab"
      id={`${ctx.baseId}-tab-${value}`}
      aria-selected={selected}
      aria-controls={`${ctx.baseId}-panel-${value}`}
      tabIndex={selected ? 0 : -1}
      className="a11y-tab"
      onClick={() => ctx.setValue(value)}
      onKeyDown={activateOnKey(() => ctx.setValue(value))}
    >
      {children}
    </button>
  )
}

export function TabPanel({ value, children }: { value: string; children: ReactNode }) {
  const ctx = useTabs()
  if (ctx.value !== value) return null
  return (
    <div
      role="tabpanel"
      id={`${ctx.baseId}-panel-${value}`}
      aria-labelledby={`${ctx.baseId}-tab-${value}`}
      tabIndex={0}
    >
      {children}
    </div>
  )
}

function useTabs(): TabsCtx {
  const ctx = useContext(TabsContext)
  if (!ctx) throw new Error('Tab primitives must be used inside <Tabs>')
  return ctx
}

// --- Tree ---
export function Tree({ label, children }: { label: string; children: ReactNode }) {
  return (
    <ul role="tree" aria-label={label} className="a11y-tree">
      {children}
    </ul>
  )
}
export function TreeItem({
  children,
  expanded,
  selected,
  onActivate,
}: {
  children: ReactNode
  expanded?: boolean
  selected?: boolean
  onActivate?: () => void
}) {
  return (
    <li
      role="treeitem"
      aria-expanded={expanded}
      aria-selected={selected}
      tabIndex={selected ? 0 : -1}
      className="a11y-treeitem"
      onClick={onActivate}
      onKeyDown={onActivate ? activateOnKey(onActivate) : undefined}
    >
      {children}
    </li>
  )
}

// --- Dialog (focus-trapped, aria-modal) ---
export function Dialog({
  open,
  onClose,
  label,
  children,
}: {
  open: boolean
  onClose: () => void
  label: string
  children: ReactNode
}) {
  const ref = useRef<HTMLDivElement>(null)
  useFocusTrap(ref, open)
  if (!open) return null
  return (
    <div className="a11y-dialog-backdrop" onClick={onClose}>
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        className="a11y-dialog"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === 'Escape') onClose()
        }}
      >
        {children}
      </div>
    </div>
  )
}

// Small controlled Tabs wrapper for demos/tests.
export function UncontrolledTabs({ initial, label, children }: { initial: string; label: string; children: (v: string, set: (v: string) => void) => ReactNode }) {
  const [value, setValue] = useState(initial)
  return (
    <Tabs value={value} onValueChange={setValue} label={label}>
      {children(value, setValue)}
    </Tabs>
  )
}
