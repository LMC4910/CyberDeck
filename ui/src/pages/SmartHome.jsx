import { useState } from 'react';
import './SmartHome.css';
import Card from '../design-system/components/Card';
import Toggle from '../design-system/components/Toggle';
import ProgressBar from '../design-system/components/ProgressBar';
import CircularGauge from '../design-system/components/CircularGauge';
import StatusDot from '../design-system/components/StatusDot';
import { useStore } from '../store/StoreContext';

const roomIcons = {
  living_room: '🛋',
  bedroom: '🛏',
  kitchen: '🍳',
  office: '💼',
  bathroom: '🚿',
};

const deviceTypeIcon = (type, on) => {
  if (type === 'light') return { icon: '💡', bg: on ? 'rgba(255,171,64,0.18)' : 'rgba(255,255,255,0.06)' };
  if (type === 'switch') return { icon: '📺', bg: on ? 'rgba(0,180,216,0.18)' : 'rgba(255,255,255,0.06)' };
  if (type === 'climate') return { icon: '❄️', bg: on ? 'rgba(68,138,255,0.18)' : 'rgba(255,255,255,0.06)' };
  if (type === 'plug') return { icon: '🔌', bg: on ? 'rgba(0,230,118,0.18)' : 'rgba(255,255,255,0.06)' };
  return { icon: '⚙️', bg: 'rgba(255,255,255,0.06)' };
};

const FILTER_TABS = ['All', 'Lights', 'Plugs', 'Switches', 'Sensors', 'Cameras'];

const RECENT_ACTIVITY = [
  { icon: '💡', color: 'rgba(255,171,64,0.18)', name: 'Living Room Light', desc: 'Turned On', time: '2 min ago' },
  { icon: '🌅', color: 'rgba(255,171,64,0.15)', name: 'Good Morning', desc: 'Scene activated', time: '1 hr ago' },
  { icon: '☕', color: 'rgba(139,90,43,0.2)', name: 'Coffee Maker', desc: 'Turned Off', time: '2 hr ago' },
  { icon: '🏠', color: 'rgba(68,138,255,0.18)', name: 'Away Mode', desc: 'Activated', time: '3 hr ago' },
];

const CAMERA_THUMBS = [
  { name: 'Front Door' },
  { name: 'Driveway' },
  { name: 'Backyard' },
  { name: 'Garage' },
];

const ENERGY_BARS = [
  { day: 'M', value: 65 },
  { day: 'T', value: 80 },
  { day: 'W', value: 55 },
  { day: 'T', value: 90 },
  { day: 'F', value: 70 },
];

