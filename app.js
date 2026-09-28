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

  // Auto-refresh camera feed previews while popup is open
  let popupRefreshTimer = null;
  map.on('popupopen', (e) => {
    if (popupRefreshTimer) clearInterval(popupRefreshTimer);
    const popupEl = e.popup.getElement();
    const feedImg = popupEl ? popupEl.querySelector('.popup-camera-feed') : null;
    if (feedImg && feedImg.dataset.secureSrc) {
      const baseSrc = feedImg.dataset.secureSrc;
      const isSnapshot = feedImg.closest('.popup-card') && feedImg.closest('.popup-card').querySelector('.badge-picture');
      const intervalMs = isSnapshot ? 60000 : 5000;
      popupRefreshTimer = setInterval(() => {
        feedImg.src = baseSrc + (baseSrc.includes('?') ? '&' : '?') + 't=' + Date.now();
      }, intervalMs);
    }
    if (e.popup && e.popup._source && e.popup._source.camData) {
      Telemetry.send('camera_view', e.popup._source.camData.name);
    }
  });

  map.on('popupclose', () => {
    if (popupRefreshTimer) {
      clearInterval(popupRefreshTimer);
      popupRefreshTimer = null;
    }
  });
}

// Helper to check if current visitor has admin token
function getAdminToken() {
  try {
    return sessionStorage.getItem('eyefinder_admin_token') || localStorage.getItem('eyefinder_admin_token') || '';
  } catch (e) {
    return '';
  }
}

function isAdmin() {
  return Boolean(getAdminToken());
}

// Helper to filter out cameras archived/deleted by the admin
function filterArchived(cameras) {
  if (!Array.isArray(cameras)) return [];
  try {
    const raw = localStorage.getItem('eyefinder_archived_cameras');
    if (!raw) return cameras;
    const archived = JSON.parse(raw);
    if (!Array.isArray(archived) || !archived.length) return cameras;
    const set = new Set(archived.map(String));
    return cameras.filter(c => !set.has(String(c.id)));
  } catch (e) {
    return cameras;
  }
}

// Helper to extract YouTube video ID from cam metadata or URL (supports /live/, /watch?v=, youtu.be, shorts)
function getYouTubeId(cam) {
  if (!cam) return null;
  if (cam.youtube_id) return cam.youtube_id;
  const urlsToTest = [cam.stream_url, cam.preview_image, cam.source, cam.insecam_url];
  for (const raw of urlsToTest) {
    if (!raw || typeof raw !== 'string') continue;
    const match = raw.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?|live|shorts)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i);
    if (match && match[1]) return match[1];
  }
  return null;
}

