// EyeFinder Client Application
let map;
let markersLayer;
let allCameras = [];
let activeFilter = 'all';
let searchQuery = '';

// Initialize Leaflet Map with ESRI World Dark Gray free tiles (no API key required)
function initMap() {
  map = L.map('map', {
    center: [46.15, 5.4], // Centered between Lyon, Geneva & Rhône-Alpes
    zoom: 7,
    minZoom: 2,
    maxZoom: 19,
    zoomControl: false,
    tap: false // Recommended for modern touch devices
  });

  // Custom Zoom Control at bottom right
  L.control.zoom({ position: 'bottomright' }).addTo(map);

  // ESRI World Dark Gray Canvas: 100% Free, No API Key Required
  L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}', {
    attribution: 'Tiles &copy; Esri, DeLorme, NAVTEQ, TomTom, USGS, NPS, NRCAN, Ordnance Survey',
    maxZoom: 16
  }).addTo(map);

  markersLayer = L.layerGroup().addTo(map);

  // Map Legend
  const legend = L.control({ position: 'bottomleft' });
  legend.onAdd = function() {
    const div = L.DomUtil.create('div', 'map-legend');
    div.innerHTML = `
      <div class="legend-title">FEED CLASSIFICATION</div>
      <div class="legend-row">
        <span class="legend-dot dot-live"></span>
        <span>Live Stream (Dark Green)</span>
      </div>
      <div class="legend-row">
        <span class="legend-dot dot-picture"></span>
        <span>Picture Refresh (Light Green)</span>
      </div>
      <div class="legend-row">
        <span class="legend-dot dot-down"></span>
        <span>Offline (Red)</span>
      </div>
    `;
    return div;
  };
  legend.addTo(map);

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

// Helper to determine if a camera is a refreshing snapshot or live video stream
function isPictureCamera(cam) {
  if (cam.is_snapshot) return true;
  if (cam.is_mjpeg || (cam.stream_url && (cam.stream_url.includes('mjpg') || cam.stream_url.includes('faststream')))) {
    return false;
  }
  return Boolean(
    (cam.stream_url && /\.(jpg|jpeg|png)$/i.test(cam.stream_url)) ||
    (cam.stream_url && cam.stream_url.includes('visu_camera')) ||
    (cam.preview_image && !cam.youtube_id && (!cam.stream_url || (!cam.stream_url.includes('.mp4') && !cam.stream_url.includes('youtube') && !cam.stream_url.includes('youtu.be'))))
  );
}

// Helper to resolve camera type: 'live' | 'picture' | 'down'
function getCameraType(cam) {
  if (cam.status === 'down') return 'down';
  return isPictureCamera(cam) ? 'picture' : 'live';
}

