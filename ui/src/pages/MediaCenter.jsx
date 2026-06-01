import './StubPage.css';
import Card from '../design-system/components/Card';
import ProgressBar from '../design-system/components/ProgressBar';
import { useStore } from '../store/StoreContext';
import { useState } from 'react';

const TABS = ['MEDIA CENTER', 'PLAYLISTS', 'EQ PRESETS', 'RADIO', 'PODCASTS'];

const quickAccessApps = [
  { name: 'YouTube',      color: '#FF0000', label: 'YT' },
  { name: 'Twitch',       color: '#9146FF', label: '📺' },
  { name: 'Netflix',      color: '#E50914', label: 'N' },
  { name: 'Disney+',      color: '#006AC0', label: 'D+' },
  { name: 'Amazon',       color: '#00A8E0', label: 'A' },
  { name: 'VLC',          color: '#FF7800', label: '▶' },
  { name: 'MPV',          color: '#448AFF', label: 'M' },
  { name: 'OBS',          color: '#7B2FBE', label: 'OBS' },
  { name: 'Soundboard',   color: '#00E676', label: '♪' },
  { name: 'Voice Changer',color: '#FFAB40', label: '🎙' },
];

const mediaTools = [
  { name: 'Screenshot',   icon: '📷', color: '#448AFF' },
  { name: 'Screen Record',icon: '🔴', color: '#FF5252' },
  { name: 'Clip Manager', icon: '🎬', color: '#7B2FBE' },
  { name: 'Stream Deck',  icon: '🖥',  color: '#00B4D8' },
  { name: 'Video Editor', icon: '✂️', color: '#FFAB40' },
  { name: 'Audio Mixer',  icon: '🎚',  color: '#00E676' },
];

const upcomingEvents = [
  { date: 'MON', dateNum: '1',  title: 'Team Meeting',     time: '1:00 PM', color: '#448AFF' },
  { date: 'MON', dateNum: '1',  title: 'Live EA Calendar', time: '3:00 PM', color: '#7B2FBE' },
  { date: 'MON', dateNum: '1',  title: 'Stream Session',   time: '7:00 PM', color: '#00B4D8' },
];

const weatherForecast = [
  { day: 'Today', icon: '⛅', temp: '22°C' },
  { day: 'Fri',   icon: '🌧',  temp: '18°C' },
  { day: 'Sat',   icon: '☀️', temp: '25°C' },
  { day: 'Sun',   icon: '⛅', temp: '24°C' },
];

const recentlyPlayed = [
  { title: 'Starboy',          artist: 'The Weeknd',    color: '#FF2D55' },
  { title: 'Into the Spider-Verse', artist: 'Metro Boomin', color: '#7B2FBE' },
  { title: 'Save Your Tears',  artist: 'The Weeknd',    color: '#448AFF' },
  { title: 'Good 4 U',         artist: 'Olivia Rodrigo',color: '#00E676' },
  { title: 'Levitating',       artist: 'Dua Lipa',      color: '#FFAB40' },
];

function VolumeControl({ label, value: defaultValue, color }) {
  const [val, setVal] = useState(defaultValue);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 10, color: 'var(--color-text-muted)', fontFamily: 'var(--font-label)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</span>
        <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color, fontWeight: 600 }}>{val}%</span>
      </div>
      <input
        type="range" min={0} max={100} value={val}
        onChange={e => setVal(Number(e.target.value))}
        style={{ width: '100%', accentColor: color, cursor: 'pointer', height: 4 }}
      />
    </div>
  );
}

