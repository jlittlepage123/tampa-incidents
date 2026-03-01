// Tampa Incidents Map - Frontend JavaScript

let map;
let markersLayer;
let config = {};
let allDescriptions = [];
let selectedDescriptions = new Set();
let incidents = [];

// Initialize the application
async function init() {
  // Load configuration
  await loadConfig();

  // Initialize map
  initMap();

  // Load filter options
  await loadDescriptions();

  // Set up event listeners
  setupEventListeners();

  // Load initial data
  await loadIncidents();
}

// Load configuration from server
async function loadConfig() {
  try {
    const response = await fetch('/api/config');
    config = await response.json();
  } catch (error) {
    console.error('Failed to load config:', error);
    // Use defaults
    config = {
      gridColors: { red: ['152'], yellow: ['120', '136', '151', '153', '157', '158', '159'], blue: [] },
      colors: { red: '#EF4444', yellow: '#FBBF24', blue: '#3B82F6' }
    };
  }
}

// Initialize Leaflet map
function initMap() {
  // Center on configured zone area (override via MAP_CENTER_LAT/LNG/ZOOM env vars)
  map = L.map('map').setView([config.mapCenter.lat, config.mapCenter.lng], config.mapCenter.zoom);

  // Add CartoDB Voyager tiles (cleaner, no transit icons)
  L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
    subdomains: 'abcd',
    maxZoom: 20
  }).addTo(map);

  // Initialize marker cluster group
  markersLayer = L.markerClusterGroup({
    maxClusterRadius: 50,
    spiderfyOnMaxZoom: true,
    showCoverageOnHover: false
  });

  map.addLayer(markersLayer);
}

// Create custom colored marker
function createMarker(incident) {
  const color = incident.color || config.colors.blue;

  const icon = L.divIcon({
    className: 'custom-marker',
    html: `<div style="width: 14px; height: 14px; background: ${color}; border-radius: 50%; border: 2px solid white; box-shadow: 0 2px 6px rgba(0,0,0,0.4);"></div>`,
    iconSize: [18, 18],
    iconAnchor: [9, 9]
  });

  const marker = L.marker([incident.latitude, incident.longitude], { icon });

  marker.on('click', () => showDetails(incident));

  return marker;
}

// Show incident details in panel
function showDetails(incident) {
  const panel = document.getElementById('detailsPanel');
  const content = document.getElementById('detailsContent');

  // Determine grid color class
  let colorClass = 'blue';
  if (config.gridColors.red.includes(incident.grid)) {
    colorClass = 'red';
  } else if (config.gridColors.yellow.includes(incident.grid)) {
    colorClass = 'yellow';
  }

  const dispatchedDate = new Date(incident.dispatched);

  content.innerHTML = `
    <div class="detail-row">
      <div class="detail-label">Description</div>
      <div class="detail-value">${escapeHtml(incident.description)}</div>
    </div>
    <div class="detail-row">
      <div class="detail-label">Address</div>
      <div class="detail-value">${escapeHtml(incident.address)}</div>
    </div>
    <div class="detail-row">
      <div class="detail-label">Dispatched</div>
      <div class="detail-value">${dispatchedDate.toLocaleString()}</div>
    </div>
    <div class="detail-row">
      <div class="detail-label">Grid</div>
      <div class="detail-value">
        <span class="grid-badge ${colorClass}">${incident.grid}</span>
        ${incident.map_link ? `<a href="${incident.map_link}" target="_blank" style="margin-left: 8px;">View Grid Map</a>` : ''}
      </div>
    </div>
    <div class="detail-row">
      <div class="detail-label">Report #</div>
      <div class="detail-value">${incident.report}</div>
    </div>
  `;

  panel.classList.add('open');
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Load incidents from API
async function loadIncidents() {
  const params = buildQueryParams();
  const url = `/api/incidents?${params}`;

  try {
    const response = await fetch(url);
    incidents = await response.json();

    updateMap();
    updateStats();
  } catch (error) {
    console.error('Failed to load incidents:', error);
  }
}

// Build query parameters from filters
function buildQueryParams() {
  const params = new URLSearchParams();

  const startDate = document.getElementById('startDate').value;
  const endDate = document.getElementById('endDate').value;

  if (startDate) {
    params.set('startDate', new Date(startDate).toISOString());
  }

  if (endDate) {
    // End of the selected day
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);
    params.set('endDate', end.toISOString());
  }

  if (selectedDescriptions.size > 0) {
    params.set('descriptions', Array.from(selectedDescriptions).join(','));
  }

  // Always filter to configured grids only
  const allGrids = [...config.gridColors.red, ...config.gridColors.yellow];
  params.set('grids', allGrids.join(','));

  return params;
}

// Update map markers
function updateMap() {
  markersLayer.clearLayers();

  incidents.forEach(incident => {
    if (incident.latitude && incident.longitude) {
      const marker = createMarker(incident);
      markersLayer.addLayer(marker);
    }
  });

  // Fit bounds if we have markers
  if (incidents.length > 0) {
    const validIncidents = incidents.filter(i => i.latitude && i.longitude);
    if (validIncidents.length > 0) {
      const bounds = L.latLngBounds(
        validIncidents.map(i => [i.latitude, i.longitude])
      );
      map.fitBounds(bounds, { padding: [50, 50] });
    }
  }
}

