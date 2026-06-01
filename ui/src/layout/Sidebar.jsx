import './Sidebar.css';
import Badge from '../design-system/components/Badge';

const navItems = [
  {
    id: 'dashboard',
    label: 'DASH',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
        <path d="M3 12l9-9 9 9M5 10v9a1 1 0 001 1h4v-5h4v5h4a1 1 0 001-1v-9" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
  {
    id: 'media',
    label: 'MEDIA',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
        <path d="M9 18V5l12-2v13M9 18a3 3 0 01-3-3c0-1.657 1.343-3 3-3s3 1.343 3 3c0 1.657-1.343 3-3 3zm12-2a3 3 0 01-3-3c0-1.657 1.343-3 3-3s3 1.343 3 3c0 1.657-1.343 3-3 3z" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    id: 'system',
    label: 'SYSTEM',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
        <rect x="4" y="4" width="16" height="16" rx="2" fill="none" stroke="currentColor" strokeWidth="1.5"/>
        <rect x="8" y="8" width="8" height="8" fill="none" stroke="currentColor" strokeWidth="1.5"/>
        <path d="M9 4V2M12 4V2M15 4V2M9 22v-2M12 22v-2M15 22v-2M4 9H2M4 12H2M4 15H2M22 9h-2M22 12h-2M22 15h-2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    id: 'gaming',
    label: 'GAMING',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
        <path d="M6 11h4M8 9v4M15 11h.01M18 11h.01" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        <path d="M2 11c0-3.5 2-5 6-5h8c4 0 6 1.5 6 5v2c0 3.5-2 5-6 5H8c-4 0-6-1.5-6-5v-2z" fill="none" stroke="currentColor" strokeWidth="1.5"/>
      </svg>
    ),
  },
  {
    id: 'smarthome',
    label: 'HOME',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
        <path d="M3 12l9-9 9 9M5 10v9a1 1 0 001 1h4v-5h4v5h4a1 1 0 001-1v-9" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M12 20c4-3 6-5 6-8" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    id: 'overview',
    label: 'STATS',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
        <path d="M3 20l4-8 4 4 4-6 4 4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M3 4v16M3 20h18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    id: 'settings',
    label: 'CONFIG',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" strokeWidth="1.5"/>
        <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" fill="none" stroke="currentColor" strokeWidth="1.5"/>
      </svg>
    ),
  },
];

const powerIcon = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
    <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="1.5"/>
    <path d="M12 7v5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
);

export default function Sidebar({ activePage, onNavigate, notifyCount }) {
  return (
    <nav className="cd-sidebar">
      {/* Logo */}
      <div className="cd-sidebar__logo">
        <span className="cd-sidebar__logo-icon">C</span>
      </div>

      {/* Nav items */}
      <div className="cd-sidebar__nav">
        {navItems.map(item => (
          <button
            key={item.id}
            className={`cd-sidebar__item ${activePage === item.id ? 'cd-sidebar__item--active' : ''}`}
            onClick={() => onNavigate(item.id)}
          >
            <span className="cd-sidebar__item-icon">
              {item.icon}
              {item.id === 'dashboard' && notifyCount && notifyCount !== '0' && (
                <span className="cd-sidebar__badge">
                  <Badge count={notifyCount} variant="critical" />
                </span>
              )}
            </span>
            <span className="cd-sidebar__item-label">{item.label}</span>
          </button>
        ))}
      </div>

      {/* Divider + Power */}
      <div className="cd-sidebar__bottom">
        <div className="cd-sidebar__divider" />
        <button className="cd-sidebar__item cd-sidebar__item--power">
          <span className="cd-sidebar__item-icon">{powerIcon}</span>
          <span className="cd-sidebar__item-label">POWER</span>
        </button>
      </div>
    </nav>
  );
}
