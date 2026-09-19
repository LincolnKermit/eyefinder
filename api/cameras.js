function sendJson(res, statusCode, data) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Content-Type', 'application/json');

  if (typeof res.status === 'function' && typeof res.json === 'function') {
    return res.status(statusCode).json(data);
  }
  res.statusCode = statusCode;
  return res.end(JSON.stringify(data));
}

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (typeof res.status === 'function') return res.status(200).end();
    res.statusCode = 200;
    return res.end();
  }

  let SEED_CAMERAS = [];
  try {
    const seedMod = require('../lib/seed');
    SEED_CAMERAS = seedMod.SEED_CAMERAS || [];
  } catch (e) {
    try {
      const seedJson = require('../public/seed.json');
      SEED_CAMERAS = seedJson.cameras || [];
    } catch (e2) {}
  }

  try {
    let getCameras, isUsingSupabase;
    try {
      const db = require('../lib/db');
      getCameras = db.getCameras;
      isUsingSupabase = db.isUsingSupabase;
    } catch (e) {}

    if (req.method === 'GET') {
      let cameras = null;
      if (typeof getCameras === 'function') {
        try {
          cameras = await getCameras();
        } catch (e) {}
      }

      if (!cameras || cameras.length === 0) {
        cameras = SEED_CAMERAS;
      }

      const operationalCount = cameras.filter(c => c.status === 'operational').length;
      const downCount = cameras.filter(c => c.status === 'down').length;

      return sendJson(res, 200, {
        success: true,
        storage: (isUsingSupabase && isUsingSupabase()) ? 'supabase' : 'embedded_fallback',
        total: cameras.length,
        operational: operationalCount,
        down: downCount,
        cameras
      });
    }

    if (req.method === 'POST') {
      const body = req.body || {};
      const { name, latitude, longitude, stream_url, source } = body;

      if (!name || latitude === undefined || longitude === undefined || !stream_url) {
        return sendJson(res, 400, {
          error: 'Missing required fields: name, latitude, longitude, stream_url'
        });
      }

      const newCamera = {
        id: `cam-${Date.now()}`,
        name,
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude),
        stream_url,
        source: source || 'User Submitted',
        status: 'operational',
        last_checked: new Date().toISOString()
      };

      try {
        const { upsertCameras } = require('../lib/db');
        await upsertCameras([newCamera]);
      } catch (e) {}

      return sendJson(res, 201, { success: true, camera: newCamera });
    }

    return sendJson(res, 405, { error: 'Method not allowed' });
  } catch (err) {
    console.error('API /api/cameras error:', err);
    return sendJson(res, 200, {
      success: true,
      storage: 'emergency_fallback',
      total: SEED_CAMERAS.length,
      operational: SEED_CAMERAS.filter(c => c.status === 'operational').length,
      down: SEED_CAMERAS.filter(c => c.status === 'down').length,
      cameras: SEED_CAMERAS
    });
  }
};
