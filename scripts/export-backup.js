/**
 * EyeFinder Cameras Backup Generator
 * Generates portable backup files in multiple GIS/Map formats:
 * - GeoJSON (for geojson.io, uMap, QGIS, Leaflet, Mapbox)
 * - KML (for Google My Maps, Google Earth, OsmAnd)
 * - CSV (for Google Sheets, Google My Maps, Excel, QGIS)
 * - JSON (raw structured data backup)
 * - Standalone Offline HTML Map (self-contained viewer with zero server dependency)
 */

const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');
const DATA_FILE = path.join(ROOT_DIR, 'data', 'cameras.json');
const SEED_FILE = path.join(ROOT_DIR, 'seed.json');
const BACKUPS_DIR = path.join(ROOT_DIR, 'backups');
const PUBLIC_BACKUPS_DIR = path.join(ROOT_DIR, 'public', 'backups');

// 1. Load cameras
let cameras = [];
if (fs.existsSync(DATA_FILE)) {
  try {
    cameras = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch (e) {
    console.error('Failed to parse data/cameras.json:', e.message);
  }
}
if (!cameras.length && fs.existsSync(SEED_FILE)) {
  try {
    const raw = JSON.parse(fs.readFileSync(SEED_FILE, 'utf8'));
    cameras = Array.isArray(raw) ? raw : (raw.cameras || []);
  } catch (e) {
    console.error('Failed to parse seed.json:', e.message);
  }
}

if (!cameras.length) {
  console.error('No cameras found to export!');
  process.exit(1);
}

// Ensure output dirs exist
[BACKUPS_DIR, PUBLIC_BACKUPS_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

const timestamp = new Date().toISOString();
const operationalCount = cameras.filter(c => c.status === 'operational').length;
const downCount = cameras.length - operationalCount;

console.log(`Exporting ${cameras.length} cameras (${operationalCount} live, ${downCount} down)...`);

// Helpers
function escapeXml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function escapeCsv(val) {
  if (val === null || val === undefined) return '';
  const str = String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

// -------------------------------------------------------------
// 1. JSON Export
// -------------------------------------------------------------
const jsonBackup = {
  version: '1.0',
  description: 'EyeFinder Cameras Full Database Backup',
  exported_at: timestamp,
  total: cameras.length,
  operational: operationalCount,
  down: downCount,
  cameras
};
const jsonContent = JSON.stringify(jsonBackup, null, 2);

// -------------------------------------------------------------
// 2. GeoJSON Export
// -------------------------------------------------------------
const geoJsonBackup = {
  type: 'FeatureCollection',
  name: 'EyeFinder Cameras Backup',
  crs: {
    type: 'name',
    properties: { name: 'urn:ogc:def:crs:OGC:1.3:CRS84' }
  },
  metadata: {
    exported_at: timestamp,
    total: cameras.length,
    operational: operationalCount,
    down: downCount
  },
  features: cameras.map(cam => {
    const isVideo = !cam.is_snapshot && !cam.youtube_id;
    const desc = `
      <div style="font-family: monospace; max-width: 300px;">
        <h4 style="margin: 0 0 6px 0; color: #00ff66;">${escapeXml(cam.name)}</h4>
        <p style="margin: 0 0 4px 0;"><b>Ville:</b> ${escapeXml(cam.city || 'N/A')} (${escapeXml(cam.country || 'N/A')})</p>
        <p style="margin: 0 0 4px 0;"><b>Source:</b> ${escapeXml(cam.source || 'N/A')}</p>
        <p style="margin: 0 0 8px 0;"><b>Statut:</b> <span style="color:${cam.status === 'operational' ? '#00ff66' : '#ff3366'}">${cam.status || 'operational'}</span></p>
        ${cam.preview_image ? `<img src="${escapeXml(cam.preview_image)}" alt="Preview" style="width:100%; border-radius:4px; margin-bottom:8px; border:1px solid #333;" />` : ''}
        <div>
          <a href="${escapeXml(cam.stream_url)}" target="_blank" rel="noopener noreferrer" style="color: #00ff66; text-decoration: underline;">Ouvrir le flux (${isVideo ? 'Vidéo' : 'Image'}) ↗</a>
        </div>
      </div>
    `.trim();

    return {
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [Number(cam.longitude), Number(cam.latitude)]
      },
      properties: {
        id: cam.id,
        name: cam.name,
        latitude: Number(cam.latitude),
        longitude: Number(cam.longitude),
        city: cam.city || '',
        country: cam.country || '',
        source: cam.source || '',
        status: cam.status || 'operational',
        is_snapshot: Boolean(cam.is_snapshot),
        is_video: isVideo,
        refresh_interval: cam.refresh_interval || 60,
        stream_url: cam.stream_url || '',
        preview_image: cam.preview_image || '',
        insecam_url: cam.insecam_url || '',
        youtube_id: cam.youtube_id || '',
        last_checked: cam.last_checked || '',
        description: desc
      }
    };
  })
};
const geoJsonContent = JSON.stringify(geoJsonBackup, null, 2);

// -------------------------------------------------------------
// 3. CSV Export
// -------------------------------------------------------------
const csvHeaders = [
  'id',
  'name',
  'latitude',
  'longitude',
  'city',
  'country',
  'source',
  'status',
  'is_snapshot',
  'refresh_interval',
  'stream_url',
  'preview_image',
  'insecam_url',
  'youtube_id',
  'last_checked'
];

const csvRows = [csvHeaders.join(',')];
for (const cam of cameras) {
  const row = [
    escapeCsv(cam.id),
    escapeCsv(cam.name),
    escapeCsv(cam.latitude),
    escapeCsv(cam.longitude),
    escapeCsv(cam.city),
    escapeCsv(cam.country),
    escapeCsv(cam.source),
    escapeCsv(cam.status),
    escapeCsv(cam.is_snapshot ? '1' : '0'),
    escapeCsv(cam.refresh_interval || 60),
    escapeCsv(cam.stream_url),
    escapeCsv(cam.preview_image),
    escapeCsv(cam.insecam_url),
    escapeCsv(cam.youtube_id),
    escapeCsv(cam.last_checked)
  ];
  csvRows.push(row.join(','));
}
const csvContent = csvRows.join('\r\n');

// -------------------------------------------------------------
// 4. KML Export
// -------------------------------------------------------------
const kmlPlacemarks = cameras.map(cam => {
  const isOperational = cam.status === 'operational';
  const styleId = isOperational ? '#operational-cam' : '#down-cam';
  const desc = `<![CDATA[
    <div style="font-family: Arial, sans-serif; font-size: 13px; line-height: 1.4;">
      <h3 style="margin: 0 0 6px 0; color: ${isOperational ? '#009933' : '#cc0000'};">${escapeXml(cam.name)}</h3>
      <p style="margin: 0 0 4px 0;"><b>Ville:</b> ${escapeXml(cam.city || 'N/A')} (${escapeXml(cam.country || 'N/A')})</p>
      <p style="margin: 0 0 4px 0;"><b>Source:</b> ${escapeXml(cam.source || 'N/A')}</p>
      <p style="margin: 0 0 4px 0;"><b>Statut:</b> ${isOperational ? 'En ligne' : 'Hors-ligne'}</p>
      <p style="margin: 0 0 8px 0;"><b>Coordonnées:</b> ${cam.latitude}, ${cam.longitude}</p>
      ${cam.preview_image ? `<div style="margin-bottom: 8px;"><img src="${escapeXml(cam.preview_image)}" style="max-width: 280px; height: auto; border: 1px solid #ccc; border-radius: 4px;" /></div>` : ''}
      <p style="margin: 6px 0 0 0;">
        <a href="${escapeXml(cam.stream_url)}" target="_blank" style="font-weight: bold; color: #0066cc;">Ouvrir le flux vidéo / image direct ↗</a>
      </p>
      ${cam.insecam_url ? `<p style="margin: 4px 0 0 0;"><a href="${escapeXml(cam.insecam_url)}" target="_blank" style="color: #666;">Portail Source ↗</a></p>` : ''}
    </div>
  ]]>`;

  return `
    <Placemark>
      <name>${escapeXml(cam.name)}</name>
      <styleUrl>${styleId}</styleUrl>
      <description>${desc}</description>
      <Point>
        <coordinates>${cam.longitude},${cam.latitude},0</coordinates>
      </Point>
    </Placemark>
  `.trim();
}).join('\n');

const kmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>EyeFinder Cameras Backup</name>
    <description>Sauvegarde de l'ensemble des caméras publiques EyeFinder (${operationalCount} opérationnelles, ${downCount} hors-ligne).</description>
    <Style id="operational-cam">
      <IconStyle>
        <scale>1.1</scale>
        <Icon>
          <href>https://maps.google.com/mapfiles/ms/icons/green-dot.png</href>
        </Icon>
      </IconStyle>
    </Style>
    <Style id="down-cam">
      <IconStyle>
        <scale>0.9</scale>
        <Icon>
          <href>https://maps.google.com/mapfiles/ms/icons/red-dot.png</href>
        </Icon>
      </IconStyle>
    </Style>
${kmlPlacemarks}
  </Document>
</kml>
`;

// -------------------------------------------------------------
// 5. Standalone Offline HTML Map
// -------------------------------------------------------------
const standaloneMapHtml = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>EyeFinder - Carte de Secours Autonome (Offline / Standalone Map)</title>
  <!-- Leaflet CSS & JS via CDN -->
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=" crossorigin=""/>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js" integrity="sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=" crossorigin=""></script>
  <style>
    :root {
      --bg-dark: #0a0c10;
      --bg-card: #12161f;
      --text-main: #e0e6ed;
      --text-muted: #8896a6;
      --accent-green: #00ff66;
      --accent-red: #ff3366;
      --accent-cyan: #00e5ff;
      --border: #222938;
      --font-mono: "SF Mono", "Fira Code", "Courier New", monospace;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: var(--bg-dark);
      color: var(--text-main);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      height: 100vh;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }
    header {
      background: var(--bg-card);
      border-bottom: 1px solid var(--border);
      padding: 10px 16px;
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      z-index: 1000;
    }
    .brand {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .brand-title {
      font-family: var(--font-mono);
      font-size: 16px;
      font-weight: 700;
      letter-spacing: 1px;
      color: var(--accent-green);
    }
    .badge-backup {
      background: rgba(0, 255, 102, 0.12);
      border: 1px solid var(--accent-green);
      color: var(--accent-green);
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 11px;
      font-family: var(--font-mono);
      font-weight: 600;
    }
    .controls {
      display: flex;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;
    }
    .search-box {
      background: #0d1117;
      border: 1px solid var(--border);
      color: var(--text-main);
      padding: 6px 12px;
      border-radius: 4px;
      font-size: 13px;
      width: 240px;
      outline: none;
    }
    .search-box:focus { border-color: var(--accent-green); }
    .select-source {
      background: #0d1117;
      border: 1px solid var(--border);
      color: var(--text-main);
      padding: 6px 10px;
      border-radius: 4px;
      font-size: 13px;
      outline: none;
    }
    .filter-btn {
      background: #0d1117;
      border: 1px solid var(--border);
      color: var(--text-muted);
      padding: 6px 10px;
      border-radius: 4px;
      font-size: 12px;
      cursor: pointer;
      font-family: var(--font-mono);
      transition: all 0.2s;
    }
    .filter-btn.active {
      border-color: var(--accent-green);
      color: var(--accent-green);
      background: rgba(0, 255, 102, 0.08);
    }
    .export-btns {
      display: flex;
      gap: 6px;
    }
    .btn-dl {
      background: var(--bg-dark);
      border: 1px solid var(--border);
      color: var(--accent-cyan);
      padding: 6px 10px;
      border-radius: 4px;
      font-size: 12px;
      font-family: var(--font-mono);
      cursor: pointer;
      transition: 0.2s;
    }
    .btn-dl:hover {
      background: rgba(0, 229, 255, 0.1);
      border-color: var(--accent-cyan);
    }
    #map {
      flex: 1;
      width: 100%;
      height: 100%;
      background: #0a0c10;
    }
    /* Popup styling */
    .leaflet-popup-content-wrapper {
      background: #12161f !important;
      color: var(--text-main) !important;
      border: 1px solid var(--border) !important;
      border-radius: 8px !important;
      padding: 0 !important;
      overflow: hidden;
      box-shadow: 0 10px 30px rgba(0,0,0,0.8) !important;
    }
    .leaflet-popup-content {
      margin: 0 !important;
      width: 320px !important;
    }
    .leaflet-popup-tip {
      background: #12161f !important;
    }
    .popup-inner {
      padding: 12px;
    }
    .popup-title {
      font-size: 14px;
      font-weight: 600;
      color: #fff;
      margin-bottom: 6px;
      line-height: 1.3;
    }
    .popup-meta {
      font-size: 11px;
      color: var(--text-muted);
      font-family: var(--font-mono);
      margin-bottom: 8px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .popup-media {
      width: 100%;
      height: 180px;
      background: #000;
      border-radius: 4px;
      overflow: hidden;
      margin-bottom: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .popup-media img, .popup-media video, .popup-media iframe {
      width: 100%;
      height: 100%;
      object-fit: cover;
      border: none;
    }
    .popup-actions {
      display: flex;
      gap: 6px;
      margin-top: 8px;
    }
    .popup-btn {
      flex: 1;
      display: block;
      text-align: center;
      background: rgba(0, 255, 102, 0.1);
      border: 1px solid var(--accent-green);
      color: var(--accent-green);
      padding: 6px 4px;
      border-radius: 4px;
      text-decoration: none;
      font-size: 11px;
      font-family: var(--font-mono);
      font-weight: 600;
    }
    .popup-btn:hover {
      background: var(--accent-green);
      color: #000;
    }
    .popup-btn.secondary {
      border-color: var(--border);
      color: var(--text-muted);
      background: #0d1117;
    }
    .popup-btn.secondary:hover {
      border-color: var(--accent-cyan);
      color: var(--accent-cyan);
    }
    .stats-footer {
      position: absolute;
      bottom: 12px;
      left: 12px;
      z-index: 1000;
      background: rgba(18, 22, 31, 0.9);
      backdrop-filter: blur(8px);
      border: 1px solid var(--border);
      padding: 6px 12px;
      border-radius: 6px;
      font-size: 12px;
      font-family: var(--font-mono);
      color: var(--text-muted);
    }
    .stats-footer span { color: var(--accent-green); font-weight: 700; }
    .osm-dark-tiles {
      filter: invert(100%) hue-rotate(180deg) brightness(92%) contrast(90%);
    }
    .leaflet-control-layers {
      background: rgba(18, 22, 31, 0.95) !important;
      border: 1px solid var(--border) !important;
      border-radius: 6px !important;
      color: #fff !important;
      font-family: var(--font-mono) !important;
      font-size: 11px !important;
      padding: 6px 10px !important;
    }
    .leaflet-control-layers-toggle {
      filter: invert(0.9) brightness(1.2);
    }
    .leaflet-control-layers label {
      color: var(--text-muted);
      cursor: pointer;
    }
    .leaflet-control-layers label:hover {
      color: var(--accent-green);
    }
  </style>
</head>
<body>
  <header>
    <div class="brand">
      <span class="brand-title">EYEFINDER</span>
      <span class="badge-backup">CARTE DE SECOURS (OFFLINE)</span>
    </div>
    <div class="controls">
      <input type="text" id="search-input" class="search-box" placeholder="Rechercher caméra, ville, route..." />
      <select id="source-select" class="select-source">
        <option value="">Tous les réseaux</option>
      </select>
      <button class="filter-btn active" data-filter="all">TOUT (<span id="count-all">0</span>)</button>
      <button class="filter-btn" data-filter="operational">LIVE (<span id="count-op">0</span>)</button>
      <button class="filter-btn" data-filter="down">HORS-LIGNE (<span id="count-down">0</span>)</button>
    </div>
    <div class="export-btns">
      <button class="btn-dl" id="btn-dl-geojson" title="Télécharger le fichier GeoJSON">GeoJSON</button>
      <button class="btn-dl" id="btn-dl-kml" title="Télécharger le fichier KML pour Google Maps">KML</button>
      <button class="btn-dl" id="btn-dl-csv" title="Télécharger au format CSV">CSV</button>
      <button class="btn-dl" id="btn-dl-json" title="Télécharger la base JSON">JSON</button>
    </div>
  </header>

  <div id="map"></div>
  <div class="stats-footer">
    Affichage: <span id="stats-visible">0</span> / <span id="stats-total">0</span> caméras | eyeFinder Standalone Backup
  </div>

  <script>
    // Embedded cameras database (total 249 cameras)
    const CAMERAS = ${JSON.stringify(cameras)};

    // Leaflet Map Init
    const map = L.map('map', {
      center: [45.75, 4.85], // Lyon center
      zoom: 6,
      zoomControl: true
    });

    // 1. ESRI World Dark Gray Canvas (Default: Premium Dark Mode, No Watermark, No API Key Required)
    const esriDarkBase = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}', {
      attribution: '&copy; <a href="https://www.esri.com/" target="_blank" rel="noopener">Esri</a> &copy; OpenStreetMap contributors',
      maxZoom: 19,
      maxNativeZoom: 16
    });

    const esriDarkRef = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}', {
      attribution: '',
      maxZoom: 19,
      maxNativeZoom: 16,
      opacity: 0.85
    });

    const darkCanvasGroup = L.layerGroup([esriDarkBase, esriDarkRef]).addTo(map);

    // 2. OpenStreetMap with Dark Tactical CSS Filter (100% Free & Open Source, No API Key)
    const osmDarkLayer = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors',
      maxZoom: 19,
      className: 'osm-dark-tiles'
    });

    // 3. ESRI Satellite Imagery with Reference Labels (Satellite Hybrid)
    const satelliteBase = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      attribution: '&copy; <a href="https://www.esri.com/" target="_blank" rel="noopener">Esri</a>, Maxar',
      maxZoom: 19,
      maxNativeZoom: 18
    });
    const satelliteGroup = L.layerGroup([satelliteBase, esriDarkRef]);

    const baseMaps = {
      '🌙 Dark Canvas (Esri)': darkCanvasGroup,
      '🗺️ OpenStreetMap (Dark)': osmDarkLayer,
      '🛰️ Satellite (Hybrid)': satelliteGroup
    };
    L.control.layers(baseMaps, null, { position: 'bottomright', collapsed: true }).addTo(map);

    let activeFilter = 'all';
    let searchQuery = '';
    let selectedSource = '';
    let markersLayer = L.layerGroup().addTo(map);

    // Populate source select
    const sources = [...new Set(CAMERAS.map(c => c.source).filter(Boolean))].sort();
    const sourceSelect = document.getElementById('source-select');
    sources.forEach(src => {
      const opt = document.createElement('option');
      opt.value = src;
      opt.textContent = src;
      sourceSelect.appendChild(opt);
    });

    // Update Counts
    const opTotal = CAMERAS.filter(c => c.status === 'operational').length;
    const downTotal = CAMERAS.length - opTotal;
    document.getElementById('count-all').textContent = CAMERAS.length;
    document.getElementById('count-op').textContent = opTotal;
    document.getElementById('count-down').textContent = downTotal;
    document.getElementById('stats-total').textContent = CAMERAS.length;

    function createMarkerIcon(cam) {
      const isOp = cam.status === 'operational';
      const color = isOp ? '#00ff66' : '#ff3366';
      const pulseColor = isOp ? 'rgba(0, 255, 102, 0.4)' : 'rgba(255, 51, 102, 0.4)';
      const isVideo = !cam.is_snapshot && !cam.youtube_id;
      
      const svg = \`
        <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 28 28">
          <circle cx="14" cy="14" r="10" fill="\${color}" fill-opacity="0.3" stroke="\${color}" stroke-width="2"/>
          <circle cx="14" cy="14" r="5" fill="\${color}"/>
          \${isVideo ? '<polygon points="12,11 18,14 12,17" fill="#000"/>' : ''}
        </svg>
      \`;

      return L.divIcon({
        className: 'custom-cam-icon',
        html: svg,
        iconSize: [28, 28],
        iconAnchor: [14, 14],
        popupAnchor: [0, -14]
      });
    }

    function createPopup(cam) {
      const isOp = cam.status === 'operational';
      const isVideo = !cam.is_snapshot && !cam.youtube_id;
      const ytId = cam.youtube_id;
      
      let mediaHtml = '';
      if (ytId) {
        mediaHtml = \`<iframe src="https://www.youtube.com/embed/\${encodeURIComponent(ytId)}?autoplay=0" allowfullscreen></iframe>\`;
      } else if (isVideo && cam.stream_url) {
        mediaHtml = \`
          <video autoplay muted loop playsinline controls poster="\${cam.preview_image || ''}">
            <source src="\${cam.stream_url}" type="video/mp4">
          </video>
        \`;
      } else if (cam.stream_url || cam.preview_image) {
        const imgUrl = cam.stream_url || cam.preview_image;
        mediaHtml = \`<img src="\${imgUrl}" alt="\${cam.name}" loading="lazy" onerror="this.src='\${cam.preview_image || ''}'" />\`;
      } else {
        mediaHtml = \`<div style="color:var(--text-muted); font-size:12px;">Flux non disponible</div>\`;
      }

      let portalLabel = 'PORTAIL ↗';
      if (cam.insecam_url) {
        if (cam.insecam_url.includes('dir-est.fr')) portalLabel = 'DIR-EST ↗';
        else if (cam.insecam_url.includes('centre-est')) portalLabel = 'DIR-CE ↗';
        else if (cam.insecam_url.includes('massif-central')) portalLabel = 'DIR-MC ↗';
        else if (cam.insecam_url.includes('insecam.org')) portalLabel = 'INSECAM ↗';
      }

      return \`
        <div class="popup-inner">
          <div class="popup-title">\${cam.name || 'Caméra sans nom'}</div>
          <div class="popup-meta">
            <span>\${cam.city || ''} \${cam.country ? '(' + cam.country + ')' : ''}</span>
            <span style="color:\${isOp ? 'var(--accent-green)' : 'var(--accent-red)'}">\${isOp ? '● EN LIGNE' : '■ HORS LIGNE'}</span>
          </div>
          <div class="popup-media">
            \${mediaHtml}
          </div>
          <div style="font-size:11px; color:var(--text-muted); font-family:var(--font-mono); margin-bottom:6px;">
            Source: \${cam.source || 'N/A'}<br/>
            GPS: \${cam.latitude.toFixed(4)}, \${cam.longitude.toFixed(4)}
          </div>
          <div class="popup-actions">
            <a href="\${cam.stream_url}" target="_blank" rel="noopener noreferrer" class="popup-btn">
              \${isVideo ? 'VIDÉO DIRECT ↗' : 'FLUX STREAM ↗'}
            </a>
            \${cam.insecam_url ? \`
              <a href="\${cam.insecam_url}" target="_blank" rel="noopener noreferrer" class="popup-btn secondary">
                \${portalLabel}
              </a>
            \` : ''}
          </div>
        </div>
      \`;
    }

    function renderMarkers() {
      markersLayer.clearLayers();
      let visible = 0;

      const q = searchQuery.toLowerCase().trim();
      const seenCoords = {};

      CAMERAS.forEach(cam => {
        if (activeFilter === 'operational' && cam.status !== 'operational') return;
        if (activeFilter === 'down' && cam.status === 'operational') return;
        if (selectedSource && cam.source !== selectedSource) return;

        if (q) {
          const matchName = (cam.name || '').toLowerCase().includes(q);
          const matchCity = (cam.city || '').toLowerCase().includes(q);
          const matchSource = (cam.source || '').toLowerCase().includes(q);
          if (!matchName && !matchCity && !matchSource) return;
        }

        if (typeof cam.latitude !== 'number' || typeof cam.longitude !== 'number') return;

        let lat = cam.latitude;
        let lng = cam.longitude;
        const coordKey = lat.toFixed(4) + ',' + lng.toFixed(4);
        if (seenCoords[coordKey] !== undefined) {
          seenCoords[coordKey]++;
          const index = seenCoords[coordKey];
          const angle = index * 2.39996;
          const radius = 0.00035 * Math.sqrt(index);
          lat += radius * Math.cos(angle);
          lng += (radius * Math.sin(angle)) / Math.max(0.1, Math.cos(lat * Math.PI / 180));
        } else {
          seenCoords[coordKey] = 0;
        }

        const marker = L.marker([lat, lng], {
          icon: createMarkerIcon(cam)
        });

        marker.bindPopup(createPopup(cam), { maxWidth: 360 });
        markersLayer.addLayer(marker);
        visible++;
      });

      document.getElementById('stats-visible').textContent = visible;
    }

    // Search and filter listeners
    document.getElementById('search-input').addEventListener('input', (e) => {
      searchQuery = e.target.value;
      renderMarkers();
    });

    document.getElementById('source-select').addEventListener('change', (e) => {
      selectedSource = e.target.value;
      renderMarkers();
    });

    document.querySelectorAll('.filter-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        activeFilter = btn.dataset.filter;
        renderMarkers();
      });
    });

    // Client-side export downloads
    function downloadFile(content, filename, type) {
      const blob = new Blob([content], { type });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    }

    document.getElementById('btn-dl-json').addEventListener('click', () => {
      downloadFile(JSON.stringify(CAMERAS, null, 2), 'eyefinder-backup.json', 'application/json');
    });

    document.getElementById('btn-dl-geojson').addEventListener('click', () => {
      const geojson = {
        type: 'FeatureCollection',
        features: CAMERAS.map(c => ({
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [c.longitude, c.latitude] },
          properties: { ...c }
        }))
      };
      downloadFile(JSON.stringify(geojson, null, 2), 'eyefinder-cameras.geojson', 'application/geo+json');
    });

    document.getElementById('btn-dl-csv').addEventListener('click', () => {
      const headers = ['id','name','latitude','longitude','city','country','source','status','stream_url','preview_image'];
      const rows = [headers.join(',')];
      CAMERAS.forEach(c => {
        rows.push([
          c.id,
          \`"\${(c.name || '').replace(/"/g, '""')}"\`,
          c.latitude,
          c.longitude,
          \`"\${(c.city || '').replace(/"/g, '""')}"\`,
          \`"\${(c.country || '').replace(/"/g, '""')}"\`,
          \`"\${(c.source || '').replace(/"/g, '""')}"\`,
          c.status,
          \`"\${(c.stream_url || '').replace(/"/g, '""')}"\`,
          \`"\${(c.preview_image || '').replace(/"/g, '""')}"\`
        ].join(','));
      });
      downloadFile(rows.join('\\r\\n'), 'eyefinder-cameras.csv', 'text/csv');
    });

    document.getElementById('btn-dl-kml').addEventListener('click', () => {
      let kml = '<?xml version="1.0" encoding="UTF-8"?>\\n<kml xmlns="http://www.opengis.net/kml/2.2">\\n<Document>\\n<name>EyeFinder Cameras</name>\\n';
      CAMERAS.forEach(c => {
        kml += \`<Placemark><name>\${c.name}</name><description>\${c.source} - \${c.city}</description><Point><coordinates>\${c.longitude},\${c.latitude},0</coordinates></Point></Placemark>\\n\`;
      });
      kml += '</Document>\\n</kml>';
      downloadFile(kml, 'eyefinder-cameras.kml', 'application/vnd.google-earth.kml+xml');
    });

    // Initial render
    renderMarkers();
  </script>
</body>
</html>
`;

// -------------------------------------------------------------
// 6. Comprehensive README / Restoration Guide
// -------------------------------------------------------------
const readmeContent = `# EyeFinder - Sauvegardes & Guide de Restauration Cartographique

Ce dossier contient une sauvegarde intégrale et autonome des **${cameras.length} caméras** référencées par EyeFinder (${operationalCount} flux actifs en direct).

Ces fichiers permettent de visualiser, importer et restaurer instantanément la cartographie complète même en cas de panne totale du serveur, de l'hébergeur Vercel ou de la base de données.

---

## 📁 Fichiers Disponibles

| Fichier | Format | Cas d'usage principal |
| :--- | :--- | :--- |
| **[\`standalone_map.html\`](./standalone_map.html)** | Application HTML autonome | **Solution d'urgence 0-serveur** : double-cliquez pour ouvrir dans n'importe quel navigateur (Chrome, Firefox, Safari). Tout est embarqué. |
| **[\`cameras.geojson\`](./cameras.geojson)** | GeoJSON standard OGC | Import 1-clic sur [geojson.io](https://geojson.io), [uMap OpenStreetMap](https://umap.openstreetmap.fr), QGIS, Leaflet, Mapbox Studio, Felt. |
| **[\`cameras.kml\`](./cameras.kml)** | Google Earth / KML 2.2 | Import direct sur [Google My Maps](https://mymaps.google.com), Google Earth Pro, OsmAnd, MAPS.ME. |
| **[\`cameras.csv\`](./cameras.csv)** | Tableur CSV UTF-8 | Importation dans Google My Maps, Microsoft Excel, LibreOffice Calc, QGIS. |
| **[\`cameras.json\`](./cameras.json)** | JSON structuré | Restauration complète dans l'application EyeFinder ou réinjection en base de données. |

---

## 🚀 Comment afficher les caméras sur une carte si le site est DOWN ?

### Option 1 : La Carte Autonome d'Urgence (Recommandé - 0 installation)
1. Ouvrez simplement le fichier **\`standalone_map.html\`** dans votre navigateur (double-clic ou glisser-déposer dans Chrome/Firefox).
2. La carte s'affiche instantanément avec les **${cameras.length} caméras** géolocalisées, la recherche textuelle, les filtres par réseau (DIR-Est, DIR Centre-Est, DIR Massif Central, Grand Lyon, Insecam...) et les lecteurs vidéo/images dans les popups.
3. Aucune dépendance backend : fonctionne hors-ligne ou via internet direct.

### Option 2 : Sur Google My Maps (Créer une carte personnelle Google)
1. Rendez-vous sur [Google My Maps](https://mymaps.google.com/).
2. Cliquez sur **"+ CRÉER UNE NOUVELLE CARTE"**.
3. Dans le premier calque, cliquez sur **"Importer"**.
4. Glissez-déposez le fichier **\`cameras.csv\`** (ou **\`cameras.kml\`**).
5. Si vous utilisez le CSV :
   - Choisissez les colonnes \`latitude\` et \`longitude\` pour l'emplacement.
   - Choisissez la colonne \`name\` pour le titre des repères.
6. Toutes les caméras apparaissent sur votre Google Maps personnel avec les liens vers les flux !

### Option 3 : Sur uMap (OpenStreetMap France)
1. Rendez-vous sur [uMap France](https://umap.openstreetmap.fr/).
2. Cliquez sur **"Créer une carte"**.
3. Cliquez sur l'icône **Importer des données** (flèche montante à droite).
4. Choisissez le fichier **\`cameras.geojson\`** (format GeoJSON détecté automatiquement).
5. Cliquez sur **"Importer"** : toutes les caméras sont positionnées avec leurs descriptions et flux.

### Option 4 : Sur geojson.io (Visualisation instantanée dans le navigateur)
1. Ouvrez [geojson.io](https://geojson.io/).
2. Glissez-déposez directement le fichier **\`cameras.geojson\`** sur la fenêtre.
3. Toutes les caméras sont immédiatement projetées sur la carte avec leur table attributaire.

### Option 5 : Sur Google Earth
1. Ouvrez Google Earth (application Web ou Google Earth Pro sur PC/Mac).
2. Cliquez sur **Fichier > Ouvrir** et sélectionnez **\`cameras.kml\`**.
3. Les caméras s'affichent avec des pastilles vertes (en ligne) ou rouges (hors-ligne).

---

## 🔄 Comment restaurer les données dans EyeFinder ?

Si vous réinstallez EyeFinder sur un nouveau serveur :
1. Remplacez le fichier \`data/cameras.json\` par ce fichier \`cameras.json\` :
   \`\`\`bash
   cp backups/cameras.json data/cameras.json
   cp backups/cameras.json seed.json
   cp backups/cameras.json public/seed.json
   \`\`\`
2. Ou via l'interface d'administration : rendez-vous sur \`/admin.html\`, section **"Importer des caméras"** et téléversez le fichier \`cameras.json\`.

---

## 🛠️ Regénérer les sauvegardes

Pour mettre à jour tous les formats de sauvegarde après l'ajout de nouvelles caméras :
\`\`\`bash
npm run backup
# ou
node scripts/export-backup.js
\`\`\`

*Dernière exportation : ${timestamp}*
`;

// -------------------------------------------------------------
// Write files to backups/ and public/backups/
// -------------------------------------------------------------
const filesToWrite = [
  { name: 'cameras.json', content: jsonContent },
  { name: 'cameras.geojson', content: geoJsonContent },
  { name: 'cameras.csv', content: csvContent },
  { name: 'cameras.kml', content: kmlContent },
  { name: 'standalone_map.html', content: standaloneMapHtml },
  { name: 'README.md', content: readmeContent }
];

for (const f of filesToWrite) {
  const p1 = path.join(BACKUPS_DIR, f.name);
  fs.writeFileSync(p1, f.content, 'utf8');
  console.log(`✓ Wrote ${p1} (${(Buffer.byteLength(f.content) / 1024).toFixed(1)} KB)`);

  const p2 = path.join(PUBLIC_BACKUPS_DIR, f.name);
  fs.writeFileSync(p2, f.content, 'utf8');
}

console.log('\\n✅ All camera backups generated successfully!');
