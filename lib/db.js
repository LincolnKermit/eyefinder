const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// Optional Supabase environment variables
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

// Fallback file storage path for local development
const LOCAL_DATA_PATH = path.join(__dirname, '..', 'data', 'cameras.json');

let supabase = null;
if (SUPABASE_URL && SUPABASE_KEY) {
  supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
}

function ensureLocalDir() {
  const dir = path.dirname(LOCAL_DATA_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

// Read cameras from DB or local JSON
async function getCameras() {
  if (supabase) {
    const { data, error } = await supabase
      .from('cameras')
      .select('*')
      .order('name', { ascending: true });

    if (error) {
      console.error('Supabase getCameras error:', error.message);
      return readLocalCameras();
    }
    return data || [];
  }
  return readLocalCameras();
}

// Fallback local file reader
function readLocalCameras() {
  ensureLocalDir();
  if (!fs.existsSync(LOCAL_DATA_PATH)) {
    return [];
  }
  try {
    const content = fs.readFileSync(LOCAL_DATA_PATH, 'utf-8');
    return JSON.parse(content);
  } catch (err) {
    console.error('Error reading local cameras file:', err);
    return [];
  }
}

// Fallback local file writer
function writeLocalCameras(cameras) {
  ensureLocalDir();
  fs.writeFileSync(LOCAL_DATA_PATH, JSON.stringify(cameras, null, 2), 'utf-8');
}

// Update status and last_checked of a single camera
async function updateCameraStatus(id, status) {
  const last_checked = new Date().toISOString();

  if (supabase) {
    const { error } = await supabase
      .from('cameras')
      .update({ status, last_checked })
      .eq('id', id);

    if (!error) return true;
    console.error('Supabase updateCameraStatus error:', error.message);
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
    const { data, error } = await supabase
      .from('cameras')
      .upsert(formatted, { onConflict: 'id' });

    if (error) {
      console.error('Supabase upsertCameras error:', error.message);
      // fallback to local
      writeLocalCameras(formatted);
      return formatted;
    }
    return data || formatted;
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
