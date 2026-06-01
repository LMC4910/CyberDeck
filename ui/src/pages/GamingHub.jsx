import './StubPage.css';
import Card from '../design-system/components/Card';
import ProgressBar from '../design-system/components/ProgressBar';
import CircularGauge from '../design-system/components/CircularGauge';
import Sparkline from '../design-system/components/Sparkline';
import StatusDot from '../design-system/components/StatusDot';
import Toggle from '../design-system/components/Toggle';
import { useStore } from '../store/StoreContext';
import { useState } from 'react';

const TABS = ['OVERVIEW', 'GAMING HUB', 'MONITORING', 'MACROS', 'PROFILES'];

const launchers = [
  { name: 'Steam',      color: '#1B6FAD', label: 'S', status: 'success',  version: 'v2.0.14' },
  { name: 'Epic',       color: '#313131', label: 'E', status: 'success',  version: 'v14.2.0' },
  { name: 'Battle.net', color: '#00AEFF', label: 'B', status: 'offline',  version: 'Offline' },
  { name: 'Xbox',       color: '#107C10', label: 'X', status: 'success',  version: 'v2309.2' },
  { name: 'GOG',        color: '#5C2D91', label: 'G', status: 'offline',  version: 'Offline' },
];

const optimizations = [
  { label: 'Performance (Max FPS)', icon: '⚡', color: '#7B2FBE', enabled: true  },
  { label: 'Network Boost',         icon: '📶', color: '#00B4D8', enabled: true  },
  { label: 'RAM Cleaner',           icon: '🧹', color: '#00E676', enabled: false },
  { label: 'Temperature Control',   icon: '🌡', color: '#FFAB40', enabled: true  },
  { label: 'FPS Limiter',           icon: '🎯', color: '#FF5252', enabled: false },
];

const quickActions = [
  { label: 'Screenshot',    icon: '📷' },
  { label: 'Record Clip',   icon: '🎬' },
  { label: 'Instant Replay',icon: '⏮' },
  { label: 'Toggle HUD',    icon: '🖥'  },
  { label: 'Game Mode',     icon: '🎮' },
  { label: 'Focus Assist',  icon: '🎯' },
  { label: 'Do Not Disturb',icon: '🔕' },
  { label: 'Mic Mute',      icon: '🎙' },
];

const gameProfiles = [
  { id: 'competitive', label: 'Competitive',  desc: 'Max FPS, low latency', color: '#FF5252', active: true  },
  { id: 'aaa',         label: 'AAA Gaming',   desc: 'Balanced quality',     color: '#7B2FBE', active: false },
  { id: 'streaming',   label: 'Streaming',    desc: 'Stream optimized',     color: '#00B4D8', active: false },
  { id: 'battery',     label: 'Battery Saver',desc: 'Power efficient',      color: '#00E676', active: false },
];

const achievements = [
  { label: 'Master Gamer',   icon: '🏆', rarity: 'Legendary', color: '#FFD700' },
  { label: 'Speed Runner',   icon: '⚡', rarity: 'Rare',      color: '#448AFF' },
  { label: 'Survivor',       icon: '🛡',  rarity: 'Common',    color: '#00E676' },
];

