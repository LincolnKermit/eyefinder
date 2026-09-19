const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const { SEED_CAMERAS } = require('./seed');

// Format and clean Supabase URL and key
let cleanUrl = (process.env.SUPABASE_URL || '').trim().replace(/^["']|["']$/g, '');
if (cleanUrl && !cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
  cleanUrl = `https://${cleanUrl}`;
}
const cleanKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '').trim().replace(/^["']|["']$/g, '');

let supabase = null;
if (cleanUrl && cleanKey) {
  try {
    supabase = createClient(cleanUrl, cleanKey, {
      auth: { persistSession: false }
    });
  } catch (err) {
    console.warn('[EyeFinder DB] Supabase initialization failed, using datastore:', err.message);
    supabase = null;
  }
}

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

// Read cameras from DB or local JSON
async function getCameras() {
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('cameras')
        .select('*')
        .order('name', { ascending: true });

      if (!error && data && data.length > 0) {
        return data;
      }
      if (error) {
        console.warn('[EyeFinder DB] Supabase query failed, falling back:', error.message);
      }
    } catch (err) {
      console.warn('[EyeFinder DB] Supabase exception:', err.message);
    }
  }
  return readLocalCameras();
}

// Update status and last_checked of a single camera
async function updateCameraStatus(id, status) {
  const last_checked = new Date().toISOString();

  if (supabase) {
    try {
      const { error } = await supabase
        .from('cameras')
        .update({ status, last_checked })
        .eq('id', id);

      if (!error) return true;
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

  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('cameras')
        .upsert(formatted, { onConflict: 'id' });

      if (!error && data) {
        return data;
      }
      if (error) {
        console.warn('[EyeFinder DB] Supabase upsert error:', error.message);
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
  isUsingSupabase: () => Boolean(supabase)
};
