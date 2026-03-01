const express = require('express');
const path = require('path');
const config = require('../config');
const db = require('./database');
const scheduler = require('./scheduler');
const { fetchAndStore } = require('./fetcher');

const app = express();

// Serve static files
app.use(express.static(path.join(__dirname, '../public')));

// API: Get configuration (for frontend)
app.get('/api/config', (req, res) => {
  res.json({
    gridColors: config.gridColors,
    colors: config.colors,
    mapCenter: config.mapCenter
  });
});

// API: Get incidents with filters
app.get('/api/incidents', (req, res) => {
  try {
    const {
      startDate,
      endDate,
      descriptions,
      grids
    } = req.query;

    // Default to last 7 days if no dates provided
    const end = endDate || new Date().toISOString();
    const start = startDate || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const filters = {
      startDate: start,
      endDate: end
    };

    if (descriptions) {
      filters.descriptions = descriptions.split(',').filter(d => d.trim());
    }

    if (grids) {
      filters.grids = grids.split(',').filter(g => g.trim());
    }

    const incidents = db.getIncidents(filters);

    // Add color based on grid
    const incidentsWithColor = incidents.map(incident => ({
      ...incident,
      color: getGridColor(incident.grid)
    }));

    res.json(incidentsWithColor);
  } catch (error) {
    console.error('Error fetching incidents:', error);
    res.status(500).json({ error: 'Failed to fetch incidents' });
  }
});

// API: Get unique descriptions for filter dropdown
app.get('/api/descriptions', (req, res) => {
  try {
    const descriptions = db.getDescriptions();
    res.json(descriptions);
  } catch (error) {
    console.error('Error fetching descriptions:', error);
    res.status(500).json({ error: 'Failed to fetch descriptions' });
  }
});

// API: Get unique grids
app.get('/api/grids', (req, res) => {
  try {
    const grids = db.getGrids();
    res.json(grids);
  } catch (error) {
    console.error('Error fetching grids:', error);
    res.status(500).json({ error: 'Failed to fetch grids' });
  }
});

// API: Get database stats
app.get('/api/stats', (req, res) => {
  try {
    const stats = db.getStats();
    res.json(stats);
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// API: Trigger manual fetch (for testing)
app.post('/api/fetch', async (req, res) => {
  try {
    const result = await fetchAndStore();
    res.json(result);
  } catch (error) {
    console.error('Error in manual fetch:', error);
    res.status(500).json({ error: 'Failed to fetch' });
  }
});

// Determine color for a grid number
function getGridColor(grid) {
  const { gridColors, colors } = config;

  if (gridColors.red.includes(grid)) {
    return colors.red;
  }
  if (gridColors.yellow.includes(grid)) {
    return colors.yellow;
  }
  return colors.blue;
}

// Start server
const port = config.port;
app.listen(port, async () => {
  console.log(`Tampa Incidents Map server running on http://localhost:${port}`);

  // Run initial fetch on startup
  console.log('Running initial data fetch...');
  await fetchAndStore();

  // Start scheduled jobs
  scheduler.start();
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down...');
  scheduler.stop();
  db.close();
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down...');
  scheduler.stop();
  db.close();
  process.exit(0);
});