// Helper to determine if a camera is a refreshing snapshot or live video stream
function isPictureCamera(cam) {
  if (getYouTubeId(cam)) return false;
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

// Helper to resolve an HTTPS-compatible image/stream preview URL to eliminate SSL_ERROR_RX_RECORD_TOO_LONG
function getSecureMediaUrl(cam) {
  if (!cam) return '';
  const url = cam.preview_image || cam.stream_url;
  if (!url) return '';

  if (getYouTubeId(cam)) return url;

  // Video files (.mp4, .webm, .m3u8, .mov)
  if (url.match(/\.(mp4|webm|m3u8|mov)(\?.*)?$/i)) {
    return url;
  }

  // Derive static JPEG snapshot endpoint from camera hardware if stream is MJPEG
  let snapshotUrl = url;
  if (url.includes('/mjpg/video.mjpg')) {
    snapshotUrl = url.replace('/mjpg/video.mjpg', '/axis-cgi/jpg/image.cgi');
  } else if (url.includes('/cgi-bin/faststream.jpg')) {
    snapshotUrl = url.replace(/\/cgi-bin\/faststream\.jpg.*$/, '/record/current.jpg');
  } else if (url.includes('/mjpeg.cgi')) {
    snapshotUrl = url.replace('/mjpeg.cgi', '/image.jpg');
  }

  // Clean counter parameters
  snapshotUrl = snapshotUrl.replace(/[\?&]COUNTER/g, '');

  // If already HTTPS and standard web port, direct access works
  if (snapshotUrl.startsWith('https://') && !snapshotUrl.includes(':8080') && !snapshotUrl.includes(':8081') && !snapshotUrl.includes(':8082')) {
    return snapshotUrl;
  }

  // Route via Cloudflare-backed secure HTTPS image proxy to bypass mixed-content blocks and SSL_ERROR_RX_RECORD_TOO_LONG
  return `https://images.weserv.nl/?url=${encodeURIComponent(snapshotUrl)}&default=1`;
}

// Tactical stream fallback handler: replaces black screens with a clean radar card and direct link
window.handleStreamPreviewError = function(img) {
  if (!img) return;
  const container = img.closest('.snapshot-container') || img.parentElement;
  const rawSrc = img.getAttribute('data-raw-src') || img.src || '#';
  const camName = img.getAttribute('alt') || 'CCTV Flux';

  // If testing on HTTP localhost, attempt raw direct connection once
  const triedDirect = img.getAttribute('data-tried-direct');
  if (!triedDirect && window.location.protocol === 'http:' && rawSrc && !rawSrc.startsWith('https://images.weserv.nl') && !rawSrc.startsWith('#')) {
    img.setAttribute('data-tried-direct', 'true');
    img.src = rawSrc;
    return;
  }

  const fallbackCardHtml = `
    <div class="stream-fallback-card">
      <div class="fallback-radar-scan"></div>
      <div class="fallback-status-tag">FLUX SÉCURISÉ / IP DIRECT</div>
      <div class="fallback-icon">📡</div>
      <div class="fallback-cam-name" title="${escapeHtml(camName)}">${escapeHtml(camName)}</div>
      <div class="fallback-note">Le flux direct nécessite une connexion IP directe ou les cookies de la caméra.</div>
      <a href="${sanitizeUrl(rawSrc)}" target="_blank" rel="noopener noreferrer" referrerpolicy="no-referrer" class="fallback-flux-btn">
        ▶ ACCÉDER AU FLUX CAMÉRA ↗
      </a>
    </div>
  `;

  if (container) {
    container.innerHTML = fallbackCardHtml;
  } else {
    img.outerHTML = fallbackCardHtml;
  }
};

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
  const secureMediaSrc = getSecureMediaUrl(cam);
  const isVideo = cam.stream_url && cam.stream_url.match(/\.(mp4|webm|m3u8)(\?.*)?$/i);

  let mediaHtml = '';
  if (ytId) {
    mediaHtml = `
      <div class="youtube-preview-container">
        <iframe 
          class="youtube-frame" 
          src="https://www.youtube-nocookie.com/embed/${encodeURIComponent(ytId)}?autoplay=1&mute=1&playsinline=1" 
          title="${escapeHtml(cam.name)}" 
          frameborder="0" 
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" 
          referrerpolicy="strict-origin-when-cross-origin"
          allowfullscreen>
        </iframe>
        <div class="youtube-fallback-bar">
          <span class="yt-live-dot">● YT LIVE STREAM</span>
          <a href="https://www.youtube.com/watch?v=${encodeURIComponent(ytId)}" target="_blank" rel="noopener noreferrer" class="yt-direct-link">
            OUVRIR SUR YOUTUBE ↗
          </a>
        </div>
      </div>
    `;
  } else if (!isDown && isVideo) {
    mediaHtml = `
      <div class="snapshot-container">
        <video 
          class="popup-video" 
          autoplay muted loop playsinline controls
          style="object-fit: cover;"
        >
          <source src="${sanitizeUrl(cam.stream_url)}" type="video/mp4">
        </video>
        <div class="snapshot-tag">● VIDEO STREAM</div>
      </div>
    `;
  } else if (!isDown && cam.stream_url) {
    mediaHtml = `
      <div class="snapshot-container">
        <img 
          class="popup-video popup-camera-feed" 
          src="${escapeHtml(secureMediaSrc)}" 
          data-secure-src="${escapeHtml(secureMediaSrc)}"
          data-raw-src="${escapeHtml(cam.stream_url)}"
          alt="${escapeHtml(cam.name)}" 
          referrerpolicy="no-referrer"
          loading="lazy"
          onerror="window.handleStreamPreviewError && window.handleStreamPreviewError(this)"
        />
        <div class="snapshot-tag">${isPic ? '⟳ REFRESH 60S' : '● LIVE PREVIEW'}</div>
      </div>
    `;
  } else {
    mediaHtml = `
      <div class="stream-fallback-card">
        <div class="fallback-status-tag" style="color:var(--status-red); border-color:var(--status-red); background:rgba(255,71,87,0.1);">■ FLUX HORS LIGNE</div>
        <div class="fallback-icon">📡</div>
        <div class="fallback-cam-name" title="${escapeHtml(cam.name)}">${escapeHtml(cam.name)}</div>
        <div class="fallback-note">La caméra ne répond pas aux sondes ICMP/HTTP.</div>
        ${cam.stream_url ? `
        <a href="${sanitizeUrl(cam.stream_url)}" target="_blank" rel="noopener noreferrer" referrerpolicy="no-referrer" class="fallback-flux-btn" style="border-color:var(--status-red); color:var(--status-red);">
          TENTER CONNEXION DIRECTE ↗
        </a>` : ''}
      </div>
    `;
  }

  // In-map admin operator controls if logged in
  let adminControlsHtml = '';
  if (isAdmin()) {
    adminControlsHtml = `
      <div class="popup-admin-controls">
        <div class="admin-controls-badge">
          <span>⚡ CONTRÔLES ADMIN</span>
        </div>
        <div class="admin-popup-btns">
          <button type="button" class="btn-map-action btn-archive-cam" data-cam-id="${escapeHtml(cam.id)}" title="Archiver / Supprimer définitivement cette caméra">
            🗑️ ARCHIVER
          </button>
          <button type="button" class="btn-map-action btn-toggle-status" data-cam-id="${escapeHtml(cam.id)}" data-cam-status="${escapeHtml(cam.status || 'operational')}" title="Basculer statut opérationnel">
            ⟳ ${cam.status === 'down' ? 'RÉACTIVER' : 'HORS LIGNE'}
          </button>
          <button type="button" class="btn-map-action btn-edit-cam" data-cam-id="${escapeHtml(cam.id)}" title="Modifier les coordonnées et informations">
            ✏️ MODIFIER
          </button>
        </div>
      </div>
    `;
  }

  const actionButtons = ytId ? `
    <a href="https://www.youtube.com/watch?v=${encodeURIComponent(ytId)}" target="_blank" rel="noopener noreferrer" class="popup-btn">
      OUVRIR SUR YOUTUBE ↗
    </a>
  ` : (cam.insecam_url ? `
    <div class="popup-actions" style="display: flex; gap: 8px;">
      <a href="${sanitizeUrl(cam.stream_url)}" target="_blank" rel="noopener noreferrer" referrerpolicy="no-referrer" class="popup-btn" style="flex: 1;">
        CCTV FLUX ↗
      </a>
      <a href="${sanitizeUrl(cam.insecam_url)}" target="_blank" rel="noopener noreferrer" referrerpolicy="no-referrer" class="popup-btn" style="flex: 1; background: var(--bg-primary); border-color: var(--border-active);">
        INSECAM ↗
      </a>
    </div>
  ` : `
    <a href="${sanitizeUrl(cam.stream_url)}" target="_blank" rel="noopener noreferrer" referrerpolicy="no-referrer" class="popup-btn">
      ACCESS CCTV FLUX ↗
    </a>
  `);

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
            ${ytId ? 'YOUTUBE LIVE STREAM' : (type === 'live' ? (cam.is_mjpeg ? 'LIVE IP MJPEG' : 'LIVE CAMERA (VIDEO)') : (type === 'picture' ? 'PERIODIC PICTURE' : 'OFFLINE'))}
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

      ${actionButtons}
      ${adminControlsHtml}
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
        allCameras = filterArchived(data.cameras);
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
      allCameras = filterArchived(seedData.cameras);
      updateStats(seedData);
      renderMapMarkers();
      renderSidebarList();
    }
  } catch (err) {
    console.error('Failed to load fallback cameras:', err);
  }
}

