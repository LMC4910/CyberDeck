// Keys match Touch Portal plugin state IDs from com.shishir.cyberdeck.*
// When backend is ready, replace these with real TP state updates.

export const mockStates = {
  // System telemetry
  'system.cpu.load': '28.4',
  'system.cpu.temp': '42.0',
  'system.cpu.frequency': '4.28 GHz',
  'system.cpu.cores': '8',
  'system.cpu.threads': '16',
  'system.cpu.model': 'Intel Core i9-13900K',
  'system.gpu.load': '67.0',
  'system.gpu.temp': '55.0',
  'system.gpu.model': 'NVIDIA RTX 4090 24GB',
  'system.gpu.driver': '546.33 WHQL',
  'system.gpu.vram.used': '7.4',
  'system.gpu.vram.total': '12.0',
  'system.ram.used': '10.2',
  'system.ram.available': '5.8',
  'system.ram.percent': '64.0',
  'system.ram.total': '16.0',
  'system.ram.spec': '16 GB DDR5-6000',
  'system.storage.used_tb': '2.91',
  'system.storage.free_tb': '2.11',
  'system.network.download': '125.6',
  'system.network.upload': '23.4',
  'system.network.ping': '8',
  'system.uptime': '2d 14h 36m',
  'system.health.score': '92',
  'system.powerplan': 'Balanced',
  'system.os': 'Windows 11 Pro',
  'system.motherboard': 'ASUS ROG MAXIMUS Z790',
  'system.type': '64-bit OS, x64 processor',
  // Media
  'media.track': 'Blinding Lights',
  'media.artist': 'The Weeknd',
  'media.album': 'After Hours',
  'media.duration': '3:20',
  'media.position': '1:24',
  'media.playing': 'true',
  'media.volume.system': '70',
  'media.volume.spotify': '65',
  'media.volume.mic': '80',
  'media.shuffle': 'false',
  'media.repeat': 'false',
  // Gaming
  'gaming.fps': '144',
  'gaming.currentgame': 'Cyberpunk 2077',
  'gaming.mode': 'Competitive',
  'gaming.network.ping': '18',
  'gaming.network.download': '125.6',
  'gaming.network.upload': '23.4',
  'gaming.recording': 'false',
  // Home
  'home.living_room.temp': '22',
  'home.living_room.devices': '5',
  'home.bedroom.temp': '20',
  'home.bedroom.devices': '3',
  'home.energy.kwh': '156',
  'home.energy.cost': '18.42',
  'home.env.temperature': '22.4',
  'home.env.humidity': '45',
  'home.env.air_quality': 'Good',
  'home.env.co2': '420',
  'home.env.noise': '38',
  // Notifications
  'notify.count': '6',
  'notify.latest.title': 'See you in stream!',
  'notify.latest.source': 'Discord',
  'notify.latest.time': '10:28 PM',
};

export const sparklineData = {
  cpuHistory: [20, 25, 28, 32, 28, 35, 42, 38, 30, 28, 26, 30],
  gpuHistory: [55, 60, 65, 72, 68, 67, 70, 65, 62, 67, 65, 67],
  ramHistory: [60, 62, 61, 63, 64, 62, 65, 64, 63, 64, 63, 64],
  networkDown: [80, 95, 110, 125, 118, 130, 125, 120, 115, 125, 122, 125],
  networkUp: [15, 18, 22, 25, 23, 24, 23, 22, 24, 23, 22, 23],
  fpsHistory: [138, 142, 145, 140, 144, 146, 143, 141, 144, 144, 145, 144],
  vramHistory: [55, 58, 60, 61, 62, 60, 61, 62, 61, 62, 61, 62],
  storageHistory: [50, 51, 52, 53, 54, 55, 55, 56, 57, 57, 57, 58],
};

export const notifications = [
  { id: 1, source: 'Discord', sourceColor: '#5865F2', title: 'See you in stream!', body: 'Check this out → blinding-lights... come watch the stream tonight', time: '10:22 AM', priority: 'high' },
  { id: 2, source: 'Spotify', sourceColor: '#1DB954', title: 'Now playing: Blinding Lights - The Weeknd', body: '', time: '10:20 AM', priority: 'low' },
  { id: 3, source: 'System Update', sourceColor: '#448AFF', title: 'Windows Update installed successfully', body: 'Restart required to complete installation', time: '10:18 AM', priority: 'medium' },
  { id: 4, source: 'Security Alert', sourceColor: '#FF5252', title: 'New sign-in from Chrome on Windows', body: 'New Activities from Account — Verify if this was you', time: '09:54 AM', priority: 'critical' },
  { id: 5, source: 'Hardware Monitor', sourceColor: '#7B2FBE', title: 'CPU temperature above 60%', body: 'Consider checking cooling solution', time: '09:42 AM', priority: 'warning' },
  { id: 6, source: 'Streamlabs', sourceColor: '#00B4D8', title: '3 new followers while streaming', body: 'GamerPro99, XStreamer, NightOwl42 followed', time: '09:30 AM', priority: 'low' },
];

