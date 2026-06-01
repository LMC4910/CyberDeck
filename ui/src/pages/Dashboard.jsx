import { useState } from 'react';
import './Dashboard.css';
import { useStore } from '../store/StoreContext';
import Card from '../design-system/components/Card';
import CircularGauge from '../design-system/components/CircularGauge';
import Sparkline from '../design-system/components/Sparkline';
import ProgressBar from '../design-system/components/ProgressBar';
import StatusDot from '../design-system/components/StatusDot';

// Quick Launch app data
const quickApps = [
  { id: 'disney', name: 'Disney+', bg: '#006AC0', label: 'D+', textColor: '#fff' },
  { id: 'prime', name: 'Prime Video', bg: '#00A8E0', label: '▶', textColor: '#fff' },
  { id: 'netflix', name: 'Netflix', bg: '#E50914', label: 'N', textColor: '#fff' },
  { id: 'chrome', name: 'Chrome', bg: 'linear-gradient(135deg, #4285F4, #EA4335, #FBBC05, #34A853)', label: 'G', textColor: '#fff' },
  { id: 'chatgpt', name: 'ChatGPT', bg: '#10A37F', label: 'GPT', textColor: '#fff' },
];

function QuickAppButton({ app }) {
  return (
    <Card className="dash-app-btn" onClick={() => {}}>
      <div className="dash-app-btn__icon" style={{ background: app.bg }}>
        <span style={{ color: app.textColor, fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 14 }}>
          {app.label}
        </span>
      </div>
      <span className="dash-app-btn__name">{app.name}</span>
    </Card>
  );
}

function WaveformVisualizer({ playing, bars = 10 }) {
  return (
    <div className={`dash-waveform ${playing ? 'dash-waveform--playing' : ''}`}>
      {Array.from({ length: bars }).map((_, i) => (
        <span
          key={i}
          className="dash-waveform__bar"
          style={{ animationDelay: `${(i % 5) * 0.1}s` }}
        />
      ))}
    </div>
  );
}

function MediaPlayerCard() {
  const { getState } = useStore();
  const track = getState('media.track');
  const artist = getState('media.artist');
  const album = getState('media.album');
  const playing = getState('media.playing') === 'true';
  const position = getState('media.position');
  const duration = getState('media.duration');
  const shuffle = getState('media.shuffle') === 'true';
  const repeat = getState('media.repeat') === 'true';

  function toSec(t) {
    if (!t || t === '--') return 0;
    const parts = t.split(':').map(Number);
    return parts.length === 2 ? parts[0] * 60 + parts[1] : 0;
  }
  const posSec = toSec(position);
  const durSec = toSec(duration);
  const pct = durSec > 0 ? (posSec / durSec) * 100 : 0;

  return (
    <Card className="dash-media-card" glowing>
      <div className="dash-media-card__inner">
        {/* Album art + info */}
        <div className="dash-media-card__top">
          <div className="dash-media-card__art">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
              <path d="M9 18V5l12-2v13M9 18a3 3 0 01-3-3c0-1.657 1.343-3 3-3s3 1.343 3 3c0 1.657-1.343 3-3 3zm12-2a3 3 0 01-3-3c0-1.657 1.343-3 3-3s3 1.343 3 3c0 1.657-1.343 3-3 3z"
                stroke="#00B4D8" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </div>
          <div className="dash-media-card__info">
            <span className="dash-media-card__track">{track}</span>
            <span className="dash-media-card__artist">{artist}</span>
            <span className="dash-media-card__album">{album}</span>
          </div>
        </div>

        {/* Waveform */}
        <WaveformVisualizer playing={playing} bars={14} />

        {/* Seek bar */}
        <div className="dash-media-card__seek">
          <span className="dash-media-card__time">{position}</span>
          <div className="dash-media-card__seek-track">
            <div className="dash-media-card__seek-fill" style={{ width: `${pct}%` }} />
            <div className="dash-media-card__seek-thumb" style={{ left: `${pct}%` }} />
          </div>
          <span className="dash-media-card__time">{duration}</span>
        </div>

        {/* Controls */}
        <div className="dash-media-card__controls">
          <button className={`dash-ctrl-btn ${shuffle ? 'dash-ctrl-btn--active' : ''}`} title="Shuffle">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M16 3h5v5M4 20L21 3M16 20l5-5-5-5M4 4l5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          <button className="dash-ctrl-btn dash-ctrl-btn--nav" title="Previous">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M19 20L9 12l10-8v16zM5 4v16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          <button className="dash-ctrl-btn dash-ctrl-btn--play">
            {playing ? (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <rect x="6" y="4" width="4" height="16" rx="1"/>
                <rect x="14" y="4" width="4" height="16" rx="1"/>
              </svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M5 3l14 9-14 9V3z"/>
              </svg>
            )}
          </button>
          <button className="dash-ctrl-btn dash-ctrl-btn--nav" title="Next">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M5 4l10 8-10 8V4zM19 4v16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          <button className={`dash-ctrl-btn ${repeat ? 'dash-ctrl-btn--active' : ''}`} title="Repeat">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M17 1l4 4-4 4M3 11V9a4 4 0 014-4h14M7 23l-4-4 4-4M21 13v2a4 4 0 01-4 4H3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>
      </div>
    </Card>
  );
}

