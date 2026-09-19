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
  return [...SEED_CAMERAS];
}

// Fallback local file writer
function writeLocalCameras(cameras) {
  ensureLocalDir();
  try {
    fs.writeFileSync(LOCAL_DATA_PATH, JSON.stringify(cameras, null, 2), 'utf-8');
  } catch (err) {}
}

// Read cameras from Supabase (via native REST API) or fallback to seed
async function getCameras() {
  if (hasSupabase) {
    try {
      const response = await fetch(`${cleanUrl}/rest/v1/cameras?select=*&order=name.asc`, {
        method: 'GET',
        headers: {
          'apikey': cleanKey,
          'Authorization': `Bearer ${cleanKey}`,
          'Accept': 'application/json'
        },
        signal: AbortSignal.timeout(1500)
      });

      if (response.ok) {
        const data = await response.json();
        if (Array.isArray(data) && data.length > 0) {
          return data;
        }
      }
    } catch (err) {}
  }
  return readLocalCameras();
}

// Update status and last_checked of a single camera
async function updateCameraStatus(id, status) {
  const last_checked = new Date().toISOString();

  if (hasSupabase) {
    try {
      await fetch(`${cleanUrl}/rest/v1/cameras?id=eq.${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: {
          'apikey': cleanKey,
          'Authorization': `Bearer ${cleanKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ status, last_checked }),
        signal: AbortSignal.timeout(1500)
      });
    } catch (e) {}
  }

  return true;
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
      const response = await fetch(`${cleanUrl}/rest/v1/cameras`, {
        method: 'POST',
        headers: {
          'apikey': cleanKey,
          'Authorization': `Bearer ${cleanKey}`,
          'Content-Type': 'application/json',
          'Prefer': 'resolution=merge-duplicates,return=representation'
        },
        body: JSON.stringify(formatted),
        signal: AbortSignal.timeout(2000)
      });

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