export default function SmartHome() {
  const { rooms, devices, scenes, getState } = useStore();
  const [devStates, setDevStates] = useState(() => devices.map(d => d.on));
  const [activeFilter, setActiveFilter] = useState('All');
  const [activatedScene, setActivatedScene] = useState(null);

  const temp = getState('home.env.temperature');
  const humidity = getState('home.env.humidity');
  const airQ = getState('home.env.air_quality');
  const co2 = getState('home.env.co2');
  const noise = getState('home.env.noise');
  const kwh = getState('home.energy.kwh');
  const cost = getState('home.energy.cost');

  // Filter devices by tab
  const filteredDevices = devices.filter(d => {
    if (activeFilter === 'All') return true;
    if (activeFilter === 'Lights') return d.type === 'light';
    if (activeFilter === 'Plugs') return d.type === 'plug';
    if (activeFilter === 'Switches') return d.type === 'switch';
    if (activeFilter === 'Sensors') return d.type === 'sensor';
    if (activeFilter === 'Cameras') return d.type === 'camera';
    return true;
  });

  function handleSceneClick(sceneId) {
    setActivatedScene(sceneId);
    setTimeout(() => setActivatedScene(null), 1800);
  }

  return (
    <div className="smarthome-page">

      {/* ── ROOMS OVERVIEW ── */}
      <Card style={{ flexShrink: 0, padding: '10px 12px' }}>
        <div className="stub-section-title" style={{ marginBottom: 8 }}>ROOMS OVERVIEW</div>
        <div className="sh-rooms-row">
          {rooms.map(r => (
            <div
              key={r.id}
              className={`sh-room-card ${r.active ? 'sh-room-card--active' : ''}`}
            >
              <div className="sh-room-icon">{roomIcons[r.id] || '🏠'}</div>
              <div className="sh-room-name">{r.name}</div>
              <div className="sh-room-meta">{r.devices} devices</div>
              <div className="sh-room-temp">{r.temp}</div>
              <div className="sh-room-lights">
                {Array.from({ length: 2 }).map((_, li) => (
                  <span
                    key={li}
                    className={`sh-light-icon ${li < r.lightsOn ? 'sh-light-icon--on' : ''}`}
                  >💡</span>
                ))}
                <StatusDot
                  status={r.active ? 'success' : 'offline'}
                  size={5}
                  pulse={r.active}
                  style={{ marginLeft: 'auto' }}
                />
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* ── MAIN 3-COLUMN LAYOUT ── */}
      <div className="sh-main-cols">

        {/* ──────────── LEFT: DEVICE CONTROL ──────────── */}
        <div className="sh-col-left">
          <Card style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '10px 12px' }}>
            <div className="stub-section-title">DEVICE CONTROL</div>
            <div className="sh-filter-tabs">
              {FILTER_TABS.map(t => (
                <button
                  key={t}
                  className={`sh-filter-tab ${activeFilter === t ? 'sh-filter-tab--active' : ''}`}
                  onClick={() => setActiveFilter(t)}
                >{t}</button>
              ))}
            </div>
            <div className="sh-device-list">
              {filteredDevices.map((d, i) => {
                const globalIdx = devices.indexOf(d);
                const isOn = devStates[globalIdx];
                const { icon, bg } = deviceTypeIcon(d.type, isOn);
                return (
                  <div key={d.id} className="sh-device-row">
                    <div className="sh-device-icon-circle" style={{ background: bg }}>
                      {icon}
                    </div>
                    <div className="sh-device-info">
                      <div className="sh-device-name">{d.name}</div>
                      <div className="sh-device-room">{d.room}</div>
                    </div>
                    {d.type === 'light' && isOn && d.brightness > 0 && (
                      <div className="sh-device-brightness">
                        <span>{d.brightness}%</span>
                        <ProgressBar value={d.brightness} height={3} />
                      </div>
                    )}
                    <Toggle
                      checked={isOn}
                      onChange={v => setDevStates(prev => prev.map((x, j) => j === globalIdx ? v : x))}
                    />
                  </div>
                );
              })}
              {filteredDevices.length === 0 && (
                <div style={{ textAlign: 'center', fontSize: 11, color: 'var(--color-text-muted)', padding: '16px 0' }}>
                  No {activeFilter.toLowerCase()} found
                </div>
              )}
            </div>
            <button className="sh-add-device-btn">+ Add New Device</button>
          </Card>
        </div>

        {/* ──────────── CENTER ──────────── */}
        <div className="sh-col-center">

          {/* SCENES & AUTOMATIONS */}
          <Card style={{ padding: '10px 12px', flexShrink: 0 }}>
            <div className="stub-section-title">SCENES &amp; AUTOMATIONS</div>
            <div className="sh-scenes-grid">
              {scenes.map(s => {
                const isActivated = activatedScene === s.id;
                return (
                  <button
                    key={s.id}
                    className={`sh-scene-tile ${isActivated ? 'sh-scene-tile--activated' : ''}`}
                    style={{
                      background: `${s.color}12`,
                      borderLeftColor: isActivated ? s.color : `${s.color}44`,
                      borderTopColor: `${s.color}18`,
                      borderRightColor: `${s.color}18`,
                      borderBottomColor: `${s.color}18`,
                      boxShadow: isActivated ? `0 0 12px ${s.color}44` : 'none',
                    }}
                    onClick={() => handleSceneClick(s.id)}
                  >
                    {isActivated && <span className="sh-scene-activated-badge">✓ ON</span>}
                    <span className="sh-scene-icon">{s.icon}</span>
                    <span className="sh-scene-name">{s.name}</span>
                    <span className="sh-scene-actions">{s.actions} actions</span>
                  </button>
                );
              })}
            </div>
            <div className="sh-view-automations">View All Automations →</div>
          </Card>

          {/* ENVIRONMENT */}
          <Card style={{ padding: '10px 12px', flexShrink: 0 }}>
            <div className="stub-section-title">ENVIRONMENT</div>
            <div className="sh-env-row">
              <div className="sh-env-item">
                <span className="sh-env-icon">🌡️</span>
                <span className="sh-env-value" style={{ color: '#FFAB40' }}>{temp}°C</span>
                <span className="sh-env-label">Temp</span>
              </div>
              <div className="sh-env-item">
                <span className="sh-env-icon">💧</span>
                <span className="sh-env-value" style={{ color: '#448AFF' }}>{humidity}%</span>
                <span className="sh-env-label">Humidity</span>
              </div>
              <div className="sh-env-item">
                <span className="sh-env-icon">🌿</span>
                <span className="sh-env-value" style={{ color: '#00E676', fontSize: 9 }}>{airQ}</span>
                <span className="sh-env-label">Air Quality</span>
              </div>
              <div className="sh-env-item">
                <span className="sh-env-icon">🌬️</span>
                <span className="sh-env-value" style={{ color: '#00B4D8' }}>{co2}</span>
                <span className="sh-env-label">CO₂ ppm</span>
              </div>
              <div className="sh-env-item">
                <span className="sh-env-icon">🔊</span>
                <span className="sh-env-value" style={{ color: '#7B2FBE' }}>{noise} dB</span>
                <span className="sh-env-label">Noise</span>
              </div>
            </div>
          </Card>
        </div>

        {/* ──────────── RIGHT ──────────── */}
        <div className="sh-col-right">

          {/* SECURITY CAMERAS */}
          <Card style={{ padding: '10px 12px', flexShrink: 0 }}>
            <div className="stub-section-title">SECURITY CAMERAS</div>
            <div className="sh-cameras-grid">
              {CAMERA_THUMBS.map(cam => (
                <div key={cam.name} className="sh-camera-thumb">
                  <div className="sh-camera-thumb__icon">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                      <path d="M15 10l4.553-2.276A1 1 0 0121 8.723v6.554a1 1 0 01-1.447.894L15 14M3 8h12a2 2 0 012 2v4a2 2 0 01-2 2H3a2 2 0 01-2-2v-4a2 2 0 012-2z" stroke="#8888AA" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                  <div className="sh-camera-thumb__name">{cam.name}</div>
                  <div className="sh-camera-live">LIVE</div>
                  <div className="sh-camera-phase3">Phase 3</div>
                </div>
              ))}
            </div>
            <div className="sh-view-cameras">View All Cameras →</div>
          </Card>

          {/* ENERGY MONITOR */}
          <Card style={{ padding: '10px 12px', flexShrink: 0 }}>
            <div className="stub-section-title">ENERGY MONITOR</div>
            <div className="sh-energy-body">
              <CircularGauge
                value={30}
                label="Total kWh"
                sublabel={`${kwh} kWh`}
                size={100}
                color="#FFAB40"
                unit=""
                warnAt={80}
                critAt={95}
              />
              <div className="sh-energy-stats">
                <div className="sh-energy-cost">Est. Cost: ${cost}</div>
                <div className="sh-energy-efficiency">Efficiency: 85%</div>
              </div>
              {/* Mini bar chart */}
              <div className="sh-energy-bars">
                <svg width="100" height="30" viewBox="0 0 100 30">
                  {ENERGY_BARS.map((bar, i) => {
                    const barH = (bar.value / 100) * 26;
                    const x = i * 20 + 2;
                    return (
                      <g key={bar.day}>
                        <rect
                          x={x}
                          y={30 - barH - 2}
                          width="14"
                          height={barH}
                          rx="2"
                          fill="#FFAB40"
                          opacity="0.75"
                        />
                        <text x={x + 7} y={30} textAnchor="middle" fill="#8888AA" fontSize="7" fontFamily="var(--font-mono)">
                          {bar.day}
                        </text>
                      </g>
                    );
                  })}
                </svg>
              </div>
            </div>
          </Card>

          {/* RECENT ACTIVITY */}
          <Card style={{ padding: '10px 12px', flex: 1 }}>
            <div className="stub-section-title">RECENT ACTIVITY</div>
            <div className="sh-activity-list">
              {RECENT_ACTIVITY.map((item, i) => (
                <div key={i} className="sh-activity-item">
                  <div className="sh-activity-icon" style={{ background: item.color }}>
                    {item.icon}
                  </div>
                  <div className="sh-activity-info">
                    <div className="sh-activity-name">{item.name}</div>
                    <div className="sh-activity-desc">{item.desc}</div>
                  </div>
                  <div className="sh-activity-time">{item.time}</div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