export default function GamingHub() {
  const { getState, sparklineData, games } = useStore();
  const [activeTab, setActiveTab]     = useState(1);
  const [opts, setOpts]               = useState(optimizations.map(o => o.enabled));
  const [activeProfile, setProfile]   = useState('competitive');

  const fps         = getState('gaming.fps');
  const currentGame = getState('gaming.currentgame');
  const ping        = getState('gaming.network.ping');
  const dl          = getState('gaming.network.download');
  const ul          = getState('gaming.network.upload');
  const uptime      = getState('system.uptime');

  const cpuLoad  = getState('system.cpu.load');
  const gpuLoad  = getState('system.gpu.load');
  const ramPct   = getState('system.ram.percent');
  const vramUsed = parseFloat(getState('system.gpu.vram.used'));
  const vramTotal= parseFloat(getState('system.gpu.vram.total'));
  const vramPct  = vramTotal > 0 ? ((vramUsed / vramTotal) * 100).toFixed(0) : '0';

  const pingNum = parseFloat(ping);

  return (
    <div className="stub-page" style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>

      {/* ── Main content ── */}
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 8, padding: '10px 12px 0 12px', overflow: 'hidden' }}>

        {/* ═══════════════════════════════════
            FAVOURITE GAMES ROW (full width)
        ═══════════════════════════════════ */}
        <Card style={{ flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div className="stub-section-title">FAVOURITE GAMES</div>
            <span style={{ fontSize: 9, color: 'var(--color-text-muted)' }}>Scroll for more →</span>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 8, overflowX: 'auto', paddingBottom: 4 }}>
            {games.map(g => (
              <div key={g.id} className="game-cover" style={{ width: 148, height: 100, background: g.coverBg, flexShrink: 0 }}>
                <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 5, padding: '8px 6px' }}>
                  <span style={{ fontSize: 26 }}>{g.emoji}</span>
                  <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.9)', textAlign: 'center', fontFamily: 'var(--font-heading)', fontWeight: 600, lineHeight: 1.2, maxWidth: '100%' }}>{g.name}</span>
                </div>
                <div className="game-cover__overlay">
                  <button style={{ padding: '5px 12px', background: 'rgba(123,47,190,0.9)', border: 'none', borderRadius: 6, color: '#fff', fontSize: 11, cursor: 'pointer', fontWeight: 600, boxShadow: '0 0 12px rgba(123,47,190,0.6)' }}>▶ Play</button>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* ═══════════════════════════════════
            3-COLUMN SECTION
        ═══════════════════════════════════ */}
        <div style={{ display: 'flex', gap: 8, flex: 1, minHeight: 0, overflow: 'hidden' }}>

          {/* ── LEFT COLUMN ── */}
          <div style={{ width: '30%', display: 'flex', flexDirection: 'column', gap: 8, overflow: 'hidden' }}>

            {/* GAME LAUNCHER */}
            <Card style={{ flexShrink: 0 }}>
              <div className="stub-section-title">GAME LAUNCHER</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
                {launchers.map(l => (
                  <div key={l.name} style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '6px 8px',
                    background: 'rgba(255,255,255,0.03)',
                    borderRadius: 7, border: '1px solid var(--color-border)',
                  }}>
                    <div style={{ width: 26, height: 26, borderRadius: 6, background: l.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#fff', flexShrink: 0 }}>{l.label}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', fontWeight: 600 }}>{l.name}</div>
                      <div style={{ fontSize: 9, color: 'var(--color-text-muted)' }}>{l.version}</div>
                    </div>
                    <StatusDot status={l.status} size={7} pulse={l.status === 'success'} />
                    <button style={{ background: 'none', border: '1px solid var(--color-border)', borderRadius: 4, padding: '2px 6px', color: 'var(--color-text-muted)', fontSize: 10, cursor: 'pointer' }}>→</button>
                  </div>
                ))}
              </div>
            </Card>

            {/* GAME OPTIMIZATION */}
            <Card style={{ flex: 1 }}>
              <div className="stub-section-title">GAME OPTIMIZATION</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 9, marginTop: 8 }}>
                {optimizations.map((o, i) => (
                  <div key={o.label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 13 }}>{o.icon}</span>
                    <span style={{ flex: 1, fontSize: 10, color: opts[i] ? 'var(--color-text-secondary)' : 'var(--color-text-muted)', lineHeight: 1.2 }}>{o.label}</span>
                    <Toggle
                      checked={opts[i]}
                      onChange={v => setOpts(prev => prev.map((x, j) => j === i ? v : x))}
                    />
                  </div>
                ))}
              </div>
            </Card>
          </div>

          {/* ── CENTER COLUMN ── */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0, overflow: 'hidden' }}>

            {/* LIVE GAME STATS */}
            <Card style={{ flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div className="stub-section-title">LIVE GAME STATS</div>
                <span style={{ fontSize: 10, color: 'var(--color-accent-secondary)', fontFamily: 'var(--font-mono)' }}>{currentGame}</span>
              </div>

              {/* FPS + sparkline */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 8 }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <span style={{ fontFamily: 'var(--font-display)', fontSize: 44, fontWeight: 700, color: '#00B4D8', lineHeight: 1, textShadow: '0 0 20px rgba(0,180,216,0.6)' }}>{fps}</span>
                  <span style={{ fontSize: 9, color: 'var(--color-text-muted)', letterSpacing: '0.15em', textTransform: 'uppercase' }}>FPS</span>
                </div>
                <div style={{ flex: 1 }}>
                  <Sparkline data={sparklineData.fpsHistory} width={160} height={44} color="#00B4D8" />
                </div>
              </div>

              {/* Metric bars */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginTop: 10 }}>
                {[
                  { label: 'GPU Load', value: parseFloat(gpuLoad), color: '#00B4D8' },
                  { label: 'CPU Load', value: parseFloat(cpuLoad), color: '#7B2FBE' },
                  { label: 'RAM',      value: parseFloat(ramPct),  color: '#00E676' },
                  { label: 'VRAM',     value: parseFloat(vramPct), color: '#FFAB40' },
                ].map(m => (
                  <div key={m.label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 9, color: 'var(--color-text-muted)', width: 52, textTransform: 'uppercase', letterSpacing: '0.04em', flexShrink: 0 }}>{m.label}</span>
                    <div style={{ flex: 1, height: 5, background: 'var(--gauge-track)', borderRadius: 99, overflow: 'hidden' }}>
                      <div style={{ width: `${m.value}%`, height: '100%', background: m.color, borderRadius: 99, boxShadow: `0 0 8px ${m.color}80`, transition: 'width 0.3s' }} />
                    </div>
                    <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: m.color, width: 32, textAlign: 'right', flexShrink: 0 }}>{Math.round(m.value)}%</span>
                  </div>
                ))}
              </div>
            </Card>

            {/* PERFORMANCE OVERVIEW */}
            <Card style={{ flex: 1 }}>
              <div className="stub-section-title">PERFORMANCE OVERVIEW</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginTop: 8, justifyItems: 'center' }}>
                <CircularGauge value={cpuLoad}  label="CPU"  size={82} warnAt={70} critAt={85} />
                <CircularGauge value={gpuLoad}  label="GPU"  size={82} color="#00B4D8" warnAt={80} critAt={88} />
                <CircularGauge value={ramPct}   label="RAM"  size={82} color="#00E676" warnAt={80} critAt={90} />
                <CircularGauge value={vramPct}  label="VRAM" size={82} color="#FFAB40" warnAt={80} critAt={90} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 6 }}>
                <span style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>⏱ Uptime:</span>
                <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--color-text-secondary)' }}>{uptime}</span>
              </div>
            </Card>

            {/* NETWORK STATUS */}
            <Card style={{ flexShrink: 0 }}>
              <div className="stub-section-title">NETWORK STATUS</div>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 8 }}>
                {/* Ping */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '6px 10px', background: 'rgba(0,230,118,0.05)', border: `1px solid ${pingNum < 50 ? '#00E67644' : '#FF525244'}`, borderRadius: 8 }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 20, fontWeight: 700, color: pingNum < 50 ? '#00E676' : '#FFAB40', lineHeight: 1 }}>{ping}</span>
                  <span style={{ fontSize: 8, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>ms Ping</span>
                </div>
                {/* Download/Upload */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 12, color: '#00E676' }}>↓</span>
                    <span style={{ fontSize: 10, color: 'var(--color-text-muted)', width: 58 }}>Download</span>
                    <span style={{ fontSize: 13, fontFamily: 'var(--font-mono)', color: '#00E676', fontWeight: 600 }}>{dl} <span style={{ fontSize: 9, color: 'var(--color-text-muted)' }}>Mbps</span></span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 12, color: '#00B4D8' }}>↑</span>
                    <span style={{ fontSize: 10, color: 'var(--color-text-muted)', width: 58 }}>Upload</span>
                    <span style={{ fontSize: 13, fontFamily: 'var(--font-mono)', color: '#00B4D8', fontWeight: 600 }}>{ul} <span style={{ fontSize: 9, color: 'var(--color-text-muted)' }}>Mbps</span></span>
                  </div>
                </div>
              </div>
            </Card>
          </div>

          {/* ── RIGHT COLUMN ── */}
          <div style={{ width: '30%', display: 'flex', flexDirection: 'column', gap: 8, overflow: 'hidden' }}>

            {/* QUICK ACTIONS */}
            <Card style={{ flexShrink: 0 }}>
              <div className="stub-section-title">QUICK ACTIONS</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 5, marginTop: 8 }}>
                {quickActions.map(a => (
                  <button key={a.label} className="stub-action-tile">
                    <span style={{ fontSize: 16 }}>{a.icon}</span>
                    <span style={{ fontSize: 8, color: 'var(--color-text-muted)', textAlign: 'center', lineHeight: 1.2 }}>{a.label}</span>
                  </button>
                ))}
              </div>
            </Card>

            {/* GAME PROFILES */}
            <Card style={{ flexShrink: 0 }}>
              <div className="stub-section-title">GAME PROFILES</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginTop: 8 }}>
                {gameProfiles.map(p => {
                  const isActive = activeProfile === p.id;
                  return (
                    <div key={p.id} style={{
                      display: 'flex', alignItems: 'center', gap: 8, padding: '7px 9px',
                      background: isActive ? `${p.color}14` : 'rgba(255,255,255,0.02)',
                      border: `1px solid ${isActive ? p.color + '55' : 'var(--color-border)'}`,
                      borderRadius: 8, cursor: 'pointer', transition: 'all 0.15s',
                    }} onClick={() => setProfile(p.id)}>
                      <div style={{ width: 7, height: 7, borderRadius: '50%', background: p.color, flexShrink: 0, boxShadow: isActive ? `0 0 6px ${p.color}` : 'none' }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 11, fontWeight: 600, color: isActive ? p.color : 'var(--color-text-secondary)', fontFamily: 'var(--font-label)' }}>{p.label}</div>
                        <div style={{ fontSize: 9, color: 'var(--color-text-muted)' }}>{p.desc}</div>
                      </div>
                      {isActive
                        ? <span style={{ fontSize: 8, color: p.color, background: `${p.color}22`, padding: '2px 5px', borderRadius: 4, fontWeight: 700, letterSpacing: '0.05em', flexShrink: 0 }}>ACTIVE</span>
                        : <button onClick={e => { e.stopPropagation(); setProfile(p.id); }} style={{ fontSize: 8, color: 'var(--color-text-muted)', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--color-border)', padding: '2px 5px', borderRadius: 4, cursor: 'pointer', flexShrink: 0 }}>ACTIVATE</button>
                      }
                    </div>
                  );
                })}
              </div>
              <button style={{ width: '100%', marginTop: 8, padding: '5px', background: 'none', border: '1px dashed var(--color-border)', borderRadius: 6, color: 'var(--color-text-muted)', fontSize: 10, cursor: 'pointer', fontFamily: 'var(--font-label)' }}>
                + Create Profile
              </button>
            </Card>

            {/* ACHIEVEMENTS */}
            <Card style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div className="stub-section-title">ACHIEVEMENTS</div>
                <span style={{ fontSize: 9, padding: '2px 6px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--color-border)', borderRadius: 4, color: 'var(--color-text-muted)', fontFamily: 'var(--font-label)', fontWeight: 600, letterSpacing: '0.05em' }}>PHASE 3</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8, opacity: 0.5, pointerEvents: 'none' }}>
                {achievements.map(a => (
                  <div key={a.label} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', background: 'rgba(255,255,255,0.02)', borderRadius: 6, border: '1px solid var(--color-border)' }}>
                    <span style={{ fontSize: 16 }}>{a.icon}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 10, color: 'var(--color-text-secondary)', fontWeight: 600 }}>{a.label}</div>
                      <div style={{ fontSize: 8, color: a.color }}>{a.rarity}</div>
                    </div>
                  </div>
                ))}
                <div style={{ textAlign: 'center', marginTop: 4 }}>
                  <span style={{ fontSize: 9, color: 'var(--color-text-muted)', fontStyle: 'italic' }}>View All Achievements →</span>
                </div>
              </div>
            </Card>
          </div>
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
