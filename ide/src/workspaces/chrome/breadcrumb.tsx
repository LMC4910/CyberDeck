// Breadcrumb (CD-205): Project › Workspace › Selection, rendered from the
// per-workspace segment registry. Clickable segments navigate. Pure subscriber —
// it renders whatever `activeWorkspace` + `context` say and calls `onNavigate`;
// it never imperatively syncs the shell.
import { crumbFor, type CrumbContext } from './breadcrumb-segments'
import './chrome.css'

export interface BreadcrumbProps {
  activeWorkspace: string | null
  context: CrumbContext
  onNavigate: (workspaceId: string) => void
}

export function Breadcrumb({ activeWorkspace, context, onNavigate }: BreadcrumbProps) {
  const segments = crumbFor(activeWorkspace, context)
  return (
    <nav aria-label="Breadcrumb" className="crumb">
      <ol className="crumb-list">
        {segments.map((seg, i) => {
          const last = i === segments.length - 1
          return (
            <li key={`${seg.label}-${i}`} className="crumb-item">
              {seg.navigate && !last ? (
                <button
                  type="button"
                  className="crumb-link"
                  data-crumb={seg.navigate}
                  onClick={() => onNavigate(seg.navigate!)}
                >
                  {seg.label}
                </button>
              ) : (
                <span className="crumb-current" aria-current={last ? 'page' : undefined}>
                  {seg.label}
                </span>
              )}
              {!last && <span className="crumb-sep" aria-hidden="true">›</span>}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