// Update telemetry counters
function updateStats(data = {}) {
  const total = allCameras.length;
  const liveCount = allCameras.filter(c => c.status === 'operational' && getCameraType(c) === 'live').length;
  const pictureCount = allCameras.filter(c => c.status === 'operational' && getCameraType(c) === 'picture').length;
  const downCount = allCameras.filter(c => c.status === 'down').length;

  const totalEl = document.getElementById('stat-total');
  if (totalEl) totalEl.textContent = total;

  const liveEl = document.getElementById('stat-live');
  if (liveEl) liveEl.textContent = liveCount;

  const pictureEl = document.getElementById('stat-picture');
  if (pictureEl) pictureEl.textContent = pictureCount;

  const downEl = document.getElementById('stat-down');
  if (downEl) downEl.textContent = downCount;

  const dbEl = document.getElementById('stat-db');
  if (dbEl && data && data.storage) dbEl.textContent = (data.storage === 'supabase' ? 'SUPABASE' : 'EDGE').toUpperCase();

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

// Strict URL protocol validator to prevent javascript: or data: injection XSS
function sanitizeUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') return '#';
  const trimmed = rawUrl.trim();
  if (/^https?:\/\//i.test(trimmed)) {
    return encodeURI(trimmed);
  }
  return '#';
}

