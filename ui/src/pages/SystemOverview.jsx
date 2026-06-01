import { useState } from 'react';
import './StubPage.css';
import Card from '../design-system/components/Card';
import CircularGauge from '../design-system/components/CircularGauge';
import Sparkline from '../design-system/components/Sparkline';
import StatusDot from '../design-system/components/StatusDot';
import { useStore } from '../store/StoreContext';

const TABS = ['OVERVIEW', 'SYSTEM', 'PERFORMANCE', 'NETWORK', 'STORAGE', 'PROCESSES', 'SETTINGS'];
const PERF_TABS = ['CPU', 'GPU', 'RAM', 'FPS'];

const alertColors = { info: '#448AFF', warning: '#FFAB40', success: '#00E676', error: '#FF5252' };
const alertIcons  = { info: 'ℹ',      warning: '⚠',       success: '✓',       error: '✕'    };

// Small metric card at top
function MetricCard({ label, value, sub, extra, color, spark, sparkColor }) {
  return (
    <div className="metric-card" style={{ flex: 1, minWidth: 0 }}>
      <div className="metric-card__label">{label}</div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 3 }}>
        <span className="metric-card__value" style={{ color, fontSize: 20 }}>{value}</span>
        {sub && <span style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>{sub}</span>}
      </div>
      {extra && (
        typeof extra === 'string'
          ? <span style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>{extra}</span>
          : extra
      )}
      {spark && (
        <Sparkline data={spark} width={90} height={26} color={sparkColor || color} />
      )}
    </div>
  );
}

// Donut chart SVG for storage
function Donut({ pct, color, size = 52 }) {
  const r = (size - 10) / 2;
  const circ = 2 * Math.PI * r;
  const fill = (pct / 100) * circ;
  const cx = size / 2, cy = size / 2;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ flexShrink: 0 }}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--color-bg-elevated)" strokeWidth="6" />
      <circle
        cx={cx} cy={cy} r={r} fill="none"
        stroke={color} strokeWidth="6"
        strokeDasharray={`${fill} ${circ - fill}`}
        strokeDashoffset={circ * 0.25}
        strokeLinecap="round"
        style={{ filter: `drop-shadow(0 0 4px ${color}88)` }}
        transform={`rotate(-90 ${cx} ${cy})`}
      />
      <text x={cx} y={cy + 4} textAnchor="middle" fill={color}
        fontSize="11" fontFamily="var(--font-mono)" fontWeight="700">
        {pct}%
      </text>
    </svg>
  );
}

