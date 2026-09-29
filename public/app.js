/**
 * Eyefinder — Minimalist & Premium Application Controller
 * Handles dynamic stealth mounting, passkey verification, interactive map, and feeds.
 */

// Enforce strict no-referrer policy globally across all document clicks and window.open
if (typeof document !== 'undefined') {
  document.addEventListener('click', (e) => {
    const link = e.target.closest('a');
    if (link && link.href) {
      link.rel = 'noreferrer noopener';
      link.referrerPolicy = 'no-referrer';
    }
  }, true);

  if (typeof window !== 'undefined' && window.open) {
    const _origWindowOpen = window.open;
    window.open = function(url, target, features) {
      const extra = 'noreferrer,noopener';
      const feat = features ? `${features},${extra}` : extra;
      return _origWindowOpen.call(window, url, target, feat);
    };
  }
}

// Passkey Hashes (SHA-256)
const DEFAULT_ADMIN_HASH = '849f50b3c48b66ab0649f74eea7e21f70c81bd6951823176084bcbced215ea90'; // eyefinder-admin-2024
const DEFAULT_VISITOR_HASH = 'a92f5e71d54b05874363556c1de8295453d15c9e7f1432c66a3136ef839adf49'; // eyefinder-2024

// Application State
let map = null;
let markersLayer = null;
let allCameras = [];
let activeFilter = 'all';
let searchQuery = '';
let isFeedsDrawerOpen = false;
let userRole = 'visitor';

// --------------------------------------------------------------------------
// 1. Cryptographic & Session Helpers
// --------------------------------------------------------------------------

async function sha256Hex(text) {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hashBuf = await crypto.subtle.digest('SHA-256', data);
  const hashArr = Array.from(new Uint8Array(hashBuf));
  return hashArr.map(b => b.toString(16).padStart(2, '0')).join('');
}

function getStoredAccessToken() {
  return localStorage.getItem('eyefinder_access_token') || sessionStorage.getItem('eyefinder_access_token') || '';
}

function setStoredAccessToken(token, remember = true) {
  if (remember) {
    localStorage.setItem('eyefinder_access_token', token);
  } else {
    sessionStorage.setItem('eyefinder_access_token', token);
  }
}

function clearStoredAccessToken() {
  localStorage.removeItem('eyefinder_access_token');
  sessionStorage.removeItem('eyefinder_access_token');
  localStorage.removeItem('eyefinder_admin_token');
}

// Inbound Telemetry Reporting (records visitor IP and interactions)
function sendVisitorTelemetry(type, details = '') {
  try {
    const payload = {
      type,
      details,
      device: window.innerWidth <= 768 ? 'Mobile' : (window.innerWidth <= 1024 ? 'Tablet' : 'Desktop'),
      referrer: document.referrer || 'Direct'
    };
    const bodyStr = JSON.stringify(payload);
    if (navigator.sendBeacon) {
      navigator.sendBeacon('/api/metrics', new Blob([bodyStr], { type: 'application/json' }));
    } else {
      fetch('/api/metrics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: bodyStr,
        keepalive: true
      }).catch(() => {});
    }
  } catch (e) {}
}

async function verifyPasskey(passkey) {
  if (!passkey) return { valid: false };

  // 1. Try server-side verification
  try {
    const res = await fetch('/api/auth/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ passkey })
    });
    if (res.ok) {
      const data = await res.json().catch(() => null);
      if (data && data.success) {
        return { valid: true, role: data.role || 'visitor', token: passkey };
      }
    } else if (res.status === 401 || res.status === 429) {
      const data = await res.json().catch(() => null);
      return { valid: false, error: (data && data.error) || 'Invalid access key.' };
    }
  } catch (e) {
    // Backend offline / static mode fallback
  }

  // 2. Client-side hash verification (Edge / static fallback)
  try {
    const hash = await sha256Hex(passkey);
    const customAdminHash = localStorage.getItem('eyefinder_custom_admin_hash');
    if (hash === DEFAULT_ADMIN_HASH || (customAdminHash && hash === customAdminHash)) {
      return { valid: true, role: 'admin', token: passkey };
    }
    if (hash === DEFAULT_VISITOR_HASH) {
      return { valid: true, role: 'visitor', token: passkey };
    }
  } catch (e) {}

  return { valid: false, error: 'Access denied. Invalid key.' };
}

// --------------------------------------------------------------------------
// 2. Dynamic Stealth Mounting & Unmounting
// --------------------------------------------------------------------------

