const fs = require('fs');
const path = require('path');
const { SEED_CAMERAS } = require('./seed');

// Format and sanitize Supabase URL and key from environment variables
let cleanUrl = (process.env.SUPABASE_URL || '').trim().replace(/^["']|["']$/g, '');
if (cleanUrl && !cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
  cleanUrl = `https://${cleanUrl}`;
}
// Remove trailing slash if present
if (cleanUrl.endsWith('/')) {
  cleanUrl = cleanUrl.slice(0, -1);
}

const cleanKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '').trim().replace(/^["']|["']$/g, '');

const hasSupabase = Boolean(cleanUrl && cleanKey);

// Detect Vercel serverless environment (where only /tmp is writable)
const isVercel = Boolean(process.env.VERCEL);
const LOCAL_DATA_PATH = isVercel
  ? path.join('/tmp', 'cameras.json')
  : path.join(__dirname, '..', 'data', 'cameras.json');

function ensureLocalDir() {
  try {
    const dir = path.dirname(LOCAL_DATA_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  } catch (err) {}
}

// Fallback local file reader
function readLocalCameras() {
  ensureLocalDir();
  if (fs.existsSync(LOCAL_DATA_PATH)) {
    try {
      const content = fs.readFileSync(LOCAL_DATA_PATH, 'utf-8');
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    } catch (err) {}
  }

  // Also check project data folder
  try {
    const projectDataPath = path.join(__dirname, '..', 'data', 'cameras.json');
    if (LOCAL_DATA_PATH !== projectDataPath && fs.existsSync(projectDataPath)) {
      const content = fs.readFileSync(projectDataPath, 'utf-8');
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (e) {}

  return [...SEED_CAMERAS];
}

// Fallback local file writer
function writeLocalCameras(cameras) {
  ensureLocalDir();
  try {
    fs.writeFileSync(LOCAL_DATA_PATH, JSON.stringify(cameras, null, 2), 'utf-8');
  } catch (err) {
    console.warn('[EyeFinder DB] Local write failed:', err.message);
  }
}

// Read cameras from Supabase (via native REST API) or local JSON
async function getCameras() {
  if (hasSupabase) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 1500);

      const response = await fetch(`${cleanUrl}/rest/v1/cameras?select=*&order=name.asc`, {
        method: 'GET',
        headers: {
          'apikey': cleanKey,
          'Authorization': `Bearer ${cleanKey}`,
          'Accept': 'application/json'
        },
        signal: controller.signal
      });

      clearTimeout(timer);

      if (response.ok) {
        const data = await response.json();
        if (Array.isArray(data) && data.length > 0) {
          return data;
        }
      } else {
        console.warn(`[EyeFinder DB] Supabase returned status ${response.status}`);
      }
    } catch (err) {
      console.warn('[EyeFinder DB] Supabase query exception, falling back:', err.message);
    }
  }
  return readLocalCameras();
}

// Update status and last_checked of a single camera
async function updateCameraStatus(id, status) {
  const last_checked = new Date().toISOString();

  if (hasSupabase) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 4000);

      await fetch(`${cleanUrl}/rest/v1/cameras?id=eq.${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: {
          'apikey': cleanKey,
          'Authorization': `Bearer ${cleanKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ status, last_checked }),
        signal: controller.signal
      });

      clearTimeout(timer);
    } catch (e) {}
  }

  const cameras = readLocalCameras();
  const index = cameras.findIndex(c => c.id === id);
  if (index !== -1) {
    cameras[index].status = status;
    cameras[index].last_checked = last_checked;
    writeLocalCameras(cameras);
    return true;
  }
  return false;
}

// Batch upsert cameras
async function upsertCameras(camerasList) {
  const now = new Date().toISOString();
  const formatted = camerasList.map(cam => ({
    ...cam,
    status: cam.status || 'operational',
    last_checked: cam.last_checked || now
  }));

  if (hasSupabase) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(`${cleanUrl}/rest/v1/cameras`, {
        method: 'POST',
        headers: {
          'apikey': cleanKey,
          'Authorization': `Bearer ${cleanKey}`,
          'Content-Type': 'application/json',
          'Prefer': 'resolution=merge-duplicates,return=representation'
        },
        body: JSON.stringify(formatted),
        signal: controller.signal
      });

      clearTimeout(timer);

      if (response.ok) {
        const data = await response.json();
        if (Array.isArray(data) && data.length > 0) {
          return data;
        }
      }
    } catch (e) {}
  }

  writeLocalCameras(formatted);
  return formatted;
}

module.exports = {
  getCameras,
  updateCameraStatus,
  upsertCameras,
  isUsingSupabase: () => hasSupabase
};