// Privacy-preserving visitor telemetry tracker
const Telemetry = {
  sessionId: null,
  deviceType: 'desktop',

  init() {
    try {
      let sid = localStorage.getItem('eyefinder_sid');
      if (!sid) {
        sid = 's_' + Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
        localStorage.setItem('eyefinder_sid', sid);
      }
      this.sessionId = sid;

      const ua = navigator.userAgent;
      if (/tablet|ipad|playbook|silk/i.test(ua)) {
        this.deviceType = 'tablet';
      } else if (/Mobile|Android|iP(hone|od)|IEMobile|BlackBerry|Kindle|NetFront/i.test(ua)) {
        this.deviceType = 'mobile';
      } else {
        this.deviceType = 'desktop';
      }

      this.send('pageview', window.location.pathname);
    } catch (e) {}
  },

  send(type, details) {
    try {
      const payload = {
        type,
        sessionId: this.sessionId,
        device: this.deviceType,
        details: String(details || '').slice(0, 100)
      };

      fetch('/api/metrics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        keepalive: true
      }).catch(() => {});
    } catch (e) {}
  }
};

// Admin In-Map Actions
async function archiveCamera(camId) {
  const cam = allCameras.find(c => String(c.id) === String(camId));
  const camName = cam ? cam.name : camId;

  if (!confirm(`Archiver / Supprimer définitivement la caméra "${camName}" de la carte ?`)) {
    return;
  }

  // 1. Save to local archived list to persist across reloads
  try {
    const raw = localStorage.getItem('eyefinder_archived_cameras');
    const archived = raw ? JSON.parse(raw) : [];
    if (!archived.includes(String(camId))) {
      archived.push(String(camId));
      localStorage.setItem('eyefinder_archived_cameras', JSON.stringify(archived));
    }
  } catch (e) {}

  // 2. Remove locally and re-render
  allCameras = allCameras.filter(c => String(c.id) !== String(camId));
  if (map) map.closePopup();
  renderMapMarkers();
  renderSidebarList();
  updateStats();
  showToastNotification(`Caméra "${camName}" archivée.`);

  // 3. Sync deletion to server API if admin token exists
  const token = getAdminToken();
  if (token) {
    try {
      await fetch('/api/admin/cameras/delete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'X-Admin-Key': token
        },
        body: JSON.stringify({ id: camId })
      });
    } catch (err) {
      console.warn('API delete camera error (persisted locally):', err);
    }
  }
}

async function toggleCameraStatusOnMap(camId, currentStatus) {
  const newStatus = currentStatus === 'down' ? 'operational' : 'down';
  const cam = allCameras.find(c => String(c.id) === String(camId));
  if (!cam) return;

  cam.status = newStatus;
  cam.last_checked = new Date().toISOString();

  renderMapMarkers();
  renderSidebarList();
  updateStats();
  showToastNotification(`Statut basculé: ${newStatus.toUpperCase()}`);

  setTimeout(() => {
    markersLayer.eachLayer(layer => {
      if (layer.camData && String(layer.camData.id) === String(camId)) {
        layer.openPopup();
      }
    });
  }, 100);

  const token = getAdminToken();
  if (token) {
    try {
      await fetch('/api/admin/cameras/status', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'X-Admin-Key': token
        },
        body: JSON.stringify({ id: camId, status: newStatus })
      });
    } catch (err) {
      console.warn('API status toggle error:', err);
    }
  }
}

function openMapEditModal(camId) {
  const cam = allCameras.find(c => String(c.id) === String(camId));
  if (!cam) return;

  const modal = document.getElementById('map-edit-modal');
  if (!modal) return;

  const idInput = document.getElementById('edit-cam-id');
  const nameInput = document.getElementById('edit-cam-name');
  const latInput = document.getElementById('edit-cam-lat');
  const lonInput = document.getElementById('edit-cam-lon');
  const urlInput = document.getElementById('edit-cam-url');
  const typeSelect = document.getElementById('edit-cam-type');
  const statusSelect = document.getElementById('edit-cam-status');

  if (idInput) idInput.value = cam.id;
  if (nameInput) nameInput.value = cam.name || '';
  if (latInput) latInput.value = cam.latitude;
  if (lonInput) lonInput.value = cam.longitude;
  if (urlInput) urlInput.value = cam.stream_url || '';
  if (typeSelect) typeSelect.value = getCameraType(cam) === 'picture' ? 'picture' : 'live';
  if (statusSelect) statusSelect.value = cam.status === 'down' ? 'down' : 'operational';

  modal.classList.remove('hidden');
}