export default function SystemOverview() {
  const { getState, sparklineData, processes, storageDisks, systemAlerts } = useStore();
  const [activeTab, setActiveTab] = useState('OVERVIEW');
  const [activePerfTab, setActivePerfTab] = useState('CPU');

  const healthScore = getState('system.health.score');
  const healthNum   = parseInt(healthScore);
  const healthLabel = healthNum >= 90 ? 'Excellent' : healthNum >= 75 ? 'Good' : healthNum >= 50 ? 'Fair' : 'Poor';
  const healthColor = healthNum >= 90 ? '#00E676' : healthNum >= 75 ? '#7B2FBE' : '#FFAB40';

  const perfTabData = {
    CPU: {
      spark: sparklineData.cpuHistory,
      color: '#7B2FBE',
      stats: [
        ['Utilization', `${getState('system.cpu.load')}%`],
        ['Speed',       getState('system.cpu.frequency')],
        ['Cores',       getState('system.cpu.cores')],
        ['Threads',     getState('system.cpu.threads')],
      ],
      extra: [
        ['Temperature', `${getState('system.cpu.temp')}°C`],
        ['Cache',       '32 MB'],
      ],
    },
    GPU: {
      spark: sparklineData.gpuHistory,
      color: '#00B4D8',
      stats: [
        ['Utilization', `${getState('system.gpu.load')}%`],
        ['VRAM Used',   `${getState('system.gpu.vram.used')} GB`],
        ['VRAM Total',  `${getState('system.gpu.vram.total')} GB`],
        ['Temperature', `${getState('system.gpu.temp')}°C`],
      ],
      extra: [
        ['Driver', getState('system.gpu.driver')],
        ['Model',  getState('system.gpu.model')],
      ],
    },
    RAM: {
      spark: sparklineData.ramHistory,
      color: '#00E676',
      stats: [
        ['Used',      `${getState('system.ram.used')} GB`],
        ['Available', `${getState('system.ram.available')} GB`],
        ['Total',     `${getState('system.ram.total')} GB`],
        ['Usage',     `${getState('system.ram.percent')}%`],
      ],
      extra: [
        ['Spec', getState('system.ram.spec')],
        ['Type', 'DDR5'],
      ],
    },
    FPS: {
      spark: sparklineData.fpsHistory,
      color: '#FFAB40',
      stats: [
        ['Current FPS', getState('gaming.fps')],
        ['Game',        getState('gaming.currentgame')],
        ['Mode',        getState('gaming.mode')],
        ['Ping',        `${getState('gaming.network.ping')} ms`],
      ],
      extra: [
        ['Recording', getState('gaming.recording') === 'true' ? 'Yes' : 'No'],
        ['',          ''],
      ],
    },
  };

  const totalStorageGB = storageDisks.reduce((s, d) => s + d.total, 0);

  return (
    <div className="stub-page" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ flex: 1, padding: '12px 12px 0 12px', display: 'flex', flexDirection: 'column', gap: 10, minHeight: 0, overflow: 'auto' }}>

        {/* ── Row 1: Metric Cards ─────────────────────── */}
        <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
          <MetricCard
            label="CPU" value={`${getState('system.cpu.load')}%`}
            sub={getState('system.cpu.frequency')}
            extra={`${getState('system.cpu.temp')}°C`}
            color="#7B2FBE"
            spark={sparklineData.cpuHistory} sparkColor="#7B2FBE"
          />
          <MetricCard
            label="GPU" value={`${getState('system.gpu.load')}%`}
            sub="RTX 4090"
            extra={`${getState('system.gpu.temp')}°C`}
            color="#00B4D8"
            spark={sparklineData.gpuHistory} sparkColor="#00B4D8"
          />
          <MetricCard
            label="RAM" value={`${getState('system.ram.used')} GB`}
            sub={`${getState('system.ram.percent')}%`}
            color="#00E676"
            spark={sparklineData.ramHistory} sparkColor="#00E676"
          />
          <MetricCard
            label="VRAM" value={`${getState('system.gpu.vram.used')} GB`}
            sub={`/ ${getState('system.gpu.vram.total')} GB`}
            color="#FFAB40"
            spark={sparklineData.vramHistory} sparkColor="#FFAB40"
          />
          <MetricCard
            label="Storage"
            value={`${getState('system.storage.used_tb')} TB`}
            sub={`/ ${(parseFloat(getState('system.storage.used_tb')) + parseFloat(getState('system.storage.free_tb'))).toFixed(2)} TB`}
            extra={
              <div style={{ height: 4, background: 'var(--color-bg-elevated)', borderRadius: 2, overflow: 'hidden', marginTop: 2 }}>
                <div style={{
                  height: '100%',
                  width: `${Math.round(parseFloat(getState('system.storage.used_tb')) / (parseFloat(getState('system.storage.used_tb')) + parseFloat(getState('system.storage.free_tb'))) * 100)}%`,
                  background: 'linear-gradient(90deg, #448AFF, #00B4D8)',
                  borderRadius: 2,
                }} />
              </div>
            }
            color="#448AFF"
            spark={sparklineData.storageHistory} sparkColor="#448AFF"
          />
          <MetricCard
            label="Uptime"
            value="2d 14h"
            sub="36m"
            extra={
              <span style={{
                fontSize: 9, fontWeight: 700, color: '#00E676',
                background: 'rgba(0,230,118,0.12)', padding: '2px 7px',
                borderRadius: 4, border: '1px solid rgba(0,230,118,0.3)',
                marginTop: 2, display: 'inline-block',
              }}>
                HEALTHY
              </span>
            }
            color="var(--color-text-primary)"
          />
        </div>

        {/* ── Row 2: Performance | System Info | Health ── */}
        <div style={{ display: 'flex', gap: 10, flexShrink: 0 }}>

          {/* System Performance */}
          <Card style={{ flex: '0 0 40%', minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <div className="stub-section-title">SYSTEM PERFORMANCE</div>
              {/* Perf sub-tabs */}
              <div style={{ display: 'flex', gap: 2 }}>
                {PERF_TABS.map(t => (
                  <button
                    key={t}
                    onClick={() => setActivePerfTab(t)}
                    style={{
                      padding: '3px 8px', fontSize: 9, fontWeight: 600,
                      borderRadius: 4, border: '1px solid',
                      fontFamily: 'var(--font-heading)', letterSpacing: '0.06em',
                      cursor: 'pointer', transition: 'all 0.15s',
                      background: activePerfTab === t ? '#7B2FBE22' : 'transparent',
                      borderColor: activePerfTab === t ? '#7B2FBE66' : 'var(--color-border)',
                      color: activePerfTab === t ? '#7B2FBE' : 'var(--color-text-muted)',
                    }}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            {/* Large Sparkline */}
            <div style={{ background: 'rgba(0,0,0,0.15)', borderRadius: 8, padding: '6px 4px 4px', marginBottom: 10 }}>
              <Sparkline
                data={perfTabData[activePerfTab].spark}
                width={380} height={140}
                color={perfTabData[activePerfTab].color}
                fillOpacity={0.18}
              />
            </div>

            {/* Stats row */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6, paddingBottom: 8, borderBottom: '1px solid var(--color-border)' }}>
              {perfTabData[activePerfTab].stats.map(([k, v]) => (
                <div key={k} style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 9, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>{k}</div>
                  <div style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: perfTabData[activePerfTab].color, fontWeight: 700 }}>{v}</div>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 16, marginTop: 8 }}>
              {perfTabData[activePerfTab].extra.filter(([k]) => k).map(([k, v]) => (
                <div key={k} style={{ display: 'flex', gap: 6, alignItems: 'baseline' }}>
                  <span style={{ fontSize: 9, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{k}:</span>
                  <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--color-text-secondary)' }}>{v}</span>
                </div>
              ))}
            </div>
          </Card>

          {/* Detailed System Info */}
          <Card style={{ flex: '0 0 25%', minWidth: 0 }}>
            <div className="stub-section-title" style={{ marginBottom: 10 }}>DETAILED SYSTEM INFO</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              {[
                { icon: '🖥', key: 'OS',              val: getState('system.os') },
                { icon: '⚡', key: 'Processor',       val: getState('system.cpu.model') },
                { icon: '📋', key: 'Motherboard',     val: getState('system.motherboard') },
                { icon: '🧠', key: 'RAM',             val: getState('system.ram.spec') },
                { icon: '🎮', key: 'GPU',             val: getState('system.gpu.model') },
                { icon: '🔧', key: 'Driver',          val: getState('system.gpu.driver') },
                { icon: '💻', key: 'System Type',     val: '64-bit' },
                { icon: '🪟', key: 'Windows Version', val: '10.0.26200' },
              ].map(({ icon, key, val }) => (
                <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 13, flexShrink: 0, width: 18, textAlign: 'center' }}>{icon}</span>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: 9, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{key}</div>
                    <div style={{
                      fontSize: 10, color: 'var(--color-text-secondary)',
                      fontFamily: 'var(--font-mono)',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {val}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* System Health */}
          <Card style={{ flex: 1, minWidth: 0 }}>
            <div className="stub-section-title" style={{ marginBottom: 8 }}>SYSTEM HEALTH</div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
              <CircularGauge
                value={healthScore} size={140}
                color={healthColor} label={healthLabel}
                warnAt={75} critAt={50}
              />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, width: '100%' }}>
                {[
                  { label: 'CPU Temp',      val: `${getState('system.cpu.temp')}°C` },
                  { label: 'GPU Temp',      val: `${getState('system.gpu.temp')}°C` },
                  { label: 'RAM Usage',     val: `${getState('system.ram.percent')}%` },
                  { label: 'Storage Health', val: 'Good' },
                  { label: 'System Files',   val: 'Good' },
                  { label: 'Drivers',        val: 'Good' },
                ].map(c => (
                  <div key={c.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <StatusDot status="success" size={6} />
                      <span style={{ fontSize: 10, color: 'var(--color-text-secondary)' }}>{c.label}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 10, color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)' }}>{c.val}</span>
                      <span style={{ fontSize: 9, color: '#00E676', fontWeight: 600 }}>Good</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        </div>

        {/* ── Row 3: Storage | Processes | Alerts ──────── */}
        <div style={{ display: 'flex', gap: 10, flex: 1, minHeight: 0 }}>

          {/* Storage Overview */}
          <Card style={{ flex: '0 0 45%', minWidth: 0, overflow: 'hidden' }}>
            <div className="stub-section-title" style={{ marginBottom: 10 }}>STORAGE OVERVIEW</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {storageDisks.map(d => {
                const pct = Math.round((d.used / d.total) * 100);
                return (
                  <div key={d.label} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <Donut pct={pct} color={d.color} size={50} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <span style={{ fontSize: 11, color: 'var(--color-text-secondary)', fontFamily: 'var(--font-mono)' }}>{d.label}</span>
                        <span style={{ fontSize: 10, color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)' }}>{d.used}/{d.total} GB</span>
                      </div>
                      <div style={{ height: 5, background: 'var(--color-bg-elevated)', borderRadius: 3, overflow: 'hidden' }}>
                        <div style={{
                          height: '100%', width: `${pct}%`,
                          background: `linear-gradient(90deg, ${d.color}AA, ${d.color})`,
                          borderRadius: 3,
                          boxShadow: `0 0 5px ${d.color}66`,
                        }} />
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Summary row */}
              <div style={{
                display: 'flex', justifyContent: 'space-between',
                borderTop: '1px solid var(--color-border)', paddingTop: 8, marginTop: 2,
              }}>
                <span style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>Total Capacity</span>
                <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--color-text-primary)', fontWeight: 600 }}>
                  {(totalStorageGB / 1000).toFixed(1)} TB
                </span>
              </div>
            </div>
          </Card>

          {/* Top Processes */}
          <Card style={{ flex: '0 0 30%', minWidth: 0, overflow: 'hidden' }}>
            <div className="stub-section-title" style={{ marginBottom: 10 }}>TOP PROCESSES</div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                  {['Process', 'CPU %', 'Mem MB', 'Status'].map(h => (
                    <th key={h} style={{
                      textAlign: 'left', fontSize: 9,
                      color: 'var(--color-text-muted)',
                      textTransform: 'uppercase', letterSpacing: '0.06em',
                      padding: '0 6px 6px 0', fontWeight: 600,
                    }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {processes.slice(0, 5).map((p, i) => (
                  <tr
                    key={p.name}
                    style={{
                      background: i % 2 === 0 ? 'rgba(255,255,255,0.015)' : 'transparent',
                      borderBottom: '1px solid rgba(45,45,94,0.35)',
                    }}
                  >
                    <td style={{ padding: '6px 6px 6px 0', fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--color-text-primary)', maxWidth: 110, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</td>
                    <td style={{ padding: '6px 6px 6px 0', fontSize: 10, fontFamily: 'var(--font-mono)', color: '#7B2FBE', fontWeight: 600 }}>{p.cpu}</td>
                    <td style={{ padding: '6px 6px 6px 0', fontSize: 10, fontFamily: 'var(--font-mono)', color: '#00B4D8' }}>{p.memory}</td>
                    <td style={{ padding: '6px 0' }}>
                      <span style={{
                        fontSize: 9, color: '#00E676',
                        background: 'rgba(0,230,118,0.1)',
                        padding: '2px 6px', borderRadius: 4,
                        border: '1px solid rgba(0,230,118,0.2)',
                      }}>
                        {p.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div style={{ marginTop: 10, textAlign: 'center' }}>
              <button style={{
                fontSize: 10, color: '#7B2FBE', background: 'rgba(123,47,190,0.1)',
                border: '1px solid rgba(123,47,190,0.3)', borderRadius: 6,
                padding: '5px 16px', cursor: 'pointer', fontFamily: 'var(--font-heading)',
                fontWeight: 600, letterSpacing: '0.05em', width: '100%',
              }}>
                View All Processes
              </button>
            </div>
          </Card>

          {/* System Alerts */}
          <Card style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
            <div className="stub-section-title" style={{ marginBottom: 10 }}>SYSTEM ALERTS</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {systemAlerts.map(a => (
                <div
                  key={a.id}
                  style={{
                    display: 'flex', gap: 8, alignItems: 'flex-start',
                    padding: '7px 8px', borderRadius: 6,
                    background: `${alertColors[a.severity]}0D`,
                    border: `1px solid ${alertColors[a.severity]}28`,
                  }}
                >
                  <span style={{
                    fontSize: 13, color: alertColors[a.severity],
                    lineHeight: 1.4, flexShrink: 0, marginTop: 1,
                    filter: `drop-shadow(0 0 4px ${alertColors[a.severity]}88)`,
                  }}>
                    {alertIcons[a.severity]}
                  </span>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: 10, color: 'var(--color-text-secondary)', lineHeight: 1.4 }}>{a.message}</div>
                    <div style={{ fontSize: 9, color: 'var(--color-text-muted)', marginTop: 2 }}>{a.time}</div>
                  </div>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 10 }}>
              <button style={{
                fontSize: 10, color: 'var(--color-text-muted)',
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid var(--color-border)', borderRadius: 6,
                padding: '5px 16px', cursor: 'pointer',
                fontFamily: 'var(--font-heading)', fontWeight: 600,
                letterSpacing: '0.05em', width: '100%',
              }}>
                View All Alerts
              </button>
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
        overflowX: 'auto',
      }}>
        {TABS.map(tab => {
          const isActive = tab === activeTab;
          return (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                padding: '0 16px', background: 'transparent', border: 'none',
                borderBottom: isActive ? '2px solid #7B2FBE' : '2px solid transparent',
                color: isActive ? '#7B2FBE' : 'var(--color-text-muted)',
                fontSize: 11, fontFamily: 'var(--font-heading)', fontWeight: 600,
                letterSpacing: '0.08em', cursor: 'pointer', whiteSpace: 'nowrap',
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
