import { useState } from 'react';
import './NotificationCenter.css';
import { useStore } from '../store/StoreContext';

const FILTERS = ['All', 'System', 'Apps', 'Alerts', 'Messages'];

const PRIORITY_COLORS = {
  critical: '#FF5252',
  warning: '#FFAB40',
  high: '#448AFF',
  medium: '#448AFF',
  low: '#2D2D5E',
};

function getSourceInitial(source) {
  if (source === 'Discord') return 'D';
  if (source === 'Spotify') return '♪';
  if (source === 'System Update') return 'SU';
  if (source === 'Security Alert') return '!';
  if (source === 'Hardware Monitor') return 'HW';
  if (source === 'Streamlabs') return 'SL';
  return source.charAt(0);
}

export default function NotificationCenter({ onClose }) {
  const { notifications, getState } = useStore();
  const [filter, setFilter] = useState('All');
  const notifyCount = getState('notify.count');

  const filtered = filter === 'All'
    ? notifications
    : notifications.filter(n => {
        if (filter === 'Alerts') return n.priority === 'critical' || n.priority === 'warning';
        if (filter === 'System') return n.source === 'System Update' || n.source === 'Hardware Monitor';
        if (filter === 'Apps') return ['Discord', 'Spotify', 'Streamlabs'].includes(n.source);
        if (filter === 'Messages') return n.source === 'Discord';
        return true;
      });

  return (
    <div className="notif-overlay">
      <div className="notif-panel">

        {/* ── Header ── */}
        <div className="notif-header">
          <span className="notif-header__bell">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
              <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </span>
          <span className="notif-header__title">NOTIFICATIONS</span>
          <span className="notif-header__badge">{notifyCount}</span>
          <button className="notif-header__mark-read">Mark all as read ✓</button>
          <button className="notif-header__close" onClick={onClose}>✕</button>
        </div>

        {/* ── Filter Tabs ── */}
        <div className="notif-filter-tabs">
          {FILTERS.map(f => (
            <button
              key={f}
              className={`notif-filter-tab ${filter === f ? 'notif-filter-tab--active' : ''}`}
              onClick={() => setFilter(f)}
            >
              {f}
            </button>
          ))}
        </div>

        {/* ── Scrollable Feed ── */}
        <div className="notif-feed">
          {filtered.length === 0 ? (
            <div className="notif-empty">
              <span className="notif-empty__icon">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none">
                  <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </span>
              No {filter.toLowerCase()} notifications
            </div>
          ) : (
            filtered.map(n => {
              const borderColor = PRIORITY_COLORS[n.priority] || PRIORITY_COLORS.low;
              return (
                <div
                  key={n.id}
                  className="notif-card"
                  style={{ borderLeftColor: borderColor }}
                >
                  <div className="notif-card__top">
                    <div
                      className="notif-card__source-icon"
                      style={{ background: `${n.sourceColor}22`, color: n.sourceColor }}
                    >
                      {getSourceInitial(n.source)}
                    </div>
                    <div className="notif-card__meta">
                      <span className="notif-card__source">{n.source}</span>
                      <span className="notif-card__time">{n.time}</span>
                    </div>
                  </div>

                  <div className="notif-card__title">{n.title}</div>
                  {n.body && (
                    <div className="notif-card__body">{n.body}</div>
                  )}

                  <div className="notif-card__footer">
                    <span className="notif-card__view-link">View All</span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* ── Footer ── */}
        <div className="notif-footer">
          <button className="notif-footer__history-btn">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5"/>
              <path d="M12 7v5l3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            View Notification History
          </button>
        </div>
      </div>
    </div>
  );
}