// Update stats display
async function updateStats() {
  const statsEl = document.getElementById('stats');
  const redCount = incidents.filter(i => config.gridColors.red.includes(i.grid)).length;
  const yellowCount = incidents.filter(i => config.gridColors.yellow.includes(i.grid)).length;
  const blueCount = incidents.length - redCount - yellowCount;

  // Fetch last update time from server
  let lastUpdateStr = '';
  try {
    const response = await fetch('/api/stats');
    const stats = await response.json();
    if (stats.lastUpdate) {
      const lastUpdate = new Date(stats.lastUpdate + 'Z'); // Parse as UTC
      lastUpdateStr = `<br><small>Last updated: ${lastUpdate.toLocaleString('en-US', { timeZone: 'America/New_York' })}</small>`;
    }
  } catch (e) {
    console.error('Failed to fetch stats:', e);
  }

  statsEl.innerHTML = `
    ${incidents.length} incidents shown<br>
    <small>${redCount} priority | ${yellowCount} neighborhood | ${blueCount} other</small>
    ${lastUpdateStr}
  `;
}

// Load descriptions for filter
async function loadDescriptions() {
  try {
    const response = await fetch('/api/descriptions');
    allDescriptions = await response.json();

    // Load saved selections from localStorage, or default to all selected
    const savedSelections = localStorage.getItem('selectedDescriptions');
    if (savedSelections) {
      try {
        const parsed = JSON.parse(savedSelections);
        selectedDescriptions = new Set(parsed.filter(d => allDescriptions.includes(d)));
      } catch (e) {
        console.error('Failed to parse saved selections:', e);
        // Default to all selected on error
        selectedDescriptions = new Set(allDescriptions);
      }
    } else {
      // No saved selections - default to all selected
      selectedDescriptions = new Set(allDescriptions);
    }

    const container = document.getElementById('descriptionList');
    container.innerHTML = allDescriptions.map(desc => `
      <label class="description-item" data-description="${escapeHtml(desc)}">
        <input type="checkbox" value="${escapeHtml(desc)}" ${selectedDescriptions.has(desc) ? 'checked' : ''} />
        ${escapeHtml(desc)}
      </label>
    `).join('');

    // Add event listeners to checkboxes
    container.querySelectorAll('input[type="checkbox"]').forEach(cb => {
      cb.addEventListener('change', (e) => {
        if (e.target.checked) {
          selectedDescriptions.add(e.target.value);
        } else {
          selectedDescriptions.delete(e.target.value);
        }
        saveDescriptionSelections();
      });
    });

    // Set up Select All / Deselect All buttons
    document.getElementById('selectAllDescriptions').addEventListener('click', () => {
      document.querySelectorAll('.description-item input[type="checkbox"]').forEach(cb => {
        cb.checked = true;
        selectedDescriptions.add(cb.value);
      });
      saveDescriptionSelections();
    });

    document.getElementById('deselectAllDescriptions').addEventListener('click', () => {
      document.querySelectorAll('.description-item input[type="checkbox"]').forEach(cb => {
        cb.checked = false;
      });
      selectedDescriptions.clear();
      saveDescriptionSelections();
    });
  } catch (error) {
    console.error('Failed to load descriptions:', error);
  }
}

// Save description selections to localStorage
function saveDescriptionSelections() {
  localStorage.setItem('selectedDescriptions', JSON.stringify(Array.from(selectedDescriptions)));
}

// Set up event listeners
function setupEventListeners() {
  // Quick date buttons
  document.querySelectorAll('.quick-date').forEach(btn => {
    btn.addEventListener('click', () => {
      // Update active state
      document.querySelectorAll('.quick-date').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      // Set date range
      const days = parseInt(btn.dataset.days);
      const endDate = new Date();
      const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

      document.getElementById('startDate').value = formatDateInput(startDate);
      document.getElementById('endDate').value = formatDateInput(endDate);
    });
  });

  // Initialize date inputs with default (7 days)
  const endDate = new Date();
  const startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  document.getElementById('startDate').value = formatDateInput(startDate);
  document.getElementById('endDate').value = formatDateInput(endDate);

  // Set 7 days button as active
  document.querySelectorAll('.quick-date').forEach(b => b.classList.remove('active'));
  document.querySelector('.quick-date[data-days="7"]').classList.add('active');

  // Description search
  document.getElementById('descriptionSearch').addEventListener('input', (e) => {
    const search = e.target.value.toLowerCase();
    document.querySelectorAll('.description-item').forEach(item => {
      const desc = item.dataset.description.toLowerCase();
      item.classList.toggle('hidden', !desc.includes(search));
    });
  });

  // Apply filters button
  document.getElementById('applyFilters').addEventListener('click', loadIncidents);

  // Clear filters button (resets to defaults: 7 days, all types selected)
  document.getElementById('clearFilters').addEventListener('click', () => {
    // Reset dates to 7 days
    document.querySelectorAll('.quick-date').forEach(b => b.classList.remove('active'));
    document.querySelector('.quick-date[data-days="7"]').classList.add('active');

    const endDate = new Date();
    const startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    document.getElementById('startDate').value = formatDateInput(startDate);
    document.getElementById('endDate').value = formatDateInput(endDate);

    // Select all incident types
    document.querySelectorAll('.description-item input').forEach(cb => {
      cb.checked = true;
      selectedDescriptions.add(cb.value);
    });
    saveDescriptionSelections();

    // Reload
    loadIncidents();
  });

  // Close details panel
  document.getElementById('closePanel').addEventListener('click', () => {
    document.getElementById('detailsPanel').classList.remove('open');
  });

  // Close panel when clicking outside
  map.on('click', () => {
    document.getElementById('detailsPanel').classList.remove('open');
  });
}

// Format date for input field
function formatDateInput(date) {
  return date.toISOString().split('T')[0];
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', init);