function VolumeSlider() {
  const { getState } = useStore();
  const volume = getState('media.volume.system');
  const [val, setVal] = useState(parseInt(volume) || 70);

  return (
    <div className="dash-volume">
      <span className="dash-volume__label">VOLUME</span>
      <div className="dash-volume__slider-wrap">
        <input
          type="range"
          min={0}
          max={100}
          value={val}
          onChange={e => setVal(Number(e.target.value))}
          className="dash-volume__slider"
          orient="vertical"
        />
      </div>
      <span className="dash-volume__value">{val}%</span>
    </div>
  );
}

function SystemStatusPanel() {
  const { getState } = useStore();
  const download = getState('system.network.download');
  const upload = getState('system.network.upload');
  const uptime = getState('system.uptime');
  const powerplan = getState('system.powerplan');
  const usedTb = getState('system.storage.used_tb');
  const freeTb = getState('system.storage.free_tb');
  const totalTb = (parseFloat(usedTb) + parseFloat(freeTb)).toFixed(2);
  const storagePct = totalTb > 0 ? (parseFloat(usedTb) / parseFloat(totalTb)) * 100 : 0;

  return (
    <Card className="dash-status-panel">
      <div className="dash-status-panel__title">SYSTEM MONITOR</div>

      <div className="dash-status-row">
        <div className="dash-status-row__icon">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" stroke="#FFAB40" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
        <div className="dash-status-row__content">
          <span className="dash-status-row__label">Power Plan</span>
          <span className="dash-status-row__value">{powerplan}</span>
        </div>
        <span className="dash-status-badge">ACTIVE</span>
      </div>

      <div className="dash-status-row">
        <div className="dash-status-row__icon">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <path d="M22 12h-4l-3 9L9 3l-3 9H2" stroke="#00B4D8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
        <div className="dash-status-row__content">
          <span className="dash-status-row__label">Network</span>
          <div className="dash-status-network">
            <span style={{ color: '#00E676' }}>↓ {download} Mbps</span>
            <span style={{ color: '#00B4D8' }}>↑ {upload} Mbps</span>
          </div>
        </div>
      </div>

      <div className="dash-status-row">
        <div className="dash-status-row__icon">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <ellipse cx="12" cy="5" rx="9" ry="3" stroke="#7B2FBE" strokeWidth="1.5"/>
            <path d="M21 12c0 1.657-4.03 3-9 3S3 13.657 3 12M21 19c0 1.657-4.03 3-9 3S3 20.657 3 19" stroke="#7B2FBE" strokeWidth="1.5"/>
            <path d="M3 5v14M21 5v14" stroke="#7B2FBE" strokeWidth="1.5"/>
          </svg>
        </div>
        <div className="dash-status-row__content" style={{ flex: 1 }}>
          <span className="dash-status-row__label">Storage</span>
          <span className="dash-status-row__value" style={{ fontSize: 10 }}>{usedTb} TB / {totalTb} TB</span>
          <ProgressBar value={storagePct} height={4} />
        </div>
      </div>

      <div className="dash-status-row">
        <div className="dash-status-row__icon">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="9" stroke="#448AFF" strokeWidth="1.5"/>
            <path d="M12 7v5l3 3" stroke="#448AFF" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        </div>
        <div className="dash-status-row__content">
          <span className="dash-status-row__label">Uptime</span>
          <span className="dash-status-row__value">{uptime}</span>
        </div>
        <StatusDot status="success" size={6} pulse />
      </div>
    </Card>
  );
}

