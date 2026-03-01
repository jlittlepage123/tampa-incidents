const Database = require('better-sqlite3');
const path = require('path');
const config = require('../config');

// Ensure data directory exists
const fs = require('fs');
const dbDir = path.dirname(config.dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new Database(config.dbPath);

// Enable WAL mode for better concurrent access
db.pragma('journal_mode = WAL');

// Initialize schema
db.exec(`
  CREATE TABLE IF NOT EXISTS incidents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    report TEXT UNIQUE NOT NULL,
    dispatched DATETIME NOT NULL,
    description TEXT NOT NULL,
    address TEXT NOT NULL,
    grid TEXT NOT NULL,
    map_link TEXT,
    latitude REAL,
    longitude REAL,
    geocode_status TEXT DEFAULT 'pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS idx_dispatched ON incidents(dispatched);
  CREATE INDEX IF NOT EXISTS idx_grid ON incidents(grid);
  CREATE INDEX IF NOT EXISTS idx_description ON incidents(description);
  CREATE INDEX IF NOT EXISTS idx_geocode_status ON incidents(geocode_status);
`);

// Prepared statements for performance
const statements = {
  insertIncident: db.prepare(`
    INSERT OR IGNORE INTO incidents (report, dispatched, description, address, grid, map_link)
    VALUES (@report, @dispatched, @description, @address, @grid, @mapLink)
  `),

  updateGeocode: db.prepare(`
    UPDATE incidents
    SET latitude = @latitude, longitude = @longitude, geocode_status = @status, updated_at = CURRENT_TIMESTAMP
    WHERE id = @id
  `),

  getPendingGeocode: db.prepare(`
    SELECT id, address, grid FROM incidents
    WHERE geocode_status = 'pending'
    ORDER BY dispatched DESC
    LIMIT ?
  `),

  getIncidents: db.prepare(`
    SELECT * FROM incidents
    WHERE dispatched BETWEEN @startDate AND @endDate
    AND latitude IS NOT NULL
    ORDER BY dispatched DESC
  `),

  getIncidentsByDescription: db.prepare(`
    SELECT * FROM incidents
    WHERE dispatched BETWEEN @startDate AND @endDate
    AND latitude IS NOT NULL
    AND description IN (SELECT value FROM json_each(@descriptions))
    ORDER BY dispatched DESC
  `),

  getDescriptions: db.prepare(`
    SELECT DISTINCT description FROM incidents ORDER BY description
  `),

  getGrids: db.prepare(`
    SELECT DISTINCT grid FROM incidents ORDER BY CAST(grid AS INTEGER)
  `),

  getStats: db.prepare(`
    SELECT
      COUNT(*) as total,
      COUNT(CASE WHEN latitude IS NOT NULL THEN 1 END) as geocoded,
      COUNT(CASE WHEN geocode_status = 'pending' THEN 1 END) as pending,
      MIN(dispatched) as earliest,
      MAX(dispatched) as latest,
      MAX(created_at) as lastUpdate
    FROM incidents
  `)
};

module.exports = {
  db,

  // Insert a new incident (ignores duplicates based on report number)
  insertIncident(incident) {
    return statements.insertIncident.run(incident);
  },

  // Bulk insert incidents
  insertIncidents(incidents) {
    const insert = db.transaction((items) => {
      let inserted = 0;
      for (const item of items) {
        const result = statements.insertIncident.run(item);
        if (result.changes > 0) inserted++;
      }
      return inserted;
    });
    return insert(incidents);
  },

  // Update geocode data for an incident
  updateGeocode(id, latitude, longitude, status = 'success') {
    return statements.updateGeocode.run({ id, latitude, longitude, status });
  },

  // Get incidents that need geocoding
  getPendingGeocode(limit = 50) {
    return statements.getPendingGeocode.all(limit);
  },

  // Get incidents with filters
  getIncidents({ startDate, endDate, descriptions = null, grids = null }) {
    let query = `
      SELECT * FROM incidents
      WHERE dispatched BETWEEN ? AND ?
      AND latitude IS NOT NULL
    `;
    const params = [startDate, endDate];

    if (descriptions && descriptions.length > 0) {
      query += ` AND description IN (${descriptions.map(() => '?').join(',')})`;
      params.push(...descriptions);
    }

    if (grids && grids.length > 0) {
      query += ` AND grid IN (${grids.map(() => '?').join(',')})`;
      params.push(...grids);
    }

    query += ' ORDER BY dispatched DESC';

    return db.prepare(query).all(...params);
  },

  // Get unique descriptions for filter dropdown
  getDescriptions() {
    return statements.getDescriptions.all().map(row => row.description);
  },

  // Get unique grids
  getGrids() {
    return statements.getGrids.all().map(row => row.grid);
  },

  // Get database stats
  getStats() {
    return statements.getStats.get();
  },

  // Close database connection
  close() {
    db.close();
  }
};
