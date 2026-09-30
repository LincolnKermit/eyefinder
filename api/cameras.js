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
    SEED_CAMERAS = Array.isArray(seedMod) ? seedMod : (seedMod.SEED_CAMERAS || seedMod.cameras || []);
  } catch (e) {
    try {
      const seedJson = require('../public/seed.json');
      SEED_CAMERAS = seedJson.cameras || [];
    } catch (e2) {}
  }

  try {
    const { getSiteSettings, verifyAccessPasskey, extractAuthToken } = require('../lib/security');
    const settings = getSiteSettings();
    if (settings.private_mode) {
      const token = extractAuthToken(req) || (req.query && req.query.token);
      const auth = verifyAccessPasskey(token);
      if (!auth || !auth.valid) {
        return sendJson(res, 401, {
          success: false,
          locked: true,
          error: 'Accès restreint. Mot de passe d\'accès requis.'
        });
      }
    }
  } catch (secErr) {}

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
      const archivedCount = cameras.filter(c => c.status === 'archived').length;

      return sendJson(res, 200, {
        success: true,
        storage: (isUsingSupabase && isUsingSupabase()) ? 'supabase' : 'embedded_fallback',
        total: cameras.length,
        operational: operationalCount,
        down: downCount,
        archived: archivedCount,
        cameras
      });
    }

    if (req.method === 'POST') {
      const { isAuthorizedAdmin, sanitizeCameraPayload, isSafeUrl } = require('../lib/security');
      if (!isAuthorizedAdmin(req)) {
        return sendJson(res, 401, { error: 'Unauthorized: Admin authorization required to register cameras' });
      }

      const sanitized = sanitizeCameraPayload(req.body);
      if (!sanitized) {
        return sendJson(res, 400, {
          error: 'Missing or invalid required fields: name, latitude, longitude, stream_url'
        });
      }

      if (!isSafeUrl(sanitized.stream_url)) {
        return sendJson(res, 400, { error: 'Forbidden stream URL rejected by SSRF filter' });
      }

      const newCamera = {
        id: (req.body && req.body.id) || `cam-${Date.now()}`,
        ...sanitized,
        status: sanitized.status || 'operational',
        last_checked: new Date().toISOString()
      };

      try {
        const { upsertCameras } = require('../lib/db');
        await upsertCameras([newCamera]);
      } catch (e) {}

      return sendJson(res, 201, { success: true, camera: newCamera });
    }

    if (req.method === 'PUT') {
      const { isAuthorizedAdmin, sanitizeCameraPayload, isSafeUrl } = require('../lib/security');
      if (!isAuthorizedAdmin(req)) {
        return sendJson(res, 401, { error: 'Unauthorized: Admin authorization required to edit cameras' });
      }

      const { id } = req.body || {};
      if (!id) {
        return sendJson(res, 400, { error: 'Missing camera ID' });
      }

      const sanitized = sanitizeCameraPayload(req.body);
      if (!sanitized) {
        return sendJson(res, 400, { error: 'Invalid camera update fields' });
      }

      if (!isSafeUrl(sanitized.stream_url)) {
        return sendJson(res, 400, { error: 'Forbidden stream URL rejected by SSRF filter' });
      }

      const { getCameras, saveAllCameras } = require('../lib/db');
      const cameras = await getCameras();
      const idx = cameras.findIndex(c => String(c.id) === String(id));
      if (idx === -1) {
        return sendJson(res, 404, { error: 'Camera not found' });
      }

      cameras[idx] = {
        ...cameras[idx],
        ...sanitized,
        id: String(id),
        last_checked: new Date().toISOString()
      };

      await saveAllCameras(cameras);
      return sendJson(res, 200, { success: true, camera: cameras[idx] });
    }

    if (req.method === 'DELETE') {
      const { isAuthorizedAdmin } = require('../lib/security');
      if (!isAuthorizedAdmin(req)) {
        return sendJson(res, 401, { error: 'Unauthorized: Admin authorization required to delete cameras' });
      }

      const id = (req.body && req.body.id) || (req.query && req.query.id);
      if (!id) {
        return sendJson(res, 400, { error: 'Missing camera ID' });
      }

      const { deleteCamera } = require('../lib/db');
      const deleted = await deleteCamera(id);
      if (!deleted) {
        return sendJson(res, 404, { error: 'Camera ID not found' });
      }

      return sendJson(res, 200, { success: true, deletedId: id });
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
      archived: SEED_CAMERAS.filter(c => c.status === 'archived').length,
      cameras: SEED_CAMERAS
    });
  }
};