function GaugeSection() {
  const { getState, sparklineData } = useStore();

  const cpuLoad = getState('system.cpu.load');
  const cpuTemp = getState('system.cpu.temp');
  const gpuLoad = getState('system.gpu.load');
  const gpuTemp = getState('system.gpu.temp');
  const ramPct = getState('system.ram.percent');
  const ramUsed = getState('system.ram.used');

  function sparkStats(arr) {
    const min = Math.min(...arr);
    const max = Math.max(...arr);
    const avg = Math.round(arr.reduce((a, b) => a + b, 0) / arr.length);
    return { min, max, avg };
  }

  const cpuStats = sparkStats(sparklineData.cpuHistory);
  const gpuStats = sparkStats(sparklineData.gpuHistory);
  const ramStats = sparkStats(sparklineData.ramHistory);

  return (
    <div className="dash-gauges">
      {/* CPU */}
      <Card className="dash-gauge-card">
        <div className="dash-gauge-card__label">CPU TEMPERATURE</div>
        <div className="dash-gauge-card__gauge-wrap">
          <CircularGauge
            value={cpuLoad}
            sublabel={`${cpuTemp}°C`}
            label="CPU LOAD"
            size={110}
            warnAt={70}
            critAt={85}
          />
        </div>
        <Sparkline data={sparklineData.cpuHistory} width={140} height={36} color="#7B2FBE" />
        <div className="dash-gauge-card__stats">
          <span>Min: {cpuStats.min}%</span>
          <span>Avg: {cpuStats.avg}%</span>
          <span>Max: {cpuStats.max}%</span>
        </div>
      </Card>

      {/* GPU */}
      <Card className="dash-gauge-card">
        <div className="dash-gauge-card__label">GPU TEMPERATURE</div>
        <div className="dash-gauge-card__gauge-wrap">
          <CircularGauge
            value={gpuLoad}
            sublabel={`${gpuTemp}°C`}
            label="GPU LOAD"
            size={110}
            color="#00B4D8"
            warnAt={80}
            critAt={88}
          />
        </div>
        <Sparkline data={sparklineData.gpuHistory} width={140} height={36} color="#00B4D8" />
        <div className="dash-gauge-card__stats">
          <span>Min: {gpuStats.min}%</span>
          <span>Avg: {gpuStats.avg}%</span>
          <span>Max: {gpuStats.max}%</span>
        </div>
      </Card>

      {/* RAM */}
      <Card className="dash-gauge-card">
        <div className="dash-gauge-card__label">RAM USAGE</div>
        <div className="dash-gauge-card__gauge-wrap">
          <CircularGauge
            value={ramPct}
            sublabel={`${ramUsed} GB`}
            label="RAM USAGE"
            size={110}
            color="#00E676"
            warnAt={80}
            critAt={90}
          />
        </div>
        <Sparkline data={sparklineData.ramHistory} width={140} height={36} color="#00E676" />
        <div className="dash-gauge-card__stats">
          <span>Min: {ramStats.min}%</span>
          <span>Avg: {ramStats.avg}%</span>
          <span>Max: {ramStats.max}%</span>
        </div>
      </Card>
    </div>
  );
}

export default function Dashboard() {
  return (
    <div className="dash-page">
      {/* Row 1: Quick Launch */}
      <div className="dash-row dash-row--quick-launch">
        <div className="dash-quick-launch">
          <span className="dash-section-label">QUICK LAUNCH</span>
          <div className="dash-quick-launch__apps">
            {quickApps.map(app => <QuickAppButton key={app.id} app={app} />)}
          </div>
        </div>
      </div>

      {/* Row 2: Media + Side controls */}
      <div className="dash-row dash-row--media">
        {/* Left side buttons */}
        <div className="dash-side-btns">
          <Card className="dash-action-btn" onClick={() => {}}>
            <div className="dash-action-btn__icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <rect x="3" y="11" width="18" height="11" rx="2" stroke="#7B2FBE" strokeWidth="1.5"/>
                <path d="M7 11V7a5 5 0 0110 0v4" stroke="#7B2FBE" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </div>
            <span className="dash-action-btn__label">Lock System</span>
          </Card>
          <Card className="dash-action-btn" onClick={() => {}}>
            <div className="dash-action-btn__icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <rect x="2" y="3" width="20" height="14" rx="2" stroke="#00B4D8" strokeWidth="1.5"/>
                <path d="M8 21h8M12 17v4" stroke="#00B4D8" strokeWidth="1.5" strokeLinecap="round"/>
                <path d="M7 8l3 3-3 3M13 14h4" stroke="#00B4D8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <span className="dash-action-btn__label">Terminal</span>
          </Card>
        </div>

        {/* Center: Media player */}
        <div className="dash-media-wrap">
          <MediaPlayerCard />
        </div>

        {/* Right side btns + volume */}
        <div className="dash-right-area">
          <div className="dash-side-btns">
            <Card className="dash-action-btn" onClick={() => {}}>
              <div className="dash-action-btn__icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <path d="M3 3h8v8H3zM13 3h8v8h-8zM3 13h8v8H3zM13 13h8v8h-8z" stroke="#FFAB40" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <span className="dash-action-btn__label">File Explorer</span>
            </Card>
            <Card className="dash-action-btn" onClick={() => {}}>
              <div className="dash-action-btn__icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="3" stroke="#00E676" strokeWidth="1.5"/>
                  <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" stroke="#00E676" strokeWidth="1.5"/>
                </svg>
              </div>
              <span className="dash-action-btn__label">Control Panel</span>
            </Card>
          </div>
          <VolumeSlider />
        </div>
      </div>

      {/* Row 3: Gauges + System Status */}
      <div className="dash-row dash-row--bottom">
        <GaugeSection />
        <SystemStatusPanel />
      </div>
    </div>
  );
}
