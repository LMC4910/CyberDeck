/** Full entry.tp manifest for com.shishir.cyberdeck — based on doc 03 spec. */
const ID = 'com.shishir.cyberdeck';

// ─── helpers ────────────────────────────────────────────────────────────────

function state(suffix, desc, defaultVal = '--', type = 'text', choices) {
  const s = { id: `${ID}.${suffix}`, type, desc: `CyberDeck · ${desc}`, default: defaultVal };
  if (choices) s.valueChoices = choices;
  return s;
}

function action(suffix, name, lineFormat, dataFields = [], type = 'communicate') {
  const a = {
    id: `${ID}.act.${suffix}`,
    name,
    type,
    lines: {
      action: [{ language: 'default', data: [{ lineFormat }] }],
    },
    data: dataFields,
  };
  if (type === 'execute') {
    delete a.lines;
    delete a.data;
  }
  return a;
}

function launchAction(suffix, name, cmd) {
  return { id: `${ID}.act.${suffix}`, name, type: 'execute', execution_cmd: cmd };
}

function connector(suffix, name) {
  return {
    id: `${ID}.con.${suffix}`,
    name,
    format: `CyberDeck: ${name}`,
    supportedTypes: ['slider', 'dial'],
  };
}

function event(suffix, name, format, valueType, valueChoices, valueStateId) {
  return {
    id: `${ID}.evt.${suffix}`,
    name,
    format,
    type: 'communicate',
    valueType,
    valueChoices,
    valueStateId: `${ID}.${valueStateId}`,
  };
}

// ─── states ─────────────────────────────────────────────────────────────────

const systemStates = [
  state('system.cpu.load',       'CPU load %',           '--'),
  state('system.cpu.temp',       'CPU temperature °C',   '--'),
  state('system.cpu.frequency',  'CPU frequency',        '--'),
  state('system.cpu.cores',      'CPU cores',            '--'),
  state('system.cpu.threads',    'CPU threads',          '--'),
  state('system.cpu.model',      'CPU model name',       '--'),
  state('system.cpu.thermal_state', 'CPU thermal state', 'normal', 'choice', ['normal','warning','critical']),
  state('system.gpu.load',       'GPU load %',           '--'),
  state('system.gpu.temp',       'GPU temperature °C',   '--'),
  state('system.gpu.model',      'GPU model name',       '--'),
  state('system.gpu.driver',     'GPU driver version',   '--'),
  state('system.gpu.vram.used',  'GPU VRAM used GB',     '--'),
  state('system.gpu.vram.total', 'GPU VRAM total GB',    '--'),
  state('system.gpu.thermal_state', 'GPU thermal state', 'normal', 'choice', ['normal','warning','critical']),
  state('system.ram.used',       'RAM used GB',          '--'),
  state('system.ram.available',  'RAM available GB',     '--'),
  state('system.ram.percent',    'RAM usage %',          '--'),
  state('system.ram.total',      'RAM total GB',         '--'),
  state('system.ram.spec',       'RAM spec string',      '--'),
  state('system.ram.alert',      'RAM alert state',      'normal', 'choice', ['normal','warning','critical']),
  state('system.storage.used_tb','Storage used TB',      '--'),
  state('system.storage.free_tb','Storage free TB',      '--'),
  state('system.storage.alert',  'Storage alert state',  'normal', 'choice', ['normal','warning','critical']),
  state('system.network.download','Network download Mbps','--'),
  state('system.network.upload', 'Network upload Mbps',  '--'),
  state('system.network.ping',   'Network ping ms',      '--'),
  state('system.network.status', 'Network status',       'online', 'choice', ['online','offline']),
  state('system.uptime',         'System uptime',        '--'),
  state('system.health.score',   'System health score',  '--'),
  state('system.os',             'Operating system',     '--'),
  state('system.motherboard',    'Motherboard',          '--'),
  state('system.type',           'System type',          '--'),
  state('system.powerplan',      'Active power plan',    'Balanced', 'choice', ['Silent','Balanced','Performance','Turbo']),
  state('plugin.status',         'Plugin connection status', 'disconnected', 'choice', ['connected','disconnected','error']),
  // Tile (image) states for rendered gauges
  state('tile.dash.cpu_gauge',   'Dashboard CPU gauge (base64 PNG)', ''),
  state('tile.dash.gpu_gauge',   'Dashboard GPU gauge (base64 PNG)', ''),
  state('tile.dash.ram_gauge',   'Dashboard RAM gauge (base64 PNG)', ''),
  state('tile.system.net_down_spark', 'Network download sparkline (base64 PNG)', ''),
  state('tile.system.net_up_spark',   'Network upload sparkline (base64 PNG)',   ''),
  state('tile.overview.perf_chart',   'System performance chart (base64 PNG)',   ''),
  state('tile.overview.storage_donut','Storage donut chart (base64 PNG)',        ''),
];

