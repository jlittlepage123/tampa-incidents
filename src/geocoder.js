const config = require('../config');
const db = require('./database');

// Rate limiting: track last request time
let lastRequestTime = 0;
const minInterval = 1000 / config.geocodeRateLimit; // milliseconds between requests

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Normalize Tampa addresses for better geocoding results
function normalizeAddress(address) {
  let normalized = address
    .replace(/\s+BLOCK\s+/i, ' ')  // Remove "BLOCK"
    .replace(/\s+/g, ' ')          // Normalize whitespace
    .trim();

  // Add Tampa, FL if not present
  if (!normalized.toLowerCase().includes('tampa')) {
    normalized += ', Tampa, FL';
  }

  return normalized;
}

// Geocode a single address using Nominatim
async function geocodeAddress(address) {
  // Rate limiting
  const now = Date.now();
  const elapsed = now - lastRequestTime;
  if (elapsed < minInterval) {
    await sleep(minInterval - elapsed);
  }
  lastRequestTime = Date.now();

  const normalizedAddress = normalizeAddress(address);
  const { tampaBounds } = config;

  const params = new URLSearchParams({
    q: normalizedAddress,
    format: 'json',
    limit: '1',
    viewbox: `${tampaBounds.west},${tampaBounds.north},${tampaBounds.east},${tampaBounds.south}`,
    bounded: '1'
  });

  const url = `https://nominatim.openstreetmap.org/search?${params}`;

  try {
    const fetch = (await import('node-fetch')).default;
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'TampaIncidentsMap/1.0 (local deployment)'
      }
    });

    if (!response.ok) {
      throw new Error(`Geocoding HTTP error: ${response.status}`);
    }

    const results = await response.json();

    if (results.length > 0) {
      return {
        latitude: parseFloat(results[0].lat),
        longitude: parseFloat(results[0].lon),
        status: 'success'
      };
    }

    // Try again without bounding box
    const unboundedParams = new URLSearchParams({
      q: normalizedAddress,
      format: 'json',
      limit: '1'
    });

    const unboundedResponse = await fetch(
      `https://nominatim.openstreetmap.org/search?${unboundedParams}`,
      {
        headers: {
          'User-Agent': 'TampaIncidentsMap/1.0 (local deployment)'
        }
      }
    );

    const unboundedResults = await unboundedResponse.json();

    if (unboundedResults.length > 0) {
      const lat = parseFloat(unboundedResults[0].lat);
      const lon = parseFloat(unboundedResults[0].lon);

      // Verify result is within Tampa area (with some buffer)
      if (lat >= tampaBounds.south - 0.1 && lat <= tampaBounds.north + 0.1 &&
          lon >= tampaBounds.west - 0.1 && lon <= tampaBounds.east + 0.1) {
        return {
          latitude: lat,
          longitude: lon,
          status: 'success'
        };
      }
    }

    return { latitude: null, longitude: null, status: 'not_found' };
  } catch (error) {
    console.error(`Geocoding error for "${address}":`, error.message);
    return { latitude: null, longitude: null, status: 'error' };
  }
}

// Process pending geocoding requests
async function processPendingGeocodes(limit = 50) {
  const pending = db.getPendingGeocode(limit);
  console.log(`Processing ${pending.length} pending geocode requests...`);

  let success = 0;
  let failed = 0;

  for (const incident of pending) {
    const result = await geocodeAddress(incident.address);

    db.updateGeocode(
      incident.id,
      result.latitude,
      result.longitude,
      result.status
    );

    if (result.status === 'success') {
      success++;
    } else {
      failed++;
    }
  }

  console.log(`Geocoding complete: ${success} success, ${failed} failed`);
  return { success, failed };
}

module.exports = {
  geocodeAddress,
  processPendingGeocodes,
  normalizeAddress
};