function mountAppInterface() {
  const appView = document.getElementById('app-view');
  if (!appView) return;

  // Premium, minimalistic, uncrowded interface with Secret Service OSINT loading screen
  appView.innerHTML = `
    <!-- Secret Service / OSINT Loading Screen Overlay -->
    <div id="osint-loading-screen" class="loading-screen-overlay">
      <div class="osint-emblem-box">
        <svg class="osint-emblem-svg" viewBox="0 0 240 240" width="160" height="160" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <radialGradient id="optic-gradient" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stop-color="#ffffff"/>
              <stop offset="25%" stop-color="#38bdf8"/>
              <stop offset="65%" stop-color="#00e575"/>
              <stop offset="100%" stop-color="#005a2b"/>
            </radialGradient>
            <radialGradient id="radar-gradient" cx="0%" cy="0%" r="100%">
              <stop offset="0%" stop-color="#00e575" stop-opacity="0.32"/>
              <stop offset="50%" stop-color="#00e575" stop-opacity="0.08"/>
              <stop offset="100%" stop-color="#00e575" stop-opacity="0"/>
            </radialGradient>
            <filter id="glow-optic" x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation="3.5" result="blur"/>
              <feMerge>
                <feMergeNode in="blur"/>
                <feMergeNode in="SourceGraphic"/>
              </feMerge>
            </filter>
          </defs>

          <!-- Outer Fixed Compass / Azimuth Ring -->
          <circle cx="120" cy="120" r="114" fill="none" stroke="rgba(255,255,255,0.05)" stroke-width="1"/>
          <circle cx="120" cy="120" r="106" fill="none" stroke="rgba(255,255,255,0.12)" stroke-width="1.2"/>
          
          <!-- Cardinal Marks -->
          <text x="120" y="14" fill="rgba(0,229,117,0.75)" font-size="7" font-family="monospace" text-anchor="middle" font-weight="700">N // 000°</text>
          <text x="228" y="123" fill="rgba(255,255,255,0.4)" font-size="7" font-family="monospace" text-anchor="middle">E</text>
          <text x="120" y="233" fill="rgba(255,255,255,0.4)" font-size="7" font-family="monospace" text-anchor="middle">S</text>
          <text x="12" y="123" fill="rgba(255,255,255,0.4)" font-size="7" font-family="monospace" text-anchor="middle">W</text>

          <!-- Compass Hash Ticks -->
          <line x1="120" y1="16" x2="120" y2="24" stroke="rgba(0,229,117,0.6)" stroke-width="1.5"/>
          <line x1="120" y1="216" x2="120" y2="224" stroke="rgba(255,255,255,0.3)" stroke-width="1.5"/>
          <line x1="16" y1="120" x2="24" y2="120" stroke="rgba(255,255,255,0.3)" stroke-width="1.5"/>
          <line x1="216" y1="120" x2="224" y2="120" stroke="rgba(255,255,255,0.3)" stroke-width="1.5"/>

          <!-- Rotating Outer Target Ring (Clockwise) -->
          <g class="osint-rotate-cw">
            <circle cx="120" cy="120" r="95" fill="none" stroke="rgba(0,229,117,0.3)" stroke-width="1.5" stroke-dasharray="24 16 6 16 48 16"/>
            <circle cx="120" cy="120" r="88" fill="none" stroke="rgba(56,189,248,0.2)" stroke-width="1" stroke-dasharray="8 8"/>
            <path d="M 120 28 L 120 34 M 120 206 L 120 212 M 28 120 L 34 120 M 206 120 L 212 120" stroke="rgba(0,229,117,0.5)" stroke-width="1.5"/>
          </g>

          <!-- Rotating Inner Calibration Track (Counter-Clockwise) -->
          <g class="osint-rotate-ccw">
            <circle cx="120" cy="120" r="76" fill="none" stroke="rgba(255,255,255,0.15)" stroke-width="1" stroke-dasharray="12 12"/>
            <path d="M 66 120 L 72 120 M 168 120 L 174 120 M 120 66 L 120 72 M 120 168 L 120 174" stroke="#38bdf8" stroke-width="2"/>
            <polygon points="120,44 116,52 124,52" fill="#00e575"/>
            <polygon points="120,196 116,188 124,188" fill="#38bdf8"/>
          </g>

          <!-- Radar Sweep Group -->
          <g class="osint-radar-sweep">
            <path d="M 120 120 L 120 35 A 85 85 0 0 1 180 60 Z" fill="url(#radar-gradient)"/>
            <line x1="120" y1="120" x2="180" y2="60" stroke="#00e575" stroke-width="1.8" filter="url(#glow-optic)"/>
          </g>

          <!-- Concentric Range Circles -->
          <circle cx="120" cy="120" r="62" fill="none" stroke="rgba(255,255,255,0.06)" stroke-width="1"/>
          <circle cx="120" cy="120" r="46" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="1" stroke-dasharray="4 4"/>
          <circle cx="120" cy="120" r="32" fill="none" stroke="rgba(255,255,255,0.1)" stroke-width="1"/>

          <!-- Tactical Surveillance Eye Geometry -->
          <g class="osint-eye-frame">
            <path d="M 68 120 Q 120 72 172 120 Q 120 168 68 120 Z" fill="rgba(6,9,14,0.85)" stroke="#00e575" stroke-width="2" filter="url(#glow-optic)"/>
            <path d="M 76 120 Q 120 82 164 120 Q 120 158 76 120 Z" fill="none" stroke="rgba(56,189,248,0.4)" stroke-width="1"/>
            
            <path d="M 62 116 L 68 120 L 62 124" fill="none" stroke="#00e575" stroke-width="1.5"/>
            <path d="M 178 116 L 172 120 L 178 124" fill="none" stroke="#00e575" stroke-width="1.5"/>
            
            <circle cx="120" cy="120" r="23" fill="none" stroke="#38bdf8" stroke-width="1.5" stroke-dasharray="6 3"/>
            <circle cx="120" cy="120" r="18" fill="rgba(0,229,117,0.08)" stroke="#00e575" stroke-width="1"/>

            <g class="osint-optic-core">
              <circle cx="120" cy="120" r="11" fill="url(#optic-gradient)" filter="url(#glow-optic)"/>
              <circle cx="120" cy="120" r="3.5" fill="#ffffff"/>
            </g>

            <line x1="102" y1="120" x2="108" y2="120" stroke="#ffffff" stroke-width="1.2"/>
            <line x1="132" y1="120" x2="138" y2="120" stroke="#ffffff" stroke-width="1.2"/>
            <line x1="120" y1="102" x2="120" y2="108" stroke="#ffffff" stroke-width="1.2"/>
            <line x1="120" y1="132" x2="120" y2="138" stroke="#ffffff" stroke-width="1.2"/>
          </g>
        </svg>
      </div>

      <div class="osint-loading-meta">
        <div class="osint-agency-title">EYEFINDER</div>
        <div class="osint-agency-sub">OPTICAL SURVEILLANCE & RECON // OSINT GRID</div>
        <div class="osint-progress-bar-wrap">
          <div class="osint-progress-bar-fill"></div>
        </div>
        <div id="osint-telemetry" class="osint-telemetry-text">INITIALIZING OPTICAL SENSORS...</div>
      </div>
    </div>

    <header class="app-header">
      <div class="header-left">
        <div class="header-brand">
          <span class="live-dot"></span>
          <span class="header-title">Eyefinder</span>
          <span class="header-status-pill" id="header-status-pill">● 0 online</span>
        </div>
      </div>

      <div class="header-center">
        <div class="search-bar">
          <svg class="search-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input type="text" id="camera-search" placeholder="Search location or feed..." autocomplete="off" spellcheck="false" />
          <button id="search-clear" class="search-clear hidden">✕</button>
        </div>

        <div class="filter-pills">
          <button class="filter-pill active" data-filter="all">All</button>
          <button class="filter-pill" data-filter="france">France</button>
          <button class="filter-pill" data-filter="swiss">Suisse</button>
          <button class="filter-pill" data-filter="live">Live</button>
          <button class="filter-pill" data-filter="picture">Snapshot</button>
          <button class="filter-pill" data-filter="down">Offline</button>
        </div>
      </div>

      <div class="header-right">
        <button id="btn-toggle-feeds" class="header-btn" title="Toggle Feeds Drawer">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
          <span class="desktop-only">Feeds</span>
          <span class="pill-badge" id="feeds-count-badge">0</span>
        </button>

        <a href="/admin.html" class="header-btn icon-only" title="Admin Portal">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
        </a>

        <button id="btn-lock" class="header-btn icon-only" title="Lock Session">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
        </button>
      </div>
    </header>

    <main class="app-main">
      <div id="map" class="map-viewport"></div>

      <aside id="feeds-drawer" class="feeds-drawer">
        <div class="drawer-header">
          <div>
            <h3 class="drawer-title">Active Feeds</h3>
            <p class="drawer-subtitle" id="drawer-subtitle">Showing all available feeds</p>
          </div>
          <button id="btn-close-drawer" class="drawer-close-btn">✕</button>
        </div>
        <div id="feed-list" class="drawer-list"></div>
      </aside>
    </main>
  `;

  appView.classList.remove('hidden');

  // Setup UI event listeners
  setupAppEvents();
}

