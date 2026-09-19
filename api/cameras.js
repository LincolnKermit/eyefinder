const { getCameras, upsertCameras, isUsingSupabase } = require('../lib/db');
const { SEED_CAMERAS } = require('../lib/seed');

module.exports = async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    if (req.method === 'GET') {
      let cameras = await getCameras();

      // If database is empty, initialize with seed cameras
      if (!cameras || cameras.length === 0) {
        cameras = await upsertCameras(SEED_CAMERAS);
      }

      const operationalCount = cameras.filter(c => c.status === 'operational').length;
      const downCount = cameras.filter(c => c.status === 'down').length;

      return res.status(200).json({
        success: true,
        storage: isUsingSupabase() ? 'supabase' : 'local_datastore',
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
        return res.status(400).json({
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

      await upsertCameras([newCamera]);
      return res.status(201).json({ success: true, camera: newCamera });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('API /api/cameras error:', err);
    return res.status(500).json({ error: 'Internal server error', details: err.message });
  }
};
