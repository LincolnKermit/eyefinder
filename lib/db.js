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
  try {
    if (fs.existsSync(LOCAL_DATA_PATH)) {
      const content = fs.readFileSync(LOCAL_DATA_PATH, 'utf-8');
      const data = JSON.parse(content);
      if (Array.isArray(data) && data.length > 0) {
        return data;
      }
    }
  } catch (err) {}
  return [...SEED_CAMERAS];
}

// Fallback local file writer (syncs data/cameras.json and public/seed.json)
function writeLocalCameras(cameras) {
  ensureLocalDir();
  try {
    fs.writeFileSync(LOCAL_DATA_PATH, JSON.stringify(cameras, null, 2), 'utf-8');
  } catch (err) {}

  // Sync to public/seed.json and lib/seed.js for static/offline consistency
  if (!isVercel) {
    try {
      const publicSeedPath = path.join(__dirname, '..', 'public', 'seed.json');
      const payload = {
        total: cameras.length,
        operational: cameras.filter(c => c.status === 'operational').length,
        down: cameras.filter(c => c.status === 'down').length,
        archived: cameras.filter(c => c.status === 'archived').length,
        last_updated: new Date().toISOString(),
        cameras
      };
      fs.writeFileSync(publicSeedPath, JSON.stringify(payload, null, 2), 'utf-8');

      const seedJsPath = path.join(__dirname, '..', 'lib', 'seed.js');
      const seedContent = `// Auto-generated seed cameras list\nconst SEED_CAMERAS = ${JSON.stringify(cameras, null, 2)};\n\nmodule.exports = { SEED_CAMERAS };\n`;
      fs.writeFileSync(seedJsPath, seedContent, 'utf-8');
    } catch (err) {}
  }
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

  const current = await getCameras();
  const target = current.find(c => String(c.id) === String(id));
  if (target) {
    target.status = status;
    target.last_checked = last_checked;
    writeLocalCameras(current);
  }

  return true;
}

// Batch upsert cameras (merges with existing database)
async function upsertCameras(camerasList) {
  const current = await getCameras();
  const map = new Map();
  for (const c of current) {
    if (c && c.id) map.set(String(c.id), c);
  }
  const now = new Date().toISOString();
  for (const cam of camerasList) {
    const existing = map.get(String(cam.id)) || {};
    map.set(String(cam.id), {
      ...existing,
      ...cam,
      status: cam.status || existing.status || 'operational',
      last_checked: cam.last_checked || now
    });
  }
  const merged = Array.from(map.values());

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
        body: JSON.stringify(camerasList),
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

  writeLocalCameras(merged);
  return merged;
}

// Overwrite all cameras with a new list
async function saveAllCameras(camerasList) {
  if (hasSupabase) {
    try {
      await fetch(`${cleanUrl}/rest/v1/cameras`, {
        method: 'POST',
        headers: {
          'apikey': cleanKey,
          'Authorization': `Bearer ${cleanKey}`,
          'Content-Type': 'application/json',
          'Prefer': 'resolution=merge-duplicates,return=representation'
        },
        body: JSON.stringify(camerasList),
        signal: AbortSignal.timeout(2500)
      });
    } catch (e) {}
  }
  writeLocalCameras(camerasList);
  return camerasList;
}

// Delete camera by ID
async function deleteCamera(id) {
  const current = await getCameras();
  const filtered = current.filter(c => String(c.id) !== String(id));
  if (filtered.length !== current.length) {
    if (hasSupabase) {
      try {
        await fetch(`${cleanUrl}/rest/v1/cameras?id=eq.${encodeURIComponent(id)}`, {
          method: 'DELETE',
          headers: {
            'apikey': cleanKey,
            'Authorization': `Bearer ${cleanKey}`
          },
          signal: AbortSignal.timeout(2000)
        });
      } catch (e) {}
    }
    writeLocalCameras(filtered);
    return true;
  }
  return false;
}

module.exports = {
  getCameras,
  updateCameraStatus,
  upsertCameras,
  saveAllCameras,
  deleteCamera,
  isUsingSupabase: () => hasSupabase
};