// Create custom DOM Marker Reticle
// - Live camera: Dark Green (.pin-live) with continuous radar pulse
// - Picture refresh: Lighter Green (.pin-picture) with 60s pulse cycle
// - Down: Red (.pin-down)
function createPinIcon(cam) {
  const type = (typeof cam === 'string') 
    ? (cam === 'down' ? 'down' : 'live') 
    : getCameraType(cam);

  const html = `
    <div class="custom-pin pin-${type}">
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
  const type = getCameraType(cam);
  const isPic = type === 'picture';
  const isDown = type === 'down';
  const badgeClass = isDown ? 'badge-down' : (isPic ? 'badge-picture' : 'badge-live');
  const badgeText = isDown ? '■ OFFLINE' : (isPic ? '⟳ PICTURE (60s)' : (cam.is_mjpeg ? '● LIVE MJPEG' : '● LIVE STREAM'));

  const latFormatted = Number(cam.latitude).toFixed(4);
  const lonFormatted = Number(cam.longitude).toFixed(4);
  const timeFormatted = cam.last_checked
    ? new Date(cam.last_checked).toLocaleTimeString()
    : 'Recent';

  const ytId = getYouTubeId(cam);

  let mediaHtml = '';
  if (isPic) {
    mediaHtml = `
      <div class="snapshot-container">
        <img 
          class="popup-video popup-snapshot" 
          src="${escapeHtml(cam.stream_url)}" 
          data-raw-src="${escapeHtml(cam.stream_url)}"
          alt="${escapeHtml(cam.name)}" 
          referrerpolicy="no-referrer"
          loading="lazy"
        />
        <div class="snapshot-tag">⟳ REFRESH 60S</div>
      </div>
    `;
  } else if (!isDown && cam.stream_url) {
    if (ytId) {
      mediaHtml = `
        <iframe 
          class="popup-video" 
          src="https://www.youtube-nocookie.com/embed/${encodeURIComponent(ytId)}?autoplay=1&mute=1&playsinline=1" 
          title="${escapeHtml(cam.name)}" 
          frameborder="0" 
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" 
          referrerpolicy="no-referrer"
          allowfullscreen>
        </iframe>
      `;
    } else if (cam.is_mjpeg || cam.stream_url.includes('mjpg') || cam.stream_url.includes('faststream')) {
      mediaHtml = `
        <img 
          class="popup-video" 
          src="${escapeHtml(cam.stream_url)}" 
          alt="${escapeHtml(cam.name)}" 
          referrerpolicy="no-referrer"
        />
      `;
    } else {
      mediaHtml = `
        <video class="popup-video" autoplay muted loop playsinline referrerpolicy="no-referrer">
          <source src="${escapeHtml(cam.stream_url)}" type="video/mp4">
          CCTV Stream Unavailable
        </video>
      `;
    }
  } else {
    mediaHtml = `
      <div class="popup-video" style="display:flex;align-items:center;justify-content:center;background:#1a1012;color:var(--status-red);font-size:11px;font-weight:700;letter-spacing:0.08em;border:1px dashed var(--status-red);">
        OFFLINE / PROBE TIMEOUT
      </div>
    `;
  }

  return `
    <div class="popup-card">
      <div class="popup-header">
        <div class="popup-title">${escapeHtml(cam.name)}</div>
        <span class="popup-badge ${badgeClass}">${badgeText}</span>
      </div>

      ${mediaHtml}

      <div class="popup-meta">
        <div class="meta-row">
          <span class="meta-label">TYPE</span>
          <span class="meta-val" style="color: ${type === 'live' ? 'var(--color-live-text)' : (type === 'picture' ? 'var(--color-picture)' : 'var(--status-red)')}; font-weight: 700;">
            ${type === 'live' ? (cam.is_mjpeg ? 'LIVE IP MJPEG' : 'LIVE CAMERA (VIDEO)') : (type === 'picture' ? 'PERIODIC PICTURE' : 'OFFLINE')}
          </span>
        </div>
        <div class="meta-row">
          <span class="meta-label">LOCATION</span>
          <span class="meta-val">${escapeHtml(cam.city ? (cam.city + (cam.country ? ', ' + cam.country : '')) : (cam.country || 'Global'))}</span>
        </div>
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
      ${cam.insecam_url ? `
      <div class="popup-actions" style="display: flex; gap: 8px;">
        <a href="${encodeURI(cam.stream_url)}" target="_blank" rel="noopener noreferrer" referrerpolicy="no-referrer" class="popup-btn" style="flex: 1;">
          CCTV FLUX ↗
        </a>
        <a href="${encodeURI(cam.insecam_url)}" target="_blank" rel="noopener noreferrer" referrerpolicy="no-referrer" class="popup-btn" style="flex: 1; background: var(--bg-primary); border-color: var(--border-active);">
          INSECAM ↗
        </a>
      </div>
      ` : `
      <a href="${encodeURI(cam.stream_url)}" target="_blank" rel="noopener noreferrer" referrerpolicy="no-referrer" class="popup-btn">
        ACCESS CCTV FLUX ↗
      </a>
      `}
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
  const total = data.total || allCameras.length;
  const liveCount = allCameras.filter(c => c.status === 'operational' && getCameraType(c) === 'live').length;
  const pictureCount = allCameras.filter(c => c.status === 'operational' && getCameraType(c) === 'picture').length;
  const downCount = data.down !== undefined ? data.down : allCameras.filter(c => c.status === 'down').length;

  const totalEl = document.getElementById('stat-total');
  if (totalEl) totalEl.textContent = total;

  const liveEl = document.getElementById('stat-live');
  if (liveEl) liveEl.textContent = liveCount;

  const pictureEl = document.getElementById('stat-picture');
  if (pictureEl) pictureEl.textContent = pictureCount;

  const downEl = document.getElementById('stat-down');
  if (downEl) downEl.textContent = downCount;

  const dbEl = document.getElementById('stat-db');
  if (dbEl) dbEl.textContent = (data.storage === 'supabase' ? 'SUPABASE' : 'EDGE').toUpperCase();

  const hudBadge = document.getElementById('hud-feed-badge');
  if (hudBadge) hudBadge.textContent = total;
}

