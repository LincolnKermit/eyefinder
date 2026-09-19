// EyeFinder Client Application
let map;
let markersLayer;
let allCameras = [];
let activeFilter = 'all';
let searchQuery = '';

// Initialize Leaflet Map with CartoDB Dark Matter free tiles
function initMap() {
  map = L.map('map', {
    center: [30.0, 0.0],
    zoom: 3,
    minZoom: 2,
    maxZoom: 18,
    zoomControl: false
  });

  // Custom Zoom Control at bottom right
  L.control.zoom({ position: 'bottomright' }).addTo(map);

  // Free, Open-Source CartoDB Dark Matter tile layer
  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
    subdomains: 'abcd',
    maxZoom: 19
  }).addTo(map);

  markersLayer = L.layerGroup().addTo(map);
}

// Create custom DOM Marker Reticle
function createPinIcon(status) {
  const isUp = status === 'operational';
  const html = `
    <div class="custom-pin pin-${isUp ? 'operational' : 'down'}">
      <div class="pin-pulse"></div>
      <div class="pin-core"></div>
    </div>
  `;

  return L.divIcon({
    html: html,
    className: '',
    iconSize: [24, 24],
    iconAnchor: [12, 12],
    popupAnchor: [0, -10]
  });
}

// Build popup HTML for a camera
function createPopupContent(cam) {
  const isUp = cam.status === 'operational';
  const latFormatted = Number(cam.latitude).toFixed(4);
  const lonFormatted = Number(cam.longitude).toFixed(4);
  const timeFormatted = cam.last_checked
    ? new Date(cam.last_checked).toLocaleTimeString()
    : 'N/A';

  return `
    <div class="popup-card">
      <div class="popup-header">
        <div class="popup-title">${escapeHtml(cam.name)}</div>
        <span class="popup-badge badge-${isUp ? 'operational' : 'down'}">
          ${isUp ? '● OPERATIONAL' : '■ DOWN'}
        </span>
      </div>
      <div class="popup-meta">
        <div class="meta-row">
          <span class="meta-label">COORDINATES</span>
          <span class="meta-val">${latFormatted}, ${lonFormatted}</span>
        </div>
        <div class="meta-row">
          <span class="meta-label">SOURCE</span>
          <span class="meta-val">${escapeHtml(cam.source || 'Public Feed')}</span>
        </div>
        <div class="meta-row">
          <span class="meta-label">LAST CHECK</span>
          <span class="meta-val">${timeFormatted}</span>
        </div>
      </div>
      <a href="${encodeURI(cam.stream_url)}" target="_blank" rel="noopener noreferrer" class="popup-btn">
        ACCESS CCTV FLUX ↗
      </a>
    </div>
  `;
}

// Fetch cameras from API
async function loadCameras() {
  try {
    const res = await fetch('/api/cameras');
    const data = await res.json();

    if (data.success && Array.isArray(data.cameras)) {
      allCameras = data.cameras;
      updateStats(data);
      renderMapMarkers();
      renderSidebarList();
    }
  } catch (err) {
    console.error('Failed to load cameras:', err);
  }
}

// Update telemetry counters
function updateStats(data) {
  document.getElementById('stat-total').textContent = data.total || allCameras.length;
  document.getElementById('stat-online').textContent = data.operational || allCameras.filter(c => c.status === 'operational').length;
  document.getElementById('stat-down').textContent = data.down || allCameras.filter(c => c.status === 'down').length;
  document.getElementById('stat-db').textContent = (data.storage === 'supabase' ? 'SUPABASE' : 'LOCAL').toUpperCase();
}

// Filter cameras based on search and status buttons
function getFilteredCameras() {
  return allCameras.filter(cam => {
    const matchesFilter =
      activeFilter === 'all' ||
      (activeFilter === 'operational' && cam.status === 'operational') ||
      (activeFilter === 'down' && cam.status === 'down');

    const matchesSearch =
      !searchQuery ||
      cam.name.toLowerCase().includes(searchQuery) ||
      (cam.source && cam.source.toLowerCase().includes(searchQuery));

    return matchesFilter && matchesSearch;
  });
}