export const rooms = [
  { id: 'living_room', name: 'Living Room', devices: 5, temp: '22°C', lightsOn: 2, active: true },
  { id: 'bedroom', name: 'Bedroom', devices: 3, temp: '20°C', lightsOn: 0, active: false },
  { id: 'kitchen', name: 'Kitchen', devices: 4, temp: '23°C', lightsOn: 1, active: true },
  { id: 'office', name: 'Office', devices: 6, temp: '21°C', lightsOn: 3, active: true },
  { id: 'bathroom', name: 'Bathroom', devices: 2, temp: '24°C', lightsOn: 0, active: false },
];

export const devices = [
  { id: 'd1', name: 'Ceiling Light', room: 'Living Room', type: 'light', on: true, brightness: 80 },
  { id: 'd2', name: 'Floor Lamp', room: 'Living Room', type: 'light', on: true, brightness: 60 },
  { id: 'd3', name: 'Smart TV', room: 'Living Room', type: 'switch', on: true },
  { id: 'd4', name: 'Bedroom Light', room: 'Bedroom', type: 'light', on: false, brightness: 0 },
  { id: 'd5', name: 'AC Unit', room: 'Office', type: 'climate', on: true },
  { id: 'd6', name: 'Over Light', room: 'Kitchen', type: 'light', on: true, brightness: 100 },
  { id: 'd7', name: 'Coffee Maker', room: 'Kitchen', type: 'plug', on: false },
];

export const scenes = [
  { id: 's1', name: 'Good Morning', icon: '🌅', actions: 3, color: '#FFAB40' },
  { id: 's2', name: 'Good Night', icon: '🌙', actions: 5, color: '#448AFF' },
  { id: 's3', name: 'Movie Time', icon: '🎬', actions: 4, color: '#7B2FBE' },
  { id: 's4', name: 'Party Mode', icon: '🎉', actions: 6, color: '#FF5252' },
  { id: 's5', name: 'Work Focus', icon: '💼', actions: 4, color: '#00B4D8' },
  { id: 's6', name: 'Away Mode', icon: '🏠', actions: 7, color: '#00E676' },
];

export const games = [
  { id: 1, name: 'Cyberpunk 2077', coverBg: 'linear-gradient(135deg, #FF2D55, #8B1538)', emoji: '🔮' },
  { id: 2, name: 'Forza Horizon 5', coverBg: 'linear-gradient(135deg, #FF6B35, #FF2D55)', emoji: '🚗' },
  { id: 3, name: 'Elden Ring', coverBg: 'linear-gradient(135deg, #8B7355, #4A3728)', emoji: '⚔️' },
  { id: 4, name: 'Red Dead Redemption 2', coverBg: 'linear-gradient(135deg, #8B2020, #3D0F0F)', emoji: '🤠' },
  { id: 5, name: 'Call of Duty: MW3', coverBg: 'linear-gradient(135deg, #2C3E50, #1A252F)', emoji: '🎯' },
  { id: 6, name: "Baldur's Gate 3", coverBg: 'linear-gradient(135deg, #4A1942, #2D0F2B)', emoji: '🐉' },
];

export const processes = [
  { name: 'cyberpunk2077.exe', cpu: 28.4, memory: 8420, status: 'Running' },
  { name: 'chrome.exe', cpu: 8.2, memory: 2340, status: 'Running' },
  { name: 'discord.exe', cpu: 2.1, memory: 890, status: 'Running' },
  { name: 'steam.exe', cpu: 1.4, memory: 450, status: 'Running' },
  { name: 'obs64.exe', cpu: 5.8, memory: 1200, status: 'Running' },
];

export const storageDisks = [
  { label: 'C: Windows (SSD)', used: 380, total: 500, color: '#7B2FBE' },
  { label: 'D: Games (SSD)', used: 1800, total: 2000, color: '#00B4D8' },
  { label: 'E: Backup (HDD)', used: 730, total: 4000, color: '#00E676' },
  { label: 'F: External (USB)', used: 120, total: 500, color: '#FFAB40' },
];

export const systemAlerts = [
  { id: 'a1', severity: 'info', message: 'System up-to-date as of today', time: '10:22 AM' },
  { id: 'a2', severity: 'warning', message: 'CPU temperature peaked at 72°C', time: '09:45 AM' },
  { id: 'a3', severity: 'success', message: 'GPU driver updated successfully', time: 'Yesterday' },
  { id: 'a4', severity: 'info', message: 'Disk cleanup freed 12.3 GB', time: '2 days ago' },
];
