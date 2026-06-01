import { useState } from 'react';
import './StubPage.css';
import Card from '../design-system/components/Card';
import StatusDot from '../design-system/components/StatusDot';
import Sparkline from '../design-system/components/Sparkline';
import { useStore } from '../store/StoreContext';

const powerActions = [
  { label: 'Restart PC',    icon: '↺',  color: '#448AFF' },
  { label: 'Shut Down',     icon: '⏻',  color: '#FF5252' },
  { label: 'Sleep',         icon: '☽',  color: '#7B2FBE' },
  { label: 'Hibernate',     icon: '❄',  color: '#00B4D8' },
  { label: 'Lock PC',       icon: '🔒', color: '#FFAB40' },
  { label: 'Log Off',       icon: '↩',  color: '#00E676' },
  { label: 'Kill Process',  icon: '✕',  color: '#FF5252' },
  { label: 'Task Manager',  icon: '≡',  color: '#448AFF' },
  { label: 'Clear Cache',   icon: '🗑', color: '#7B2FBE' },
  { label: 'Disk Cleanup',  icon: '💾', color: '#00B4D8' },
  { label: 'Empty Recycle', icon: '♻', color: '#00E676' },
  { label: 'System Info',   icon: 'ℹ', color: '#FFAB40' },
];

const perfModes = [
  { id: 'silent',      label: 'Silent Mode',      desc: 'Minimal power usage. Keeps fan noise low.',    color: '#448AFF', active: false },
  { id: 'balanced',    label: 'Balanced Mode',     desc: 'Balanced between performance and power usage.', color: '#7B2FBE', active: true  },
  { id: 'performance', label: 'Performance Mode',  desc: 'Maximum performance, higher power draw.',       color: '#FFAB40', active: false },
  { id: 'turbo',       label: 'Turbo Mode',        desc: 'Extreme performance for demanding workloads.',  color: '#FF5252', active: false },
];

const shortcuts = [
  { label: 'Control Panel',       icon: '⚙' },
  { label: 'Device Manager',      icon: '🖥' },
  { label: 'Windows Update',      icon: '🔄' },
  { label: 'Services',            icon: '⚡' },
  { label: 'Startup Apps',        icon: '▶' },
  { label: 'Programs & Features', icon: '📦' },
  { label: 'Registry Editor',     icon: '🗂' },
  { label: 'Event Viewer',        icon: '📋' },
];

const TABS = ['OVERVIEW', 'SYSTEM CONTROL', 'MONITORING', 'TOOLS'];

const defaultFans = [
  { id: 'cpu',   label: 'CPU Fan',    value: 75, auto: false },
  { id: 'gpu',   label: 'GPU Fan',    value: 60, auto: true  },
  { id: 'case1', label: 'Case Fan 1', value: 50, auto: true  },
  { id: 'case2', label: 'Case Fan 2', value: 45, auto: false },
];

