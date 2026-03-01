const cron = require('node-cron');
const config = require('../config');
const { fetchAndStore } = require('./fetcher');
const { processPendingGeocodes } = require('./geocoder');

let fetchJob = null;
let geocodeJob = null;

// Start the scheduled jobs
function start() {
  const interval = config.fetchIntervalMinutes;

  // Schedule feed fetching
  // Run every hour at minute 0
  fetchJob = cron.schedule(`0 */${interval < 60 ? 1 : Math.floor(interval / 60)} * * *`, async () => {
    console.log(`[${new Date().toISOString()}] Running scheduled feed fetch...`);
    const result = await fetchAndStore();
    console.log(`[${new Date().toISOString()}] Fetch complete:`, result);
  });

  // Run geocoding for any backlog every 5 minutes
  geocodeJob = cron.schedule('*/5 * * * *', async () => {
    console.log(`[${new Date().toISOString()}] Running geocode backlog processing...`);
    const result = await processPendingGeocodes(20);
    console.log(`[${new Date().toISOString()}] Geocode complete:`, result);
  });

  console.log(`Scheduler started: fetching every ${interval} minutes`);
}

// Stop the scheduled jobs
function stop() {
  if (fetchJob) {
    fetchJob.stop();
    fetchJob = null;
  }
  if (geocodeJob) {
    geocodeJob.stop();
    geocodeJob = null;
  }
  console.log('Scheduler stopped');
}

// Run an immediate fetch (useful for testing/startup)
async function runNow() {
  console.log('Running immediate fetch...');
  return await fetchAndStore();
}

module.exports = {
  start,
  stop,
  runNow
};
