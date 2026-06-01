import './MiniMediaBar.css';
import { useStore } from '../store/StoreContext';

function calcPositionPct(pos, dur) {
  function toSec(t) {
    if (!t || t === '--') return 0;
    const parts = t.split(':').map(Number);
    return parts.length === 2 ? parts[0] * 60 + parts[1] : 0;
  }
  const p = toSec(pos);
  const d = toSec(dur);
  return d > 0 ? (p / d) * 100 : 0;
}

export default function MiniMediaBar() {
  const { getState } = useStore();
  const track = getState('media.track');
  const artist = getState('media.artist');
  const playing = getState('media.playing') === 'true';
  const position = getState('media.position');
  const duration = getState('media.duration');
  const pct = calcPositionPct(position, duration);

  return (
    <div className="cd-media-bar">
      {/* Album art */}
      <div className="cd-media-bar__art">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
          <path d="M9 18V5l12-2v13M9 18a3 3 0 01-3-3c0-1.657 1.343-3 3-3s3 1.343 3 3c0 1.657-1.343 3-3 3zm12-2a3 3 0 01-3-3c0-1.657 1.343-3 3-3s3 1.343 3 3c0 1.657-1.343 3-3 3z" stroke="#00B4D8" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
      </div>

      {/* Track info */}
      <div className="cd-media-bar__info">
        <span className="cd-media-bar__track">{track}</span>
        <span className="cd-media-bar__artist">{artist}</span>
      </div>

      {/* Waveform */}
      <div className={`cd-media-bar__waveform ${playing ? 'cd-media-bar__waveform--playing' : ''}`}>
        {[1,2,3,4,5].map(i => (
          <span key={i} className="cd-media-bar__wave-bar" style={{ animationDelay: `${(i-1) * 0.12}s` }} />
        ))}
      </div>

      {/* Controls */}
      <div className="cd-media-bar__controls">
        <button className="cd-media-bar__btn" title="Previous">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <path d="M19 20L9 12l10-8v16zM5 4v16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
        <button className="cd-media-bar__btn cd-media-bar__btn--play" title={playing ? 'Pause' : 'Play'}>
          {playing ? (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <rect x="6" y="4" width="4" height="16" rx="1"/>
              <rect x="14" y="4" width="4" height="16" rx="1"/>
            </svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <path d="M5 3l14 9-14 9V3z"/>
            </svg>
          )}
        </button>
        <button className="cd-media-bar__btn" title="Next">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <path d="M5 4l10 8-10 8V4zM19 4v16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </div>

      {/* Progress */}
      <div className="cd-media-bar__progress-area">
        <span className="cd-media-bar__time">{position}</span>
        <div className="cd-media-bar__progress-track">
          <div className="cd-media-bar__progress-fill" style={{ width: `${pct}%` }} />
        </div>
        <span className="cd-media-bar__time">{duration}</span>
      </div>
    </div>
  );
}
