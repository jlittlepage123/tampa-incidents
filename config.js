module.exports = {
  // Feed configuration
  feedUrl: 'https://ncapps.tampagov.net/callsforservice/TPD/Json',
  fetchIntervalMinutes: parseInt(process.env.FETCH_INTERVAL_MINUTES) || 60,

  // Grid highlighting - priority order (first match wins)
  // Override via env vars: GRID_RED and GRID_YELLOW (comma-separated grid numbers)
  gridColors: {
    red: (process.env.GRID_RED || '152').split(',').map(s => s.trim()),
    yellow: (process.env.GRID_YELLOW || '120,136,151,153,157,158,159').split(',').map(s => s.trim()),
    blue: []                                           // Default for all others
  },

  // Map center - defaults to Tampa Police Grid 152 centroid
  // Override via env vars: MAP_CENTER_LAT, MAP_CENTER_LNG, MAP_CENTER_ZOOM
  mapCenter: {
    lat: parseFloat(process.env.MAP_CENTER_LAT) || 27.947281,
    lng: parseFloat(process.env.MAP_CENTER_LNG) || -82.499440,
    zoom: parseInt(process.env.MAP_CENTER_ZOOM) || 14
  },

  // Pin colors (CSS/Leaflet compatible) - bright, high-visibility
  colors: {
    red: '#EF4444',
    yellow: '#FBBF24',
    blue: '#3B82F6'
  },

  // Server configuration
  port: parseInt(process.env.PORT) || 3000,

  // Database path
  dbPath: process.env.DB_PATH || './data/incidents.db',

  // Geocoding rate limit (requests per second)
  geocodeRateLimit: 1,

  // Tampa bounding box for geocoding (helps accuracy)
  tampaBounds: {
    south: 27.82,
    north: 28.17,
    west: -82.65,
    east: -82.25
  }
};