// Filter cameras based on search and status buttons
function getFilteredCameras() {
  return allCameras.filter(cam => {
    const type = getCameraType(cam);
    const matchesFilter =
      activeFilter === 'all' ||
      (activeFilter === 'operational' && cam.status === 'operational') ||
      (activeFilter === 'live' && type === 'live') ||
      (activeFilter === 'picture' && type === 'picture') ||
      (activeFilter === 'france' && (cam.country === 'France' || (cam.name && cam.name.toLowerCase().includes('france')))) ||
      (activeFilter === 'swiss' && (cam.country === 'Switzerland' || (cam.city && cam.city.toLowerCase().includes('genev')) || (cam.name && cam.name.toLowerCase().includes('suisse')))) ||
      (activeFilter === 'down' && cam.status === 'down');

    const matchesSearch =
      !searchQuery ||
      cam.name.toLowerCase().includes(searchQuery) ||
      (cam.city && cam.city.toLowerCase().includes(searchQuery)) ||
      (cam.country && cam.country.toLowerCase().includes(searchQuery)) ||
      (cam.source && cam.source.toLowerCase().includes(searchQuery));

    return matchesFilter && matchesSearch;
  });
}

// Render markers on the Leaflet map
function renderMapMarkers() {
  markersLayer.clearLayers();
  const filtered = getFilteredCameras();

  filtered.forEach(cam => {
    const type = getCameraType(cam);
    const typeLabel = type === 'live' ? 'Live Camera' : (type === 'picture' ? 'Picture (Refresh)' : 'Offline');

    const marker = L.marker([cam.latitude, cam.longitude], {
      icon: createPinIcon(cam),
      title: `${cam.name} [${typeLabel}]`
    });

    marker.bindPopup(createPopupContent(cam), {
      maxWidth: 320,
      minWidth: 240,
      autoPanPadding: [15, 15]
    });

    marker.camData = cam;
    markersLayer.addLayer(marker);
  });
}

// Render the side list of cameras
function renderSidebarList() {
  const container = document.getElementById('feed-list');
  const filtered = getFilteredCameras();

  const feedCountEl = document.getElementById('feed-count');
  if (feedCountEl) feedCountEl.textContent = `${filtered.length} FEEDS`;

  const hudBadge = document.getElementById('hud-feed-badge');
  if (hudBadge) hudBadge.textContent = filtered.length;

  container.innerHTML = '';

  filtered.forEach(cam => {
    const type = getCameraType(cam);
    const typeLabel = type === 'live' ? 'LIVE' : (type === 'picture' ? 'PICTURE' : 'OFFLINE');
    const typePill = type === 'live' ? (cam.is_mjpeg ? 'MJPEG' : 'LIVE') : (type === 'picture' ? '60s' : 'DOWN');

    const card = document.createElement('div');
    card.className = 'feed-card';
    card.innerHTML = `
      <div class="feed-card-header">
        <span class="feed-name" title="${escapeHtml(cam.name)}">${escapeHtml(cam.name)}</span>
        <div class="feed-header-tags">
          <span class="feed-tag tag-${type}">${typePill}</span>
          <span class="feed-dot ${type}" title="${typeLabel}"></span>
        </div>
      </div>
      <div class="feed-details">
        <span>${escapeHtml(cam.city ? (cam.city + (cam.country ? ', ' + cam.country : '')) : (cam.source || 'Public Feed'))}</span>
        <span>${Number(cam.latitude).toFixed(2)}, ${Number(cam.longitude).toFixed(2)}</span>
      </div>
    `;

    card.addEventListener('click', () => {
      focusCamera(cam);
    });

    container.appendChild(card);
  });
}

// Mobile drawer controls
function openMobileSidebar() {
  const sidebar = document.getElementById('cctv-sidebar');
  const backdrop = document.getElementById('sidebar-backdrop');
  if (sidebar) sidebar.classList.add('mobile-open');
  if (backdrop) backdrop.classList.add('active');
}

function closeMobileSidebar() {
  const sidebar = document.getElementById('cctv-sidebar');
  const backdrop = document.getElementById('sidebar-backdrop');
  if (sidebar) sidebar.classList.remove('mobile-open');
  if (backdrop) backdrop.classList.remove('active');
}

function toggleMobileSidebar() {
  const sidebar = document.getElementById('cctv-sidebar');
  if (sidebar && sidebar.classList.contains('mobile-open')) {
    closeMobileSidebar();
  } else {
    openMobileSidebar();
  }
}

// Fly map to selected camera and open popup
function focusCamera(cam) {
  // On mobile or when drawer is open, auto-close sidebar so user sees map & stream
  closeMobileSidebar();

  map.flyTo([cam.latitude, cam.longitude], 12, { duration: 1.1 });
  markersLayer.eachLayer(layer => {
    if (layer.camData && layer.camData.id === cam.id) {
      setTimeout(() => layer.openPopup(), 1200);
    }
  });
}