const mediaStates = [
  state('media.track',          'Now playing track title',   '--'),
  state('media.artist',         'Now playing artist',        '--'),
  state('media.album',          'Now playing album',         '--'),
  state('media.duration',       'Track duration MM:SS',      '--'),
  state('media.position',       'Track position MM:SS',      '--'),
  state('media.playing',        'Media playing (true/false)','false'),
  state('media.albumart.b64',   'Album art now-playing card (base64 PNG)', ''),
  state('media.volume.system',  'System master volume 0-100','70'),
  state('media.volume.spotify', 'Spotify app volume 0-100',  '65'),
  state('media.volume.mic',     'Microphone level 0-100',    '80'),
  state('media.shuffle',        'Shuffle state (true/false)','false'),
  state('media.repeat',         'Repeat state (true/false)', 'false'),
  state('tile.media.nowplaying','Media now-playing card (base64 PNG)', ''),
];

const gamingStates = [
  state('gaming.fps',           'Live FPS',                 '--'),
  state('gaming.currentgame',   'Current game name',        '--'),
  state('gaming.mode',          'Active game profile',      'Balanced', 'choice', ['Competitive','AAA','Streaming','Battery Saver']),
  state('gaming.recording',     'Recording active (true/false)', 'false'),
  state('gaming.network.ping',  'Game network ping ms',     '--'),
  state('gaming.network.download', 'Game network download Mbps', '--'),
  state('gaming.network.upload',   'Game network upload Mbps',   '--'),
  state('gaming.fps_state',     'FPS alert state',          'normal', 'choice', ['normal','warning','critical']),
  state('tile.gaming.fps_spark','FPS sparkline (base64 PNG)', ''),
];

const homeStates = [
  state('home.env.temperature', 'Environment temperature °C', '--'),
  state('home.env.humidity',    'Environment humidity %',     '--'),
  state('home.env.air_quality', 'Air quality label',          '--'),
  state('home.env.co2',         'CO₂ ppm',                   '--'),
  state('home.env.noise',       'Noise level dB',             '--'),
  state('home.energy.kwh',      'Energy total kWh',           '--'),
  state('home.energy.cost',     'Energy estimated cost',      '--'),
  state('home.energy.efficiency','Energy efficiency %',       '--'),
  state('home.device.status',   'Last device status change',  '--'),
  state('tile.home.energy_chart','Energy chart (base64 PNG)', ''),
];

const notifyStates = [
  state('notify.count',          'Unread notification count', '0'),
  state('notify.latest.title',   'Latest notification title', '--'),
  state('notify.latest.source',  'Latest notification source','--'),
  state('notify.latest.time',    'Latest notification time',  '--'),
  state('notify.priority',       'Latest notification priority', 'low', 'choice', ['low','medium','high','critical']),
];

// ─── actions ────────────────────────────────────────────────────────────────

const systemActions = [
  action('system.power', 'System Power Action',
    'CyberDeck: power → {$mode$}',
    [{ id: 'mode', type: 'choice', label: 'Action', default: 'Lock',
       valueChoices: ['Shutdown','Restart','Sleep','Hibernate','Lock','Log Off'] }]
  ),
  action('system.performance', 'Set Performance Mode',
    'CyberDeck: performance → {$profile$}',
    [{ id: 'profile', type: 'choice', label: 'Mode', default: 'Balanced',
       valueChoices: ['Silent','Balanced','Performance','Turbo'] }]
  ),
  action('system.killprocess', 'Kill Process by PID',
    'CyberDeck: kill process {$pid$}',
    [{ id: 'pid', type: 'number', label: 'PID', default: '0' }]
  ),
  action('system.open', 'Open Windows Tool',
    'CyberDeck: open {$tool$}',
    [{ id: 'tool', type: 'choice', label: 'Tool', default: 'Task Manager',
       valueChoices: ['Task Manager','Control Panel','Device Manager','Windows Update',
                      'Services','Startup Apps','Programs & Features','Registry Editor',
                      'Event Viewer','Disk Management','System Information'] }]
  ),
  action('system.cache.clear', 'Clear File Cache', 'CyberDeck: clear cache', []),
  action('system.diskcleanup', 'Run Disk Cleanup',
    'CyberDeck: disk cleanup {$drive$}',
    [{ id: 'drive', type: 'text', label: 'Drive', default: 'C:' }]
  ),
  action('system.fan.set', 'Set Fan Speed',
    'CyberDeck: fan {$fan$} → {$level$}%',
    [
      { id: 'fan',   type: 'choice', label: 'Fan',   default: 'CPU Fan',
        valueChoices: ['CPU Fan','GPU Fan','Case Fan 1','Case Fan 2'] },
      { id: 'level', type: 'number', label: 'Speed %', default: '50' },
    ]
  ),
  launchAction('launch.steam',     'Launch Steam',     'cmd /c start steam://open/main'),
  launchAction('launch.epic',      'Launch Epic Games','cmd /c start com.epicgames.launcher://'),
  launchAction('launch.battlenet', 'Launch Battle.net','cmd /c start battlenet://'),
  launchAction('launch.xbox',      'Launch Xbox App',  'cmd /c start xbox://'),
  launchAction('launch.gog',       'Launch GOG Galaxy','cmd /c start goggalaxy://'),
];

