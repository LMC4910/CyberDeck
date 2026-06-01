import { useState } from 'react';
import { StoreProvider } from './store/StoreContext';
import AppLayout from './layout/AppLayout';
import Dashboard from './pages/Dashboard';
import SystemControl from './pages/SystemControl';
import MediaCenter from './pages/MediaCenter';
import GamingHub from './pages/GamingHub';
import SmartHome from './pages/SmartHome';
import SystemOverview from './pages/SystemOverview';
import './App.css';

const PAGES = {
  dashboard: Dashboard,
  system: SystemControl,
  media: MediaCenter,
  gaming: GamingHub,
  smarthome: SmartHome,
  overview: SystemOverview,
};

export default function App() {
  const [activePage, setActivePage] = useState('dashboard');
  const [showNotifications, setShowNotifications] = useState(false);
  const PageComponent = PAGES[activePage] || Dashboard;
  return (
    <StoreProvider>
      <AppLayout
        activePage={activePage}
        onNavigate={setActivePage}
        showNotifications={showNotifications}
        setShowNotifications={setShowNotifications}
      >
        <PageComponent />
      </AppLayout>
    </StoreProvider>
  );
}
