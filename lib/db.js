const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const { SEED_CAMERAS } = require('./seed');

// Optional Supabase environment variables
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

// Detect Vercel serverless environment (where only /tmp is writable)
const isVercel = Boolean(process.env.VERCEL);
const LOCAL_DATA_PATH = isVercel
  ? path.join('/tmp', 'cameras.json')
  : path.join(__dirname, '..', 'data', 'cameras.json');

let supabase = null;
if (SUPABASE_URL && SUPABASE_KEY) {
  supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
}

function ensureLocalDir() {
  try {
    const dir = path.dirname(LOCAL_DATA_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  } catch (err) {
    // Ignore if directory exists or read-only
  }
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
    } catch (err) {
      console.warn('Could not parse local cameras file, using seed data:', err.message);
    }
  }

  // Also check project data folder if not in /tmp
  const projectDataPath = path.join(__dirname, '..', 'data', 'cameras.json');
  if (LOCAL_DATA_PATH !== projectDataPath && fs.existsSync(projectDataPath)) {
    try {
      const content = fs.readFileSync(projectDataPath, 'utf-8');
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    } catch (e) {}
  }

  // Fallback to in-memory seed cameras
  return [...SEED_CAMERAS];
}

// Fallback local file writer
function writeLocalCameras(cameras) {
  ensureLocalDir();
  try {
    fs.writeFileSync(LOCAL_DATA_PATH, JSON.stringify(cameras, null, 2), 'utf-8');
  } catch (err) {
    console.warn('Failed writing to datastore file:', err.message);
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
        console.warn('Supabase getCameras error, falling back to datastore:', error.message);
      }
    } catch (err) {
      console.warn('Supabase connection exception:', err.message);
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
      console.warn('Supabase updateCameraStatus error:', error.message);
    } catch (e) {}
  }

  // Local fallback
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
        console.warn('Supabase upsert error:', error.message);
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
