const config = require('../config');
const db = require('./database');
const { processPendingGeocodes } = require('./geocoder');

// Parse the Tampa date format "M/D/YYYY H:MM:SS AM/PM" to ISO
function parseDispatchedDate(dateStr) {
  // Handle format: "1/22/2026 4:38:41 PM"
  const match = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2}):(\d{2})\s+(AM|PM)$/i);

  if (!match) {
    console.warn(`Could not parse date: ${dateStr}`);
    return new Date().toISOString();
  }

  let [, month, day, year, hours, minutes, seconds, ampm] = match;

  hours = parseInt(hours);
  if (ampm.toUpperCase() === 'PM' && hours !== 12) {
    hours += 12;
  } else if (ampm.toUpperCase() === 'AM' && hours === 12) {
    hours = 0;
  }

  const date = new Date(year, month - 1, day, hours, minutes, seconds);
  return date.toISOString();
}

// Fetch incidents from the Tampa feed
async function fetchFeed() {
  console.log(`Fetching feed from ${config.feedUrl}...`);

  try {
    const fetch = (await import('node-fetch')).default;
    const response = await fetch(config.feedUrl, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'TampaIncidentsMap/1.0'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    console.log(`Fetched ${data.length} incidents from feed`);

    return data;
  } catch (error) {
    console.error('Error fetching feed:', error.message);
    throw error;
  }
}

// Transform feed data to database format
function transformIncident(item) {
  return {
    report: item.Report,
    dispatched: parseDispatchedDate(item.Dispatched),
    description: item.Description,
    address: item.Address,
    grid: item.Grid,
    mapLink: item.MapLink
  };
}

// Fetch feed and store new incidents
async function fetchAndStore() {
  try {
    const feedData = await fetchFeed();
    const incidents = feedData.map(transformIncident);

    const inserted = db.insertIncidents(incidents);
    console.log(`Inserted ${inserted} new incidents`);

    // Process geocoding for new incidents
    if (inserted > 0) {
      await processPendingGeocodes(inserted + 10); // Process new + some backlog
    }

    return { fetched: feedData.length, inserted };
  } catch (error) {
    console.error('Error in fetchAndStore:', error.message);
    return { fetched: 0, inserted: 0, error: error.message };
  }
}

module.exports = {
  fetchFeed,
  fetchAndStore,
  transformIncident,
  parseDispatchedDate
};