function unmountAppInterface() {
  if (telemetryTimer) {
    clearInterval(telemetryTimer);
    telemetryTimer = null;
  }
  const appView = document.getElementById('app-view');
  if (appView) {
    appView.innerHTML = '';
    appView.classList.add('hidden');
  }
  if (map) {
    try { map.remove(); } catch (e) {}
    map = null;
    markersLayer = null;
  }
  allCameras = [];
}

// --------------------------------------------------------------------------
// 3. Map Initialization & Management
// --------------------------------------------------------------------------

function initMap() {
  const mapEl = document.getElementById('map');
  if (!mapEl) return;

  map = L.map('map', {
    center: [46.15, 5.4], // Centered in France/Switzerland region
    zoom: 7,
    minZoom: 3,
    maxZoom: 18,
    zoomControl: false
  });

  // 1. ESRI World Dark Gray Canvas (Default: Premium Dark Mode, No Watermark, No API Key Required)
  const esriDarkBase = L.tileLayer(
    'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}',
    {
      attribution: '&copy; <a href="https://www.esri.com/" target="_blank" rel="noopener">Esri</a> &copy; OpenStreetMap contributors',
      maxZoom: 19,
      maxNativeZoom: 16
    }
  );

  const esriDarkRef = L.tileLayer(
    'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}',
    {
      attribution: '',
      maxZoom: 19,
      maxNativeZoom: 16,
      opacity: 0.85
    }
  );

  // Combined Dark Tactical Canvas (Default Base)
  const darkCanvasGroup = L.layerGroup([esriDarkBase, esriDarkRef]).addTo(map);

  // 2. OpenStreetMap with Dark Tactical CSS Filter (100% Free & Open Source, No API Key)
  const osmDarkLayer = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors',
    maxZoom: 19,
    className: 'osm-dark-tiles'
  });

  // 3. ESRI Satellite Imagery with Reference Labels (Satellite Hybrid)
  const satelliteBase = L.tileLayer(
    'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    {
      attribution: '&copy; <a href="https://www.esri.com/" target="_blank" rel="noopener">Esri</a>, Maxar, Earthstar Geographics',
      maxZoom: 19,
      maxNativeZoom: 18
    }
  );
  const satelliteGroup = L.layerGroup([satelliteBase, esriDarkRef]);

  // Basemap switcher
  const baseMaps = {
    '🌙 Dark Canvas (Esri)': darkCanvasGroup,
    '🗺️ OpenStreetMap (Dark)': osmDarkLayer,
    '🛰️ Satellite (Hybrid)': satelliteGroup
  };
  L.control.layers(baseMaps, null, { position: 'bottomright', collapsed: true }).addTo(map);

  // Custom Zoom Control at bottom right
  L.control.zoom({ position: 'bottomright' }).addTo(map);

  markersLayer = L.layerGroup().addTo(map);

  // Auto-refresh popup snapshots
  let popupRefreshTimer = null;
  map.on('popupopen', (e) => {
    if (popupRefreshTimer) clearInterval(popupRefreshTimer);
    const popupEl = e.popup.getElement();
    const feedImg = popupEl ? popupEl.querySelector('.popup-snapshot-img') : null;
    if (feedImg && feedImg.dataset.src) {
      popupRefreshTimer = setInterval(() => {
        const cleanUrl = feedImg.dataset.src.split('?')[0];
        feedImg.src = `${cleanUrl}?_t=${Date.now()}`;
      }, 60000);
    }
  });

  map.on('popupclose', () => {
    if (popupRefreshTimer) {
      clearInterval(popupRefreshTimer);
      popupRefreshTimer = null;
    }
  });

  // Ensure map is properly calibrated to viewport dimensions
  setTimeout(() => {
    if (map) map.invalidateSize();
  }, 100);
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function sanitizeUrl(raw) {
  if (!raw || typeof raw !== 'string') return '';
  const clean = raw.trim();
  if (clean.startsWith('http://') || clean.startsWith('https://')) return clean;
  return '';
}

