// EyeFinder Client Application
let map;
let markersLayer;
let allCameras = [];
let activeFilter = 'all';
let searchQuery = '';

// Initialize Leaflet Map with ESRI World Dark Gray free tiles (no API key required)
function initMap() {
  map = L.map('map', {
    center: [46.5, 4.8], // Centered around France / Europe initial viewport
    zoom: 5,
    minZoom: 2,
    maxZoom: 19,
    zoomControl: false
  });

  // Custom Zoom Control at bottom right
  L.control.zoom({ position: 'bottomright' }).addTo(map);

  // ESRI World Dark Gray Canvas: 100% Free, No API Key Required
  L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}', {
    attribution: 'Tiles &copy; Esri, DeLorme, NAVTEQ, TomTom, USGS, NPS, NRCAN, Ordnance Survey',
    maxZoom: 16
  }).addTo(map);

  markersLayer = L.layerGroup().addTo(map);

  // Auto-refresh snapshot cameras every 60 seconds while popup is open
  let popupRefreshTimer = null;
  map.on('popupopen', (e) => {
    if (popupRefreshTimer) clearInterval(popupRefreshTimer);
    const popupEl = e.popup.getElement();
    const snapImg = popupEl ? popupEl.querySelector('.popup-snapshot') : null;
    if (snapImg && snapImg.dataset.rawSrc) {
      popupRefreshTimer = setInterval(() => {
        const raw = snapImg.dataset.rawSrc;
        snapImg.src = raw + (raw.includes('?') ? '&' : '?') + 't=' + Date.now();
      }, 60000);
    }
  });

  map.on('popupclose', () => {
    if (popupRefreshTimer) {
      clearInterval(popupRefreshTimer);
      popupRefreshTimer = null;
    }
  });
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

// Helper to extract YouTube video ID from cam metadata or URL
function getYouTubeId(cam) {
  if (cam.youtube_id) return cam.youtube_id;
  if (!cam.stream_url) return null;
  const match = cam.stream_url.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i);
  return match ? match[1] : null;
}

// Build popup HTML for a camera
function createPopupContent(cam) {
  const isUp = cam.status === 'operational';
  const latFormatted = Number(cam.latitude).toFixed(4);
  const lonFormatted = Number(cam.longitude).toFixed(4);
  const timeFormatted = cam.last_checked
    ? new Date(cam.last_checked).toLocaleTimeString()
    : 'N/A';

  const ytId = getYouTubeId(cam);
  const isVideo = !ytId && cam.stream_url && cam.stream_url.includes('.mp4');
  const isSnapshot = cam.is_snapshot || (cam.stream_url && /\.(jpg|jpeg|png)$/i.test(cam.stream_url));
  const previewImg = cam.preview_image || (isSnapshot ? cam.stream_url : null);

  let mediaHtml = '';
  if (ytId) {
    mediaHtml = `
      <iframe class="popup-video" src="https://www.youtube-nocookie.com/embed/${ytId}?autoplay=1&mute=1&playsinline=1" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen referrerpolicy="no-referrer"></iframe>
    `;
  } else if (isVideo) {
    mediaHtml = `
      <video class="popup-video" src="${encodeURI(cam.stream_url)}" autoplay loop muted playsinline controls referrerpolicy="no-referrer"></video>
    `;
  } else if (previewImg) {
    const rawSrc = encodeURI(previewImg);
    mediaHtml = `
      <div class="snapshot-container">
        <img class="popup-video popup-snapshot" src="${rawSrc}${rawSrc.includes('?') ? '&' : '?'}t=${Date.now()}" data-raw-src="${rawSrc}" alt="${escapeHtml(cam.name)}" loading="lazy" referrerpolicy="no-referrer" />
        ${isSnapshot ? '<span class="snapshot-tag">● LIVE (REFRESH: 60s)</span>' : ''}
      </div>
    `;
  }

  return `
    <div class="popup-card">
      <div class="popup-header">
        <div class="popup-title">${escapeHtml(cam.name)}</div>
        <span class="popup-badge badge-${isUp ? 'operational' : 'down'}">
          ${isUp ? '● OPERATIONAL' : '■ DOWN'}
        </span>
      </div>

      ${mediaHtml}

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
      <a href="${encodeURI(cam.stream_url)}" target="_blank" rel="noopener noreferrer" referrerpolicy="no-referrer" class="popup-btn">
        ACCESS CCTV FLUX ↗
      </a>
    </div>
  `;
}

// Fetch cameras from API with automatic fallback to static seed data
async function loadCameras() {
  try {
    const res = await fetch('/api/cameras');
    if (res.ok) {
      const data = await res.json();
      if (data.cameras && data.cameras.length > 0) {
        allCameras = data.cameras;
        updateStats(data);
        renderMapMarkers();
        renderSidebarList();
        return;
      }
    }
  } catch (err) {
    console.warn('API /api/cameras unavailable, loading static fallback seed:', err);
  }

  // Fallback to static seed.json if serverless API is initializing or offline
  try {
    const seedRes = await fetch('/seed.json');
    if (seedRes.ok) {
      const seedData = await seedRes.json();
      allCameras = seedData.cameras;
      updateStats(seedData);
      renderMapMarkers();
      renderSidebarList();
    }
  } catch (err) {
    console.error('Failed to load fallback cameras:', err);
  }
}

// Update telemetry counters
function updateStats(data) {
  document.getElementById('stat-total').textContent = data.total || allCameras.length;
  document.getElementById('stat-online').textContent = data.operational || allCameras.filter(c => c.status === 'operational').length;
  document.getElementById('stat-down').textContent = data.down || allCameras.filter(c => c.status === 'down').length;
  document.getElementById('stat-db').textContent = (data.storage === 'supabase' ? 'SUPABASE' : 'DATASTORE').toUpperCase();
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

    marker.bindPopup(createPopupContent(cam), { maxWidth: 320 });
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
    if (res.ok) {
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