const mediaActions = [
  action('media.play',     'Media Play',     'CyberDeck: media play', []),
  action('media.pause',    'Media Pause',    'CyberDeck: media pause', []),
  action('media.next',     'Media Next',     'CyberDeck: media next track', []),
  action('media.previous', 'Media Previous', 'CyberDeck: media previous track', []),
  action('media.shuffle',  'Media Toggle Shuffle', 'CyberDeck: toggle shuffle', []),
  action('media.repeat',   'Media Toggle Repeat',  'CyberDeck: toggle repeat', []),
  action('media.volume', 'Set Master Volume',
    'CyberDeck: master volume → {$level$}',
    [{ id: 'level', type: 'number', label: 'Volume %', default: '70' }]
  ),
  action('media.volume.spotify', 'Set Spotify Volume',
    'CyberDeck: Spotify volume → {$level$}',
    [{ id: 'level', type: 'number', label: 'Volume %', default: '65' }]
  ),
];

const gamingActions = [
  action('gaming.ram.clean', 'RAM Cleaner', 'CyberDeck: clean RAM working sets', []),
  action('gaming.mode', 'Set Game Profile',
    'CyberDeck: game profile → {$profile$}',
    [{ id: 'profile', type: 'choice', label: 'Profile', default: 'Competitive',
       valueChoices: ['Competitive','AAA','Streaming','Battery Saver'] }]
  ),
  action('gaming.screenshot', 'Capture Screenshot',
    'CyberDeck: screenshot → {$path$}',
    [{ id: 'path', type: 'text', label: 'Path (optional)', default: '' }]
  ),
  action('gaming.record', 'Toggle Clip Recording', 'CyberDeck: toggle recording', []),
  action('gaming.optimize', 'Toggle Optimization Feature',
    'CyberDeck: optimize {$feature$} → {$on$}',
    [
      { id: 'feature', type: 'choice', label: 'Feature', default: 'Performance',
        valueChoices: ['Performance','Network Boost','RAM Cleaner','Temperature Control','FPS Limiter'] },
      { id: 'on', type: 'switch', label: 'Enable', default: 'On' },
    ]
  ),
];

const homeActions = [
  action('home.light.toggle', 'Toggle Light',
    'CyberDeck: toggle light {$entity_id$}',
    [{ id: 'entity_id', type: 'text', label: 'Entity ID', default: 'light.living_room' }]
  ),
  action('home.light.brightness', 'Set Light Brightness',
    'CyberDeck: brightness {$entity_id$} → {$level$}%',
    [
      { id: 'entity_id', type: 'text',   label: 'Entity ID', default: 'light.living_room' },
      { id: 'level',     type: 'number', label: 'Brightness %', default: '80' },
    ]
  ),
  action('home.scene', 'Activate Scene',
    'CyberDeck: activate scene {$scene_id$}',
    [{ id: 'scene_id', type: 'text', label: 'Scene ID', default: 'scene.good_morning' }]
  ),
  action('home.device.toggle', 'Toggle Device',
    'CyberDeck: toggle device {$entity_id$}',
    [{ id: 'entity_id', type: 'text', label: 'Entity ID', default: 'switch.coffee_maker' }]
  ),
  action('home.climate.temp', 'Set Thermostat Temperature',
    'CyberDeck: climate {$entity_id$} → {$temp$}°C',
    [
      { id: 'entity_id', type: 'text',   label: 'Entity ID', default: 'climate.living_room' },
      { id: 'temp',      type: 'number', label: 'Temperature °C', default: '22' },
    ]
  ),
  action('home.camera.view', 'Open Camera Stream',
    'CyberDeck: view camera {$entity_id$}',
    [{ id: 'entity_id', type: 'text', label: 'Entity ID', default: 'camera.front_door' }]
  ),
];

const notifyActions = [
  action('notify.dismiss', 'Dismiss Notification',
    'CyberDeck: dismiss notification {$notif_id$}',
    [{ id: 'notif_id', type: 'text', label: 'Notification ID', default: '' }]
  ),
  action('notify.markallread', 'Mark All Notifications Read', 'CyberDeck: mark all read', []),
  action('notify.filter', 'Filter Notification Source',
    'CyberDeck: filter notifications → {$source$}',
    [{ id: 'source', type: 'choice', label: 'Source', default: 'All',
       valueChoices: ['All','System','Apps','Alerts','Messages'] }]
  ),
  action('notify.open', 'Open Notification Source App',
    'CyberDeck: open {$app$}',
    [{ id: 'app', type: 'text', label: 'App name', default: 'Discord' }]
  ),
];