function extractYoutubeId(url, explicitId) {
  if (explicitId) return explicitId;
  if (!url || typeof url !== 'string') return '';
  const m = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/i);
  return m ? m[1] : '';
}

function isNativeVideoUrl(url) {
  if (!url || typeof url !== 'string') return false;
  const clean = url.split('?')[0].toLowerCase();
  return clean.endsWith('.mp4') || clean.endsWith('.webm') || clean.endsWith('.ogg');
}

function isMjpegUrl(url, cam) {
  if (cam && cam.is_mjpeg) return true;
  if (!url || typeof url !== 'string') return false;
  const lower = url.toLowerCase();
  return lower.includes('mjpg') || 
         lower.includes('mjpeg') || 
         lower.includes('faststream') || 
         lower.includes('.cgi') || 
         lower.includes('oneshotimage') || 
         lower.includes('getdata');
}

function isWebpageUrl(url) {
  if (!url || typeof url !== 'string') return false;
  const lower = url.toLowerCase();
  return lower.includes('skylinewebcams.com') ||
         lower.includes('viewsurf.com') ||
         lower.includes('earthcam.com') ||
         lower.includes('camscape.com') ||
         lower.includes('sensibleweather.com') ||
         lower.includes('sydneyoperahouse.com') ||
         lower.includes('berlin.de/webcams') ||
         lower.endsWith('.html') ||
         lower.endsWith('.htm');
}