// Render markers on the Leaflet map
function renderMapMarkers() {
  markersLayer.clearLayers();
  const filtered = getFilteredCameras();

  filtered.forEach(cam => {
    const marker = L.marker([cam.latitude, cam.longitude], {
      icon: createPinIcon(cam.status),
      title: cam.name
    });

    marker.bindPopup(createPopupContent(cam));
    marker.camData = cam;
    markersLayer.addLayer(marker);
  });
}

// Render the side list of cameras
function renderSidebarList() {
  const container = document.getElementById('feed-list');
  const filtered = getFilteredCameras();

  document.getElementById('feed-count').textContent = `${filtered.length} FEEDS`;
  container.innerHTML = '';

  filtered.forEach(cam => {
    const card = document.createElement('div');
    card.className = 'feed-card';
    card.innerHTML = `
      <div class="feed-card-header">
        <span class="feed-name" title="${escapeHtml(cam.name)}">${escapeHtml(cam.name)}</span>
        <span class="feed-dot ${cam.status}"></span>
      </div>
      <div class="feed-details">
        <span>${escapeHtml(cam.source || 'Public Feed')}</span>
        <span>${Number(cam.latitude).toFixed(2)}, ${Number(cam.longitude).toFixed(2)}</span>
      </div>
    `;

    card.addEventListener('click', () => {
      focusCamera(cam);
    });

    container.appendChild(card);
  });
}

// Fly map to selected camera and open popup
function focusCamera(cam) {
  map.flyTo([cam.latitude, cam.longitude], 12, { duration: 1.2 });
  markersLayer.eachLayer(layer => {
    if (layer.camData && layer.camData.id === cam.id) {
      setTimeout(() => layer.openPopup(), 1300);
    }
  });
}

// Trigger re-scan of streams
async function triggerReScan() {
  const indicator = document.getElementById('scan-indicator');
  indicator.classList.remove('hidden');

  try {
    const res = await fetch('/api/cron', { method: 'POST' });
    const data = await res.json();
    if (data.cameras) {
      allCameras = data.cameras;
      updateStats({
        total: data.summary.total,
        operational: data.summary.operational,
        down: data.summary.down
      });
      renderMapMarkers();
      renderSidebarList();
    }
  } catch (err) {
    console.error('Re-scan error:', err);
  } finally {
    indicator.classList.add('hidden');
  }
}

// UTC Clock updater
function startClock() {
  const clockEl = document.getElementById('utc-clock');
  function update() {
    const now = new Date();
    clockEl.textContent = now.toUTCString().split(' ')[4] + ' UTC';
  }
  update();
  setInterval(update, 1000);
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Event Listeners setup
function setupEvents() {
  // Search input
  const searchInput = document.getElementById('camera-search');
  searchInput.addEventListener('input', (e) => {
    searchQuery = e.target.value.toLowerCase().trim();
    renderMapMarkers();
    renderSidebarList();
  });

  // Filter buttons
  const filterBtns = document.querySelectorAll('.filter-btn');
  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      filterBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeFilter = btn.dataset.filter;
      renderMapMarkers();
      renderSidebarList();
    });
  });

  // Re-scan button
  document.getElementById('btn-scan').addEventListener('click', triggerReScan);

  // Sidebar toggle button
  const toggleBtn = document.getElementById('toggle-sidebar');
  const sidebar = document.getElementById('cctv-sidebar');
  toggleBtn.addEventListener('click', () => {
    sidebar.classList.toggle('collapsed');
    toggleBtn.textContent = sidebar.classList.contains('collapsed') ? '›' : '‹';
    setTimeout(() => map.invalidateSize(), 300);
  });
}

// Initialize on DOM load
window.addEventListener('DOMContentLoaded', () => {
  initMap();
  setupEvents();
  startClock();
  loadCameras();
});
