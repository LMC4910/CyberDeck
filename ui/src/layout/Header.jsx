import { useState, useEffect } from 'react';
import './Header.css';

function pad(n) { return String(n).padStart(2, '0'); }

function formatClock() {
  const now = new Date();
  let h = now.getHours();
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  const m = pad(now.getMinutes());
  const s = pad(now.getSeconds());
  const days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const day = days[now.getDay()];
  const date = now.getDate();
  const month = months[now.getMonth()];
  const year = now.getFullYear();
  return {
    time: `${h}:${m}:${s} ${ampm}`,
    date: `${day}, ${month} ${date}, ${year}`,
  };
}

export default function Header({ title, subtitle, notifyCount, onNotificationClick }) {
  const [clock, setClock] = useState(formatClock());

  useEffect(() => {
    const id = setInterval(() => setClock(formatClock()), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <header className="cd-header">
      <div className="cd-header__left">
        <span className="cd-header__logo-box">C</span>
        <span className="cd-header__wordmark">CYBERDECK</span>
        <span className="cd-header__sep">|</span>
        <div className="cd-header__page-info">
          <span className="cd-header__title">{title}</span>
          {subtitle && <span className="cd-header__subtitle">{subtitle}</span>}
        </div>
      </div>
      <div className="cd-header__right">
        <div className="cd-header__clock">
          <span className="cd-header__time">{clock.time}</span>
          <span className="cd-header__date">{clock.date}</span>
        </div>
        <button className="cd-header__notif-btn" title="Notifications" onClick={onNotificationClick}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          {notifyCount && notifyCount !== '--' && parseInt(notifyCount) > 0 && (
            <span className="cd-header__notif-badge">{notifyCount}</span>
          )}
        </button>
        <button className="cd-header__settings-btn" title="Settings">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.5"/>
            <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" stroke="currentColor" strokeWidth="1.5"/>
          </svg>
        </button>
      </div>
    </header>
  );
}