function createMarkerIcon(cam) {
  const isDown = cam.status === 'down';
  const ytId = extractYoutubeId(cam.stream_url, cam.youtube_id);
  const isVideo = ytId || isNativeVideoUrl(cam.stream_url) || isMjpegUrl(cam.stream_url, cam);
  
  let markerClass = 'marker-live';
  if (isDown) markerClass = 'marker-down';
  else if (!isVideo) markerClass = 'marker-snapshot';

  return L.divIcon({
    className: 'custom-cam-marker',
    html: `<div class="marker-inner ${markerClass}"></div>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
    popupAnchor: [0, -10]
  });
}

function createPopupContent(cam) {
  const isDown = cam.status === 'down';
  const ytId = extractYoutubeId(cam.stream_url, cam.youtube_id);
  const isNativeVideo = !ytId && isNativeVideoUrl(cam.stream_url);
  const isMjpeg = !ytId && !isNativeVideo && isMjpegUrl(cam.stream_url, cam);
  const isWebpage = !ytId && !isNativeVideo && !isMjpeg && isWebpageUrl(cam.stream_url);

  const rawThumb = cam.preview_image || (isWebpage ? '' : (isNativeVideo ? '' : cam.stream_url));
  const thumb = sanitizeUrl(rawThumb);
  const streamUrl = sanitizeUrl(cam.stream_url);

  let mediaHtml = '';
  let badgeText = 'Snapshot';

  if (ytId) {
    badgeText = 'Live Stream';
    mediaHtml = `
      <iframe 
        src="https://www.youtube-nocookie.com/embed/${encodeURIComponent(ytId)}?autoplay=0" 
        referrerpolicy="no-referrer"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
        allowfullscreen>
      </iframe>
    `;
  } else if (isNativeVideo && streamUrl) {
    badgeText = 'Live Video';
    // Native HTML5 video with fail-safe error catcher for Firefox
    mediaHtml = `
      <div class="video-container" style="position:relative; width:100%; height:100%; overflow:hidden;">
        <video 
          autoplay 
          muted 
          loop 
          playsinline 
          controls 
          referrerpolicy="no-referrer"
          poster="${escapeHtml(thumb)}"
          style="width:100%; height:100%; object-fit:cover;"
          onerror="this.style.display='none'; if(this.nextElementSibling) this.nextElementSibling.style.display='flex';"
        >
          <source src="${streamUrl}" type="video/mp4" referrerpolicy="no-referrer">
        </video>
        <div class="video-fallback" style="display:none; position:absolute; top:0; left:0; width:100%; height:100%; background:#0d1117; flex-direction:column; align-items:center; justify-content:center; padding:12px; text-align:center;">
          ${thumb ? `<img src="${thumb}" referrerpolicy="no-referrer" alt="" style="position:absolute; top:0; left:0; width:100%; height:100%; object-fit:cover; opacity:0.35;">` : ''}
          <div style="position:relative; z-index:1; font-size:12px; color:var(--text-secondary); margin-bottom:8px;">Flux vidéo externe</div>
          <a href="${streamUrl}" target="_blank" rel="noopener noreferrer" referrerpolicy="no-referrer" class="popup-btn primary" style="position:relative; z-index:1; width:auto; padding:6px 14px; font-size:11px;">
            Lire le flux direct ↗
          </a>
        </div>
      </div>
    `;
  } else if (isMjpeg && streamUrl) {
    badgeText = 'Live Stream';
    // Motion-JPEG renders natively as live continuous stream in <img> in Firefox, Chrome, Edge, Safari
    mediaHtml = `
      <img 
        src="${streamUrl}" 
        referrerpolicy="no-referrer"
        class="popup-feed-img popup-mjpeg-stream" 
        alt="${escapeHtml(cam.name)}" 
        loading="lazy"
        onerror="this.onerror=null; ${thumb ? `this.src='${thumb}';` : `this.style.opacity='0.3';`}"
      />
    `;
  } else if (thumb || streamUrl) {
    const imgSrc = thumb || streamUrl;
    badgeText = cam.is_snapshot ? 'Snapshot' : 'Live Cam';
    mediaHtml = `
      <img 
        src="${imgSrc}" 
        data-src="${imgSrc}" 
        referrerpolicy="no-referrer"
        class="popup-snapshot-img popup-feed-img" 
        alt="${escapeHtml(cam.name)}" 
        loading="lazy" 
        onerror="this.style.opacity='0.3';" 
      />
    `;
  } else {
    badgeText = 'Unavailable';
    mediaHtml = `<div style="font-size: 12px; color: var(--text-tertiary); text-align: center; padding: 20px;">Flux actuellement indisponible</div>`;
  }

  // Dynamic portal label
  let portalLabel = 'Source ↗';
  if (cam.insecam_url) {
    if (cam.insecam_url.includes('dir-est.fr')) portalLabel = 'DIR-Est ↗';
    else if (cam.insecam_url.includes('centre-est')) portalLabel = 'DIR-CE ↗';
    else if (cam.insecam_url.includes('massif-central')) portalLabel = 'DIR-MC ↗';
    else if (cam.insecam_url.includes('insecam.org')) portalLabel = 'Insecam ↗';
    else if (cam.insecam_url.includes('skylinewebcams')) portalLabel = 'Skyline ↗';
  }

  return `
    <div class="popup-container">
      <div class="popup-header-row">
        <h4 class="popup-cam-title">${escapeHtml(cam.name)}</h4>
        <div class="popup-cam-meta">
          <span>${escapeHtml(cam.city || cam.source || '')}</span>
          <span class="${isDown ? 'popup-badge-down' : 'popup-badge-live'}">${isDown ? 'Offline' : badgeText}</span>
        </div>
      </div>

      <div class="popup-media-box">
        ${mediaHtml}
      </div>

      <div class="popup-actions-row">
        ${streamUrl ? `
          <a href="${streamUrl}" target="_blank" rel="noopener noreferrer" referrerpolicy="no-referrer" class="popup-btn primary">
            ${isWebpage ? 'Ouvrir la caméra ↗' : 'Flux direct ↗'}
          </a>
        ` : ''}
        ${cam.insecam_url ? `
          <a href="${sanitizeUrl(cam.insecam_url)}" target="_blank" rel="noopener noreferrer" referrerpolicy="no-referrer" class="popup-btn">
            ${portalLabel}
          </a>
        ` : ''}
      </div>
    </div>
  `;
}

function renderMapMarkers() {
  if (!markersLayer) return;
  markersLayer.clearLayers();

  const query = searchQuery.toLowerCase().trim();
  const seenCoords = {};

  allCameras.forEach(cam => {
    // Filter matching
    if (activeFilter === 'live' && (cam.status !== 'operational' || cam.is_snapshot)) return;
    if (activeFilter === 'picture' && (cam.status !== 'operational' || !cam.is_snapshot)) return;
    if (activeFilter === 'down' && cam.status !== 'down') return;
    if (activeFilter === 'france' && (cam.country || '').toLowerCase() !== 'france') return;
    if (activeFilter === 'swiss' && (cam.country || '').toLowerCase() !== 'switzerland' && (cam.city || '').toLowerCase() !== 'geneva') return;

    if (query) {
      const matchName = (cam.name || '').toLowerCase().includes(query);
      const matchCity = (cam.city || '').toLowerCase().includes(query);
      const matchSource = (cam.source || '').toLowerCase().includes(query);
      if (!matchName && !matchCity && !matchSource) return;
    }

    if (typeof cam.latitude !== 'number' || typeof cam.longitude !== 'number') return;

    let lat = cam.latitude;
    let lng = cam.longitude;
    const coordKey = `${lat.toFixed(4)},${lng.toFixed(4)}`;
    if (seenCoords[coordKey] !== undefined) {
      seenCoords[coordKey]++;
      const index = seenCoords[coordKey];
      const angle = index * 2.39996; // Golden angle (~137.5 deg)
      const radius = 0.00035 * Math.sqrt(index); // ~35m to 50m fan out
      lat += radius * Math.cos(angle);
      lng += (radius * Math.sin(angle)) / Math.max(0.1, Math.cos(lat * Math.PI / 180));
    } else {
      seenCoords[coordKey] = 0;
    }

    const marker = L.marker([lat, lng], {
      icon: createMarkerIcon(cam)
    });

    marker.bindPopup(createPopupContent(cam), {
      maxWidth: 340,
      closeButton: false
    });
    marker.on('popupopen', () => {
      sendVisitorTelemetry('camera_view', cam.name);
    });

    markersLayer.addLayer(marker);
  });
}

function renderDrawerList() {
  const listEl = document.getElementById('feed-list');
  if (!listEl) return;

  const query = searchQuery.toLowerCase().trim();
  const visibleCams = allCameras.filter(cam => {
    if (activeFilter === 'live' && (cam.status !== 'operational' || cam.is_snapshot)) return false;
    if (activeFilter === 'picture' && (cam.status !== 'operational' || !cam.is_snapshot)) return false;
    if (activeFilter === 'down' && cam.status !== 'down') return false;
    if (activeFilter === 'france' && (cam.country || '').toLowerCase() !== 'france') return false;
    if (activeFilter === 'swiss' && (cam.country || '').toLowerCase() !== 'switzerland' && (cam.city || '').toLowerCase() !== 'geneva') return false;

    if (query) {
      const matchName = (cam.name || '').toLowerCase().includes(query);
      const matchCity = (cam.city || '').toLowerCase().includes(query);
      const matchSource = (cam.source || '').toLowerCase().includes(query);
      if (!matchName && !matchCity && !matchSource) return false;
    }
    return true;
  });

  const badgeEl = document.getElementById('feeds-count-badge');
  if (badgeEl) badgeEl.textContent = visibleCams.length;

  const subtitleEl = document.getElementById('drawer-subtitle');
  if (subtitleEl) subtitleEl.textContent = `${visibleCams.length} feeds found`;

  listEl.innerHTML = visibleCams.map(cam => {
    const isWp = isWebpageUrl(cam.stream_url);
    const isNv = isNativeVideoUrl(cam.stream_url);
    const rawThumb = cam.preview_image || (isWp || isNv ? '' : cam.stream_url) || '';
    const thumb = sanitizeUrl(rawThumb);
    return `
      <div class="feed-card" data-cam-id="${escapeHtml(cam.id)}">
        <img class="feed-thumb" src="${thumb}" referrerpolicy="no-referrer" alt="" loading="lazy" onerror="this.style.opacity='0.2';" />
        <div class="feed-info">
          <div class="feed-name">${escapeHtml(cam.name)}</div>
          <div class="feed-meta">
            <span class="feed-status-dot ${isDown ? 'down' : 'live'}"></span>
            <span>${escapeHtml(cam.city || cam.source || '')}</span>
          </div>
        </div>
      </div>
    `;
  }).join('');

  // Click to center on camera
  listEl.querySelectorAll('.feed-card').forEach(card => {
    card.addEventListener('click', () => {
      const id = card.dataset.camId;
      const target = allCameras.find(c => c.id === id);
      if (target && map) {
        sendVisitorTelemetry('camera_view', target.name);
        map.flyTo([target.latitude, target.longitude], 14, { duration: 1.2 });
        // Find and open marker popup
        markersLayer.eachLayer(layer => {
          const latLng = layer.getLatLng();
          if (Math.abs(latLng.lat - target.latitude) < 0.0001 && Math.abs(latLng.lng - target.longitude) < 0.0001) {
            setTimeout(() => layer.openPopup(), 1200);
          }
        });
      }
    });
  });
}

// --------------------------------------------------------------------------
// 4. Data Loading & Feed Synchronization
// --------------------------------------------------------------------------

async function loadCameras() {
  const token = getStoredAccessToken();
  if (!token) {
    lockSession();
    return;
  }

  try {
    const res = await fetch('/api/cameras', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'x-access-token': token
      }
    });

    if (res.status === 401) {
      clearStoredAccessToken();
      lockSession('Session expired. Please enter access key.');
      return;
    }

    if (res.ok) {
      const data = await res.json();
      const cams = Array.isArray(data) ? data : (data && data.cameras ? data.cameras : []);
      if (cams.length) {
        allCameras = cams;
        updateHeaderCounters();
        renderMapMarkers();
        renderDrawerList();
        return;
      }
    }
  } catch (e) {
    console.warn('API error, attempting authenticated fallback:', e);
  }

  // Fallback to seed.json with token
  try {
    const seedRes = await fetch('/seed.json', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'x-access-token': token
      }
    });
    if (seedRes.status === 401) {
      clearStoredAccessToken();
      lockSession('Access restricted.');
      return;
    }
    if (seedRes.ok) {
      const seedData = await seedRes.json();
      const cams = Array.isArray(seedData) ? seedData : (seedData && seedData.cameras ? seedData.cameras : []);
      if (cams.length) {
        allCameras = cams;
        updateHeaderCounters();
        renderMapMarkers();
        renderDrawerList();
      }
    }
  } catch (e) {}
}

function updateHeaderCounters() {
  const opCount = allCameras.filter(c => c.status === 'operational').length;
  const pillEl = document.getElementById('header-status-pill');
  if (pillEl) {
    pillEl.textContent = `● ${opCount} online`;
  }
}

// --------------------------------------------------------------------------
// 5. User Interaction & Event Handlers
// --------------------------------------------------------------------------

function setupAppEvents() {
  // Search Bar
  const searchInput = document.getElementById('camera-search');
  const searchClear = document.getElementById('search-clear');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      searchQuery = e.target.value;
      if (searchClear) searchClear.classList.toggle('hidden', !searchQuery);
      renderMapMarkers();
      renderDrawerList();
    });
  }

  if (searchClear && searchInput) {
    searchClear.addEventListener('click', () => {
      searchInput.value = '';
      searchQuery = '';
      searchClear.classList.add('hidden');
      renderMapMarkers();
      renderDrawerList();
      searchInput.focus();
    });
  }

  // Filter Pills
  document.querySelectorAll('.filter-pill').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter-pill').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeFilter = btn.dataset.filter;
      sendVisitorTelemetry('filter', activeFilter);
      renderMapMarkers();
      renderDrawerList();
    });
  });

  // Feeds Drawer Toggle
  const btnToggleFeeds = document.getElementById('btn-toggle-feeds');
  const btnCloseDrawer = document.getElementById('btn-close-drawer');
  const drawer = document.getElementById('feeds-drawer');

  if (btnToggleFeeds && drawer) {
    btnToggleFeeds.addEventListener('click', () => {
      isFeedsDrawerOpen = !isFeedsDrawerOpen;
      drawer.classList.toggle('open', isFeedsDrawerOpen);
      setTimeout(() => { if (map) map.invalidateSize(); }, 250);
    });
  }

  if (btnCloseDrawer && drawer) {
    btnCloseDrawer.addEventListener('click', () => {
      isFeedsDrawerOpen = false;
      drawer.classList.remove('open');
      setTimeout(() => { if (map) map.invalidateSize(); }, 250);
    });
  }

  window.addEventListener('resize', () => {
    if (map) map.invalidateSize();
  });

  // Lock Button
  const btnLock = document.getElementById('btn-lock');
  if (btnLock) {
    btnLock.addEventListener('click', () => {
      clearStoredAccessToken();
      lockSession();
      showToast('Session locked.');
    });
  }
}

function showToast(msg) {
  const toast = document.getElementById('app-toast');
  if (!toast) return;
  toast.textContent = msg;
  toast.classList.remove('hidden');
  setTimeout(() => toast.classList.add('hidden'), 3000);
}

function lockSession(errorMsg = '') {
  unmountAppInterface();
  const loginView = document.getElementById('login-view');
  if (loginView) {
    loginView.classList.remove('hidden');
    const input = document.getElementById('gate-passkey-input');
    if (input) {
      input.value = '';
      setTimeout(() => input.focus(), 100);
    }
    const errEl = document.getElementById('gate-error');
    if (errEl) {
      if (errorMsg) {
        errEl.textContent = errorMsg;
        errEl.classList.remove('hidden');
      } else {
        errEl.classList.add('hidden');
      }
    }
  }
}

let loadingStartTime = 0;
let telemetryTimer = null;

function startLoadingTelemetry() {
  loadingStartTime = Date.now();
  const telEl = document.getElementById('osint-telemetry');
  if (!telEl) return;

  const messages = [
    'INITIALIZING OPTICAL SENSORS...',
    'CONNECTING TO SATELLITE RELAY...',
    'CALIBRATING GEOSPATIAL COORDINATES...',
    'SYNCHRONIZING FEED NETWORK...'
  ];
  let idx = 0;
  telEl.textContent = messages[0];

  if (telemetryTimer) clearInterval(telemetryTimer);
  telemetryTimer = setInterval(() => {
    idx = (idx + 1) % messages.length;
    if (telEl) telEl.textContent = messages[idx];
  }, 260);
}

function finishLoadingScreen() {
  if (telemetryTimer) {
    clearInterval(telemetryTimer);
    telemetryTimer = null;
  }
  const telEl = document.getElementById('osint-telemetry');
  if (telEl) telEl.textContent = 'OPTICAL GRID DEPLOYED // READY';

  const elapsed = Date.now() - loadingStartTime;
  // Ensure the tactical animation is smoothly visible (at least 950ms)
  const remaining = Math.max(0, 950 - elapsed);

  setTimeout(() => {
    const screen = document.getElementById('osint-loading-screen');
    if (screen) {
      screen.classList.add('fade-out');
      setTimeout(() => {
        if (map) map.invalidateSize();
        screen.remove();
      }, 700);
    }
  }, remaining);
}

async function unlockSession(passkey, role = 'visitor') {
  userRole = role;
  const loginView = document.getElementById('login-view');
  if (loginView) loginView.classList.add('hidden');

  mountAppInterface();
  startLoadingTelemetry();
  initMap();
  await loadCameras();
  finishLoadingScreen();
}

// --------------------------------------------------------------------------
// 6. Bootstrap & Login Gate Listener
// --------------------------------------------------------------------------

function setupLoginGate() {
  const form = document.getElementById('gate-form');
  const input = document.getElementById('gate-passkey-input');
  const errorEl = document.getElementById('gate-error');
  const btnTogglePw = document.getElementById('btn-toggle-pw');
  const rememberCheckbox = document.getElementById('gate-remember-me');

  if (btnTogglePw && input) {
    btnTogglePw.addEventListener('click', () => {
      const isPw = input.type === 'password';
      input.type = isPw ? 'text' : 'password';
    });
  }

  if (form && input) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const passkey = input.value.trim();
      if (!passkey) return;

      const submitBtn = document.getElementById('btn-unlock-gate');
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span>Verifying...</span>';
      }

      if (errorEl) errorEl.classList.add('hidden');

      const result = await verifyPasskey(passkey);

      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = `
          <span>Enter</span>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
        `;
      }

      if (result.valid) {
        sendVisitorTelemetry('auth_success', `Gate unlocked (${result.role})`);
        const remember = rememberCheckbox ? rememberCheckbox.checked : true;
        setStoredAccessToken(passkey, remember);
        if (result.role === 'admin') {
          localStorage.setItem('eyefinder_admin_token', passkey);
        }
        await unlockSession(passkey, result.role);
      } else {
        sendVisitorTelemetry('auth_failed', 'Gate access failed');
        if (errorEl) {
          errorEl.textContent = result.error || 'Invalid access key.';
          errorEl.classList.remove('hidden');
        }
        input.select();
      }
    });
  }
}

// Initialize on DOM load
window.addEventListener('DOMContentLoaded', async () => {
  setupLoginGate();
  sendVisitorTelemetry('pageview', 'Main Portal Accessed');

  const token = getStoredAccessToken();
  if (token) {
    const res = await verifyPasskey(token);
    if (res.valid) {
      if (res.role === 'admin') {
        localStorage.setItem('eyefinder_admin_token', token);
      }
      await unlockSession(token, res.role);
      return;
    } else {
      clearStoredAccessToken();
    }
  }

  // Not authenticated: ensure login is shown and app view is completely empty
  lockSession();
});