export default function MediaCenter() {
  const { getState, notifications } = useStore();
  const [activeTab, setActiveTab] = useState(0);

  const track    = getState('media.track');
  const artist   = getState('media.artist');
  const album    = getState('media.album');
  const playing  = getState('media.playing') === 'true';
  const position = getState('media.position');
  const duration = getState('media.duration');

  function toSec(t) {
    if (!t || t === '--') return 0;
    const parts = t.split(':').map(Number);
    return parts.length === 2 ? parts[0] * 60 + parts[1] : 0;
  }
  const pct = toSec(duration) > 0 ? (toSec(position) / toSec(duration)) * 100 : 0;

  return (
    <div className="stub-page" style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>

      {/* ── Main content area (fills space above mini media bar) ── */}
      <div style={{ flex: 1, minHeight: 0, display: 'flex', gap: 10, padding: '10px 12px 0 12px', overflow: 'hidden' }}>

        {/* ═══════════════════════════════════
            LEFT COLUMN  ~45% width
        ═══════════════════════════════════ */}
        <div style={{ width: '42%', display: 'flex', flexDirection: 'column', gap: 8, overflow: 'hidden' }}>

          {/* NOW PLAYING card */}
          <Card style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div className="stub-section-title">NOW PLAYING</div>

            {/* Album art + track info */}
            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              {/* Album art */}
              <div style={{
                width: 110, height: 110, borderRadius: 10, flexShrink: 0,
                background: 'linear-gradient(135deg, #1A0A38 0%, #0A0820 60%, #0D1A2A 100%)',
                border: '1px solid rgba(0,180,216,0.3)',
                boxShadow: '0 0 20px rgba(123,47,190,0.35), 0 0 40px rgba(0,180,216,0.12)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                position: 'relative', overflow: 'hidden',
              }}>
                {/* Glowing ring decoration */}
                <div style={{
                  position: 'absolute', inset: 0,
                  background: 'radial-gradient(ellipse at 30% 30%, rgba(123,47,190,0.25) 0%, transparent 70%)',
                }} />
                <svg width="44" height="44" viewBox="0 0 24 24" fill="none" style={{ position: 'relative' }}>
                  <path d="M9 18V5l12-2v13M9 18a3 3 0 01-3-3c0-1.657 1.343-3 3-3s3 1.343 3 3c0 1.657-1.343 3-3 3zm12-2a3 3 0 01-3-3c0-1.657 1.343-3 3-3s3 1.343 3 3c0 1.657-1.343 3-3 3z"
                    stroke="#00B4D8" strokeWidth="1.5" strokeLinecap="round"
                    style={{ filter: 'drop-shadow(0 0 6px #00B4D8)' }} />
                </svg>
              </div>

              {/* Track info */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0, flex: 1, paddingTop: 4 }}>
                <span style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700, color: 'var(--color-text-primary)', lineHeight: 1.1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{track}</span>
                <span style={{ fontFamily: 'var(--font-heading)', fontSize: 13, color: 'var(--color-text-secondary)' }}>{artist}</span>
                <span style={{ fontFamily: 'var(--font-body)', fontSize: 11, color: 'var(--color-text-muted)' }}>{album}</span>

                {/* Like + Volume inline */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                  <button title="Favourite" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#FF5252', fontSize: 16, padding: 0, lineHeight: 1 }}>♡</button>
                  <div style={{ flex: 1, height: 3, background: 'var(--gauge-track)', borderRadius: 99 }}>
                    <div style={{ width: '70%', height: '100%', background: '#7B2FBE', borderRadius: 99 }} />
                  </div>
                  <span style={{ fontSize: 10, color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)' }}>70</span>
                </div>
              </div>
            </div>

            {/* Waveform visualiser */}
            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', height: 36, gap: 2, padding: '0 2px' }}>
              {Array.from({ length: 28 }).map((_, i) => {
                const h = 6 + Math.abs(Math.sin(i * 0.75) * 20) + Math.abs(Math.sin(i * 0.31) * 10);
                return (
                  <span key={i} style={{
                    flex: 1, minWidth: 3,
                    height: playing ? `${h}px` : '4px',
                    background: i < 14 ? '#00B4D8' : 'rgba(0,180,216,0.35)',
                    borderRadius: '2px 2px 1px 1px',
                    transition: 'height 0.2s',
                    animation: playing ? `waveBar${i % 5} 0.${6 + (i % 4)}s ease-in-out ${(i % 7) * 0.08}s infinite alternate` : 'none',
                  }} />
                );
              })}
            </div>
            <style>{`
              @keyframes waveBar0 { from{height:4px;opacity:0.5} to{height:28px;opacity:1} }
              @keyframes waveBar1 { from{height:6px;opacity:0.5} to{height:22px;opacity:1} }
              @keyframes waveBar2 { from{height:8px;opacity:0.5} to{height:32px;opacity:1} }
              @keyframes waveBar3 { from{height:4px;opacity:0.4} to{height:18px;opacity:1} }
              @keyframes waveBar4 { from{height:10px;opacity:0.5} to{height:26px;opacity:1} }
            `}</style>

            {/* Progress bar */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--color-text-muted)', flexShrink: 0 }}>{position}</span>
              <div style={{ flex: 1, height: 4, background: 'var(--gauge-track)', borderRadius: 99, overflow: 'hidden', cursor: 'pointer' }}>
                <div style={{ width: `${pct}%`, height: '100%', background: 'linear-gradient(90deg, #7B2FBE, #00B4D8)', borderRadius: 99, transition: 'width 0.3s' }} />
              </div>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--color-text-muted)', flexShrink: 0 }}>{duration}</span>
            </div>

            {/* Controls */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              {[
                { icon: '⇄', title: 'Shuffle',    big: false },
                { icon: '⏮', title: 'Previous',   big: false },
                { icon: playing ? '⏸' : '▶', title: 'Play/Pause', big: true },
                { icon: '⏭', title: 'Next',       big: false },
                { icon: '↻', title: 'Repeat',     big: false },
              ].map(c => (
                <button key={c.title} title={c.title} style={{
                  width: c.big ? 44 : 32, height: c.big ? 44 : 32,
                  borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: c.big ? 'linear-gradient(135deg, #7B2FBE, #9B4FDE)' : 'rgba(255,255,255,0.06)',
                  color: '#fff', fontSize: c.big ? 16 : 13, cursor: 'pointer', border: 'none',
                  boxShadow: c.big ? '0 0 18px rgba(123,47,190,0.5)' : 'none',
                  transition: 'all 0.15s',
                }}>{c.icon}</button>
              ))}
            </div>
          </Card>

          {/* QUICK ACCESS 2×5 grid */}
          <Card style={{ flexShrink: 0 }}>
            <div className="stub-section-title">QUICK ACCESS</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 6, marginTop: 8 }}>
              {quickAccessApps.map(app => (
                <button key={app.name} style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                  padding: '7px 4px',
                  background: 'rgba(255,255,255,0.03)', border: '1px solid var(--color-border)',
                  borderRadius: 8, cursor: 'pointer', transition: 'all 0.15s',
                }}>
                  <span style={{ width: 26, height: 26, borderRadius: 7, background: app.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#fff' }}>{app.label}</span>
                  <span style={{ fontSize: 8, color: 'var(--color-text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%' }}>{app.name}</span>
                </button>
              ))}
            </div>
          </Card>

          {/* RECENTLY PLAYED */}
          <Card style={{ flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div className="stub-section-title">RECENTLY PLAYED</div>
              <span style={{ fontSize: 9, color: 'var(--color-text-muted)', fontStyle: 'italic', background: 'rgba(255,255,255,0.04)', padding: '2px 6px', borderRadius: 4, border: '1px solid var(--color-border)' }}>Coming in Phase 2</span>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 8, opacity: 0.45, pointerEvents: 'none' }}>
              {recentlyPlayed.map(item => (
                <div key={item.title} style={{
                  display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'center',
                  minWidth: 0, flex: 1,
                }}>
                  <div style={{
                    width: '100%', aspectRatio: '1', borderRadius: 6,
                    background: `linear-gradient(135deg, ${item.color}55, ${item.color}22)`,
                    border: `1px solid ${item.color}33`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <span style={{ fontSize: 16, opacity: 0.7 }}>♪</span>
                  </div>
                  <span style={{ fontSize: 8, color: 'var(--color-text-secondary)', textAlign: 'center', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', width: '100%' }}>{item.title}</span>
                  <span style={{ fontSize: 7, color: 'var(--color-text-muted)', textAlign: 'center', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', width: '100%' }}>{item.artist}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* ═══════════════════════════════════
            RIGHT COLUMN  ~58% width
        ═══════════════════════════════════ */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0, overflow: 'hidden' }}>

          {/* Top row: Audio Control + Notifications */}
          <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>

            {/* AUDIO CONTROL */}
            <Card style={{ flex: '0 0 45%' }}>
              <div className="stub-section-title">AUDIO CONTROL</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 10 }}>
                <VolumeControl label="System Volume" value={70} color="#7B2FBE" />
                <VolumeControl label="Spotify Volume" value={65} color="#1DB954" />
                <VolumeControl label="Mic Volume"     value={80} color="#00B4D8" />

                {/* Audio Output selector */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  <span style={{ fontSize: 10, color: 'var(--color-text-muted)', fontFamily: 'var(--font-label)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Audio Output</span>
                  <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '6px 10px', background: 'rgba(255,255,255,0.04)',
                    border: '1px solid var(--color-border)', borderRadius: 6, cursor: 'pointer',
                  }}>
                    <span style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>Default Speakers</span>
                    <span style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>▼</span>
                  </div>
                </div>
              </div>
            </Card>

            {/* NOTIFICATIONS */}
            <Card style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div className="stub-section-title" style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <span>🔔</span> NOTIFICATIONS
                </div>
                <span style={{ fontSize: 9, color: 'var(--color-accent-secondary)', cursor: 'pointer' }}>View All →</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginTop: 10 }}>
                {notifications.slice(0, 4).map(n => (
                  <div key={n.id} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', minWidth: 0 }}>
                    <div style={{
                      width: 22, height: 22, borderRadius: '50%',
                      background: `${n.sourceColor}22`,
                      border: `1px solid ${n.sourceColor}55`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      flexShrink: 0,
                    }}>
                      <div style={{ width: 6, height: 6, borderRadius: '50%', background: n.sourceColor }} />
                    </div>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{n.source}</div>
                      <div style={{ fontSize: 10, color: 'var(--color-text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{n.title}</div>
                    </div>
                    <span style={{ fontSize: 9, color: 'var(--color-text-muted)', flexShrink: 0 }}>{n.time}</span>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          {/* Middle row: Media Tools + Upcoming Events */}
          <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>

            {/* MEDIA TOOLS */}
            <Card style={{ flex: '0 0 48%' }}>
              <div className="stub-section-title">MEDIA TOOLS</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, marginTop: 8 }}>
                {mediaTools.map(t => (
                  <button key={t.name} className="stub-action-tile" style={{ '--tile-color': t.color }}>
                    <span style={{ fontSize: 18 }}>{t.icon}</span>
                    <span style={{ fontSize: 9, color: 'var(--color-text-muted)', textAlign: 'center' }}>{t.name}</span>
                  </button>
                ))}
              </div>
            </Card>

            {/* UPCOMING EVENTS */}
            <Card style={{ flex: 1, minWidth: 0 }}>
              <div className="stub-section-title">UPCOMING EVENTS</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
                {upcomingEvents.map((ev, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', background: 'rgba(255,255,255,0.02)', borderRadius: 6, border: '1px solid var(--color-border)' }}>
                    <div style={{
                      display: 'flex', flexDirection: 'column', alignItems: 'center',
                      padding: '4px 7px', background: `${ev.color}22`,
                      border: `1px solid ${ev.color}44`, borderRadius: 6, flexShrink: 0,
                    }}>
                      <span style={{ fontSize: 9, color: ev.color, fontFamily: 'var(--font-label)', fontWeight: 600 }}>{ev.date}</span>
                      <span style={{ fontSize: 13, color: ev.color, fontFamily: 'var(--font-mono)', fontWeight: 700, lineHeight: 1 }}>{ev.dateNum}</span>
                    </div>
                    <span style={{ flex: 1, fontSize: 11, color: 'var(--color-text-secondary)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ev.title}</span>
                    <span style={{ fontSize: 10, color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)', flexShrink: 0 }}>{ev.time}</span>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          {/* Bottom row: Weather */}
          <Card style={{ flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
              {/* Current weather */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 700, color: 'var(--color-text-primary)', lineHeight: 1 }}>22°C</span>
                  <span style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>Partly Cloudy</span>
                </div>
                <span style={{ fontSize: 28 }}>⛅</span>
              </div>

              {/* Divider */}
              <div style={{ width: 1, height: 36, background: 'var(--color-border)' }} />

              {/* 4-day forecast */}
              <div style={{ display: 'flex', gap: 12, flex: 1 }}>
                {weatherForecast.map((d, i) => (
                  <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, flex: 1 }}>
                    <span style={{ fontSize: 9, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{d.day}</span>
                    <span style={{ fontSize: 16 }}>{d.icon}</span>
                    <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: i === 0 ? 'var(--color-accent-secondary)' : 'var(--color-text-secondary)', fontWeight: 600 }}>{d.temp}</span>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* ── Bottom Tab Bar ── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 0,
        borderTop: '1px solid var(--color-border)',
        background: 'rgba(13,13,26,0.9)',
        padding: '0 12px',
        flexShrink: 0,
        height: 36,
      }}>
        {TABS.map((tab, i) => (
          <button key={tab} onClick={() => setActiveTab(i)} style={{
            padding: '0 16px', height: '100%',
            background: 'none', border: 'none', cursor: 'pointer',
            fontFamily: 'var(--font-label)', fontSize: 11, fontWeight: 600,
            letterSpacing: '0.08em',
            color: activeTab === i ? 'var(--color-accent-secondary)' : 'var(--color-text-muted)',
            borderBottom: activeTab === i ? '2px solid var(--color-accent-secondary)' : '2px solid transparent',
            transition: 'all 0.15s',
          }}>{tab}</button>
        ))}
      </div>
    </div>
  );
}