export default function SystemControl() {
  const { storageDisks, getState, sparklineData } = useStore();
  const [activeTab, setActiveTab] = useState('SYSTEM CONTROL');
  const [activePerfMode, setActivePerfMode] = useState('balanced');
  const [fans, setFans] = useState(defaultFans);

  function setFanValue(id, val) {
    setFans(prev => prev.map(f => f.id === id ? { ...f, value: Number(val) } : f));
  }
  function toggleFanAuto(id) {
    setFans(prev => prev.map(f => f.id === id ? { ...f, auto: !f.auto } : f));
  }

  return (
    <div className="stub-page" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Main content */}
      <div style={{ flex: 1, padding: '12px 12px 0 12px', display: 'flex', gap: 10, minHeight: 0, overflow: 'auto' }}>

        {/* ── Left column ─────────────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: 340, flexShrink: 0 }}>

          {/* System Control tiles */}
          <Card>
            <div className="stub-section-title">SYSTEM CONTROL</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6, marginTop: 10 }}>
              {powerActions.map(a => (
                <button
                  key={a.label}
                  className="stub-action-tile"
                  style={{ '--tile-color': a.color }}
                  title={a.label}
                >
                  <span style={{ fontSize: 18, lineHeight: 1 }}>{a.icon}</span>
                  <span style={{ fontSize: 9, color: 'var(--color-text-secondary)', textAlign: 'center', lineHeight: 1.2 }}>
                    {a.label}
                  </span>
                </button>
              ))}
            </div>
          </Card>

          {/* Storage Drives */}
          <Card>
            <div className="stub-section-title">STORAGE DRIVES</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 10 }}>
              {storageDisks.map(d => {
                const pct = Math.round((d.used / d.total) * 100);
                return (
                  <div key={d.label}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 13 }}>💽</span>
                        <span style={{ fontSize: 11, color: 'var(--color-text-secondary)', fontFamily: 'var(--font-mono)' }}>{d.label}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 10, color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)' }}>
                          {d.used} / {d.total} GB
                        </span>
                        <span style={{
                          fontSize: 9, fontWeight: 700, color: d.color,
                          background: `${d.color}1A`, padding: '1px 5px',
                          borderRadius: 4, border: `1px solid ${d.color}44`,
                        }}>
                          {pct}%
                        </span>
                      </div>
                    </div>
                    {/* Colored progress bar using inline SVG to respect d.color */}
                    <div style={{ height: 6, borderRadius: 3, background: 'var(--color-bg-elevated)', overflow: 'hidden' }}>
                      <div style={{
                        height: '100%', width: `${pct}%`,
                        background: `linear-gradient(90deg, ${d.color}BB, ${d.color})`,
                        borderRadius: 3,
                        boxShadow: `0 0 6px ${d.color}66`,
                        transition: 'width 0.3s',
                      }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>

        {/* ── Center column ────────────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, flex: 1, minWidth: 0 }}>

          {/* Performance Modes */}
          <Card>
            <div className="stub-section-title">PERFORMANCE MODES</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
              {perfModes.map(m => {
                const isActive = activePerfMode === m.id;
                return (
                  <div
                    key={m.id}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '9px 12px', borderRadius: 8,
                      background: isActive ? `${m.color}14` : 'rgba(255,255,255,0.02)',
                      border: `1px solid ${isActive ? m.color + '55' : 'var(--color-border)'}`,
                      transition: 'all 0.2s',
                    }}
                  >
                    {/* Colored circle */}
                    <div style={{
                      width: 12, height: 12, borderRadius: '50%', background: m.color,
                      boxShadow: isActive ? `0 0 8px ${m.color}` : 'none', flexShrink: 0,
                    }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: isActive ? 'var(--color-text-primary)' : 'var(--color-text-secondary)' }}>
                        {m.label}
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--color-text-muted)', marginTop: 1 }}>{m.desc}</div>
                    </div>
                    {isActive ? (
                      <span style={{
                        fontSize: 9, fontWeight: 700, color: m.color,
                        background: `${m.color}22`, padding: '3px 8px',
                        borderRadius: 4, border: `1px solid ${m.color}55`,
                        letterSpacing: '0.06em', flexShrink: 0,
                      }}>
                        ACTIVE
                      </span>
                    ) : (
                      <button
                        onClick={() => setActivePerfMode(m.id)}
                        style={{
                          fontSize: 9, fontWeight: 600, color: 'var(--color-text-muted)',
                          background: 'rgba(255,255,255,0.05)', padding: '3px 8px',
                          borderRadius: 4, border: '1px solid var(--color-border)',
                          cursor: 'pointer', letterSpacing: '0.06em', flexShrink: 0,
                          transition: 'all 0.15s',
                        }}
                        onMouseEnter={e => { e.currentTarget.style.color = m.color; e.currentTarget.style.borderColor = m.color + '66'; }}
                        onMouseLeave={e => { e.currentTarget.style.color = 'var(--color-text-muted)'; e.currentTarget.style.borderColor = 'var(--color-border)'; }}
                      >
                        ACTIVATE
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </Card>

          {/* System Information */}
          <Card style={{ flex: 1 }}>
            <div className="stub-section-title">SYSTEM INFORMATION</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 16px', marginTop: 10 }}>
              {[
                ['Operating System', getState('system.os')],
                ['Processor',        getState('system.cpu.model')],
                ['Motherboard',      getState('system.motherboard')],
                ['RAM',              getState('system.ram.spec')],
                ['GPU',              getState('system.gpu.model')],
                ['Driver',           getState('system.gpu.driver')],
                ['System Type',      getState('system.type')],
                ['Windows Version',  '10.0.26200'],
              ].map(([k, v]) => (
                <div key={k}>
                  <div style={{ fontSize: 9, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>
                    {k}
                  </div>
                  <div style={{
                    fontSize: 11, color: 'var(--color-text-secondary)',
                    fontFamily: 'var(--font-mono)',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {v}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* ── Right column ─────────────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: 220, flexShrink: 0 }}>

          {/* Quick Shortcuts */}
          <Card>
            <div className="stub-section-title">QUICK SHORTCUTS</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginTop: 8 }}>
              {shortcuts.map(s => (
                <button key={s.label} className="stub-shortcut-row" style={{ gap: 8 }}>
                  <span style={{ fontSize: 11 }}>{s.icon}</span>
                  <span style={{ fontSize: 11, flex: 1, textAlign: 'left' }}>{s.label}</span>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
                    <path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
              ))}
            </div>
          </Card>

          {/* Fan Control */}
          <Card>
            <div className="stub-section-title">FAN CONTROL</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 10 }}>
              {fans.map(fan => (
                <div key={fan.id}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <span style={{ fontSize: 10, color: 'var(--color-text-secondary)' }}>{fan.label}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: '#7B2FBE', fontWeight: 600 }}>
                        {fan.auto ? 'AUTO' : `${fan.value}%`}
                      </span>
                      {/* Auto toggle */}
                      <button
                        onClick={() => toggleFanAuto(fan.id)}
                        style={{
                          fontSize: 8, padding: '1px 5px', borderRadius: 3,
                          background: fan.auto ? '#7B2FBE33' : 'rgba(255,255,255,0.05)',
                          border: `1px solid ${fan.auto ? '#7B2FBE66' : 'var(--color-border)'}`,
                          color: fan.auto ? '#7B2FBE' : 'var(--color-text-muted)',
                          cursor: 'pointer', fontWeight: 600, letterSpacing: '0.04em',
                        }}
                      >
                        AUTO
                      </button>
                    </div>
                  </div>
                  <input
                    type="range"
                    min={0} max={100}
                    value={fan.value}
                    disabled={fan.auto}
                    onChange={e => setFanValue(fan.id, e.target.value)}
                    style={{
                      width: '100%', height: 4, borderRadius: 2,
                      accentColor: '#7B2FBE',
                      cursor: fan.auto ? 'not-allowed' : 'pointer',
                      opacity: fan.auto ? 0.5 : 1,
                    }}
                  />
                </div>
              ))}
            </div>
          </Card>

          {/* Network */}
          <Card>
            <div className="stub-section-title">NETWORK</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 10 }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 2 }}>
                  <span style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>Download</span>
                  <span style={{ fontSize: 14, fontFamily: 'var(--font-mono)', color: '#00B4D8', fontWeight: 700 }}>
                    {getState('system.network.download')} <span style={{ fontSize: 9 }}>Mbps</span>
                  </span>
                </div>
                <Sparkline data={sparklineData.networkDown} width={196} height={28} color="#00B4D8" />
              </div>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 2 }}>
                  <span style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>Upload</span>
                  <span style={{ fontSize: 14, fontFamily: 'var(--font-mono)', color: '#7B2FBE', fontWeight: 700 }}>
                    {getState('system.network.upload')} <span style={{ fontSize: 9 }}>Mbps</span>
                  </span>
                </div>
                <Sparkline data={sparklineData.networkUp} width={196} height={28} color="#7B2FBE" />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>Ping</span>
                <span style={{ fontSize: 13, fontFamily: 'var(--font-mono)', color: 'var(--color-text-primary)', fontWeight: 600 }}>
                  {getState('system.network.ping')} ms
                </span>
              </div>
            </div>
          </Card>

          {/* System Uptime */}
          <Card>
            <div className="stub-section-title">SYSTEM UPTIME</div>
            <div style={{ marginTop: 8, textAlign: 'center', padding: '4px 0 6px' }}>
              <div style={{ fontSize: 22, fontFamily: 'var(--font-mono)', color: 'var(--color-accent-secondary)', fontWeight: 700, letterSpacing: '0.04em' }}>
                {getState('system.uptime')}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 6 }}>
                <StatusDot status="success" size={8} pulse />
                <span style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>System running</span>
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* ── Bottom tab bar ─────────────────────────────── */}
      <div style={{
        height: 40, flexShrink: 0,
        background: 'var(--color-bg-elevated)',
        borderTop: '1px solid var(--color-border)',
        display: 'flex', alignItems: 'stretch',
        margin: '10px 0 0',
        paddingLeft: 4,
      }}>
        {TABS.map(tab => {
          const isActive = tab === activeTab;
          return (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                padding: '0 20px', background: 'transparent', border: 'none',
                borderBottom: isActive ? '2px solid #7B2FBE' : '2px solid transparent',
                color: isActive ? '#7B2FBE' : 'var(--color-text-muted)',
                fontSize: 11, fontFamily: 'var(--font-heading)', fontWeight: 600,
                letterSpacing: '0.08em', cursor: 'pointer',
                transition: 'color 0.15s, border-color 0.15s',
              }}
              onMouseEnter={e => { if (!isActive) e.currentTarget.style.color = 'var(--color-text-secondary)'; }}
              onMouseLeave={e => { if (!isActive) e.currentTarget.style.color = 'var(--color-text-muted)'; }}
            >
              {tab}
            </button>
          );
        })}
      </div>
    </div>
  );
}