// ─── connectors ─────────────────────────────────────────────────────────────

const connectors = [
  connector('volume_master',    'Master Volume'),
  connector('volume_spotify',   'Spotify Volume'),
  connector('volume_mic',       'Microphone Level'),
  connector('light_brightness', 'Light Brightness'),
  connector('fan_speed',        'Fan Speed'),
];

// ─── events ──────────────────────────────────────────────────────────────────

const events = [
  event('cpu_high_temp',  'When CPU temperature is high',
    'CyberDeck: CPU temp alert is $val', 'choice', ['normal','warning','critical'],
    'system.cpu.thermal_state'),
  event('gpu_high_temp',  'When GPU temperature is high',
    'CyberDeck: GPU temp alert is $val', 'choice', ['normal','warning','critical'],
    'system.gpu.thermal_state'),
  event('ram_high_usage', 'When RAM usage is high',
    'CyberDeck: RAM alert is $val',      'choice', ['normal','warning','critical'],
    'system.ram.alert'),
  event('storage_low',    'When storage is low',
    'CyberDeck: storage alert is $val',  'choice', ['normal','warning','critical'],
    'system.storage.alert'),
  event('network_down',   'When network is down',
    'CyberDeck: network status is $val', 'choice', ['online','offline'],
    'system.network.status'),
  event('track_changed',  'When media track changes',
    'CyberDeck: track changed to $val',  'text',   [],
    'media.track'),
  event('notification',   'When new notification arrives',
    'CyberDeck: notification from $val', 'text',   [],
    'notify.latest.source'),
  event('device_offline', 'When HA device goes offline',
    'CyberDeck: device status $val',     'text',   [],
    'home.device.status'),
  event('fps_low',        'When FPS drops below threshold',
    'CyberDeck: FPS state is $val',      'choice', ['normal','warning','critical'],
    'gaming.fps_state'),
  event('plugin_status',  'When plugin connection changes',
    'CyberDeck: plugin is $val',         'choice', ['connected','disconnected','error'],
    'plugin.status'),
];

// ─── settings ────────────────────────────────────────────────────────────────

const settings = [
  { name: 'Home Assistant URL',  type: 'text', default: 'http://homeassistant.local:8123' },
  { name: 'Ping Host',           type: 'text', default: '1.1.1.1' },
  { name: 'FPS Source',          type: 'text', default: 'auto' },
  { name: 'Tile Theme',          type: 'text', default: 'cyberpunk' },
];

// ─── build entry.tp ──────────────────────────────────────────────────────────

export function buildEntryTp() {
  return {
    sdk: 6,
    api: 12,
    version: 1,
    name: 'CyberDeck',
    id: ID,
    configuration: {
      colorDark: '#0D0D1A',
      colorLight: '#7B2FBE',
      parentCategory: 'system',
    },
    plugin_start_cmd_windows: `"%TP_PLUGIN_FOLDER%CyberDeck\\cyberdeck.exe"`,
    settingsDescription:
      'CyberDeck setup: configure Home Assistant URL for smart-home control, Ping Host for network monitoring, FPS Source for gaming stats (auto/presentmon/rtss), and Tile Theme (cyberpunk/minimal).',
    settings,
    categories: [
      {
        id: `${ID}.cat.system`,
        name: 'CyberDeck · System',
        imagepath: '%TP_PLUGIN_FOLDER%CyberDeck/assets/icons/cd_24.png',
        actions:    [...systemActions, ...gamingActions],
        connectors: connectors,
        states:     [...systemStates, ...gamingStates],
        events:     events,
      },
      {
        id: `${ID}.cat.media`,
        name: 'CyberDeck · Media',
        imagepath: '%TP_PLUGIN_FOLDER%CyberDeck/assets/icons/cd_24.png',
        actions:    mediaActions,
        connectors: [],
        states:     mediaStates,
        events:     [],
      },
      {
        id: `${ID}.cat.home`,
        name: 'CyberDeck · Smart Home',
        imagepath: '%TP_PLUGIN_FOLDER%CyberDeck/assets/icons/cd_24.png',
        actions:    homeActions,
        connectors: [],
        states:     homeStates,
        events:     [],
      },
      {
        id: `${ID}.cat.notify`,
        name: 'CyberDeck · Notifications',
        imagepath: '%TP_PLUGIN_FOLDER%CyberDeck/assets/icons/cd_24.png',
        actions:    notifyActions,
        connectors: [],
        states:     notifyStates,
        events:     [],
      },
    ],
  };
}