// Trigger re-scan of streams
async function triggerReScan() {
  const indicator = document.getElementById('scan-indicator');
  if (indicator) {
    indicator.classList.remove('hidden');
    const label = indicator.querySelector('span');
    if (label) label.textContent = `PROBING ${allCameras.length || 179} CCTV FLUX STREAMS...`;
  }

  try {
    // High-availability GET edge verification
    const res = await fetch('/api/cameras?refresh=1&t=' + Date.now());
    let freshData = null;
    if (res.ok) {
      freshData = await res.json();
    } else {
      const fallbackRes = await fetch('/seed.json?t=' + Date.now());
      if (fallbackRes.ok) freshData = await fallbackRes.json();
    }

    if (freshData && freshData.cameras && freshData.cameras.length > 0) {
      allCameras = freshData.cameras;
      const nowIso = new Date().toISOString();
      allCameras.forEach(cam => {
        cam.last_checked = nowIso;
      });

      updateStats({
        total: allCameras.length,
        operational: allCameras.filter(c => c.status === 'operational').length,
        down: allCameras.filter(c => c.status === 'down').length,
        storage: freshData.storage
      });

      renderMapMarkers();
      renderSidebarList();
    }
  } catch (err) {
    console.error('Re-scan verification error:', err);
  } finally {
    setTimeout(() => {
      if (indicator) indicator.classList.add('hidden');
    }, 600);
  }
}

// UTC Clock updater
function startClock() {
  const clockEl = document.getElementById('utc-clock');
  if (!clockEl) return;
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
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      searchQuery = e.target.value.toLowerCase().trim();
      renderMapMarkers();
      renderSidebarList();
    });
  }

  // Filter buttons
  const filterBtns = document.querySelectorAll('.filter-btn');
  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      filterBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeFilter = btn.dataset.filter;

      // Pan & zoom map to selected theater of operations
      if (activeFilter === 'france') {
        map.flyTo([46.6, 2.4], 6, { duration: 1.2 });
      } else if (activeFilter === 'swiss') {
        map.flyTo([46.8, 8.2], 7, { duration: 1.2 });
      } else if (activeFilter === 'all') {
        map.flyTo([46.15, 5.4], 7, { duration: 1.2 });
      }

      renderMapMarkers();
      renderSidebarList();
    });
  });

  // Re-scan buttons (desktop & mobile)
  const scanBtn = document.getElementById('btn-scan');
  if (scanBtn) scanBtn.addEventListener('click', triggerReScan);

  const mobileScanBtn = document.getElementById('btn-scan-mobile');
  if (mobileScanBtn) mobileScanBtn.addEventListener('click', triggerReScan);

  // Mobile drawer toggle
  const drawerToggleBtn = document.getElementById('btn-drawer-toggle');
  if (drawerToggleBtn) {
    drawerToggleBtn.addEventListener('click', toggleMobileSidebar);
  }

  // Backdrop click to close drawer
  const backdrop = document.getElementById('sidebar-backdrop');
  if (backdrop) {
    backdrop.addEventListener('click', closeMobileSidebar);
  }

  // Desktop sidebar toggle button
  const desktopSidebarBtn = document.getElementById('btn-sidebar-desktop');
  const desktopToggleText = document.getElementById('desktop-toggle-text');
  const sidebar = document.getElementById('cctv-sidebar');

  if (desktopSidebarBtn && sidebar) {
    desktopSidebarBtn.addEventListener('click', () => {
      sidebar.classList.toggle('collapsed');
      if (desktopToggleText) {
        desktopToggleText.textContent = sidebar.classList.contains('collapsed') ? 'SHOW' : 'HIDE';
      }
      setTimeout(() => map.invalidateSize(), 300);
    });
  }

  // Sidebar header toggle / close button
  const toggleBtn = document.getElementById('toggle-sidebar');
  if (toggleBtn && sidebar) {
    toggleBtn.addEventListener('click', () => {
      if (window.innerWidth <= 850) {
        closeMobileSidebar();
      } else {
        sidebar.classList.toggle('collapsed');
        if (desktopToggleText) {
          desktopToggleText.textContent = sidebar.classList.contains('collapsed') ? 'SHOW' : 'HIDE';
        }
        setTimeout(() => map.invalidateSize(), 300);
      }
    });
  }

  // Window resize & orientation change handling
  window.addEventListener('resize', () => {
    if (map) map.invalidateSize();
    if (window.innerWidth > 850) {
      closeMobileSidebar();
    }
  });

  window.addEventListener('orientationchange', () => {
    setTimeout(() => {
      if (map) map.invalidateSize();
    }, 200);
  });
}

// Initialize on DOM load
window.addEventListener('DOMContentLoaded', () => {
  initMap();
  setupEvents();
  startClock();
  loadCameras();
});
