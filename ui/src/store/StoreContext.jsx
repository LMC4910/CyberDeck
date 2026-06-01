import { createContext, useContext, useState } from 'react';
import { mockStates, sparklineData, notifications, rooms, devices, scenes, games, processes, storageDisks, systemAlerts } from './mockData';

const StoreContext = createContext(null);

export function StoreProvider({ children }) {
  const [states] = useState(mockStates);
  function getState(key) { return states[key] ?? '--'; }
  return (
    <StoreContext.Provider value={{ states, getState, sparklineData, notifications, rooms, devices, scenes, games, processes, storageDisks, systemAlerts }}>
      {children}
    </StoreContext.Provider>
  );
}

export function useStore() { return useContext(StoreContext); }