function closeMapEditModal() {
  const modal = document.getElementById('map-edit-modal');
  if (modal) modal.classList.add('hidden');
}

async function handleMapEditSubmit(e) {
  e.preventDefault();
  const id = document.getElementById('edit-cam-id')?.value;
  const name = document.getElementById('edit-cam-name')?.value.trim();
  const latitude = parseFloat(document.getElementById('edit-cam-lat')?.value);
  const longitude = parseFloat(document.getElementById('edit-cam-lon')?.value);
  const stream_url = document.getElementById('edit-cam-url')?.value.trim();
  const type = document.getElementById('edit-cam-type')?.value;
  const status = document.getElementById('edit-cam-status')?.value;

  if (!id || !name || isNaN(latitude) || isNaN(longitude) || !stream_url) {
    alert('Champs obligatoires invalides.');
    return;
  }

  const camIndex = allCameras.findIndex(c => String(c.id) === String(id));
  if (camIndex === -1) return;

  const updatedCam = {
    ...allCameras[camIndex],
    name,
    latitude,
    longitude,
    stream_url,
    status,
    is_snapshot: type === 'picture',
    last_checked: new Date().toISOString()
  };

  allCameras[camIndex] = updatedCam;

  closeMapEditModal();
  renderMapMarkers();
  renderSidebarList();
  updateStats();
  showToastNotification(`Caméra "${name}" modifiée.`);

  map.flyTo([latitude, longitude], 13, { duration: 0.8 });
  setTimeout(() => {
    markersLayer.eachLayer(layer => {
      if (layer.camData && String(layer.camData.id) === String(id)) {
        layer.setLatLng([latitude, longitude]);
        layer.openPopup();
      }
    });
  }, 900);

  const token = getAdminToken();
  if (token) {
    try {
      await fetch('/api/admin/cameras/edit', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'X-Admin-Key': token
        },
        body: JSON.stringify({
          id,
          name,
          latitude,
          longitude,
          stream_url,
          status,
          city: updatedCam.city || '',
          country: updatedCam.country || 'Global'
        })
      });
    } catch (err) {
      console.warn('API camera update error:', err);
    }
  }
}

function showToastNotification(msg) {
  const toast = document.getElementById('map-toast');
  if (!toast) return;
  toast.textContent = msg;
  toast.classList.remove('hidden');
  setTimeout(() => {
    toast.classList.add('hidden');
  }, 3200);
}

function updateAdminHeaderStatus() {
  if (!isAdmin()) return;
  const brandTitle = document.querySelector('.brand-title');
  if (brandTitle && !document.getElementById('admin-badge-indicator')) {
    const badge = document.createElement('span');
    badge.id = 'admin-badge-indicator';
    badge.className = 'badge-tag';
    badge.style.borderColor = 'var(--status-green)';
    badge.style.color = 'var(--status-green)';
    badge.textContent = 'ADMIN ON';
    brandTitle.parentNode.insertBefore(badge, brandTitle.nextSibling);
  }
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

      Telemetry.send('filter', activeFilter);

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

  // Map Quick-Edit Modal Listeners
  const closeEditBtn = document.getElementById('btn-close-map-edit');
  if (closeEditBtn) closeEditBtn.addEventListener('click', closeMapEditModal);

  const cancelEditBtn = document.getElementById('btn-cancel-map-edit');
  if (cancelEditBtn) cancelEditBtn.addEventListener('click', closeMapEditModal);

  const mapEditForm = document.getElementById('map-edit-form');
  if (mapEditForm) mapEditForm.addEventListener('submit', handleMapEditSubmit);

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeMapEditModal();
  });

  // Popup in-map admin action buttons event delegation
  document.addEventListener('click', (e) => {
    const archiveBtn = e.target.closest('.btn-archive-cam');
    if (archiveBtn) {
      const camId = archiveBtn.dataset.camId;
      if (camId) archiveCamera(camId);
      return;
    }

    const toggleBtn = e.target.closest('.btn-toggle-status');
    if (toggleBtn) {
      const camId = toggleBtn.dataset.camId;
      const status = toggleBtn.dataset.camStatus;
      if (camId) toggleCameraStatusOnMap(camId, status);
      return;
    }

    const editBtn = e.target.closest('.btn-edit-cam');
    if (editBtn) {
      const camId = editBtn.dataset.camId;
      if (camId) openMapEditModal(camId);
      return;
    }
  });

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
  updateAdminHeaderStatus();
  Telemetry.init();
});
