import { useEffect } from 'react';
import './AppLayout.css';
import Sidebar from './Sidebar';
import Header from './Header';
import MiniMediaBar from './MiniMediaBar';
import NotificationCenter from '../pages/NotificationCenter';
import { useStore } from '../store/StoreContext';

const PAGE_TITLES = {
  dashboard: { title: 'Home Dashboard', subtitle: 'Good evening! Everything is running smoothly.' },
  system: { title: 'System Control', subtitle: 'Manage your system performance and utilities' },
  media: { title: 'Media Center', subtitle: 'Your audio, video and streaming hub' },
  gaming: { title: 'Gaming Hub', subtitle: 'Launch, change and optimize your games' },
  smarthome: { title: 'Smart Home', subtitle: 'Control and monitor your home environment' },
  overview: { title: 'System Overview', subtitle: 'Monitor and analyze your system in real time' },
  settings: { title: 'Settings', subtitle: 'Configure CyberDeck' },
};

export default function AppLayout({ children, activePage, onNavigate, showNotifications, setShowNotifications }) {
  const { getState } = useStore();
  const pageInfo = PAGE_TITLES[activePage] || PAGE_TITLES.dashboard;
  const showMediaBar = activePage !== 'dashboard';

  useEffect(() => {
    function updateScale() {
      const canvas = document.querySelector('.app-canvas');
      if (!canvas) return;
      const scaleX = window.innerWidth / 1280;
      const scaleY = window.innerHeight / 800;
      const scale = Math.min(scaleX, scaleY);
      canvas.style.transform = `scale(${scale})`;
      canvas.style.marginTop = `${(window.innerHeight - 800 * scale) / 2}px`;
    }
    updateScale();
    window.addEventListener('resize', updateScale);
    return () => window.removeEventListener('resize', updateScale);
  }, []);

  return (
    <div className="app-scale-wrapper">
      <div className="app-canvas">
        <Sidebar activePage={activePage} onNavigate={onNavigate} notifyCount={getState('notify.count')} />
        <div className="app-main">
          <Header
            title={pageInfo.title}
            subtitle={pageInfo.subtitle}
            notifyCount={getState('notify.count')}
            onNotificationClick={() => setShowNotifications(prev => !prev)}
          />
          <div className="app-content">
            {children}
          </div>
          {showMediaBar && <MiniMediaBar />}
        </div>
        {showNotifications && (
          <NotificationCenter onClose={() => setShowNotifications(false)} />
        )}
      </div>
    </div>
  );
}
