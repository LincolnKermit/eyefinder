const {
  verifyAdminToken,
  isAuthorizedAdmin,
  checkRateLimit,
  getClientIp,
  sanitizeCameraPayload,
  isSafeUrl,
  ADMIN_SECRET,
  getSiteSettings,
  updateSiteSettings
} = require('../lib/security');
const { getCameras, upsertCameras, updateCameraStatus, saveAllCameras, deleteCamera } = require('../lib/db');
const { checkCameraHealth } = require('../lib/scraper');

function sendJson(res, statusCode, data) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  if (typeof res.status === 'function' && typeof res.json === 'function') {
    return res.status(statusCode).json(data);
  }
  res.statusCode = statusCode;
  return res.end(JSON.stringify(data));
}

module.exports = async function handler(req, res) {
  // CORS & Security headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Admin-Key');

  if (req.method === 'OPTIONS') {
    if (typeof res.status === 'function') return res.status(200).end();
    res.statusCode = 200;
    return res.end();
  }

  const clientIp = getClientIp(req);
  const parsedUrl = new URL(req.url, 'http://localhost');
  const pathname = parsedUrl.pathname;
  const subAction = (req.query && req.query.action) || parsedUrl.searchParams.get('action') || '';

  // 1. Login Endpoint: POST /api/admin/login or action=login
  if (pathname === '/api/admin/login' || subAction === 'login') {
    if (req.method !== 'POST') {
      return sendJson(res, 405, { error: 'Method not allowed' });
    }

    // Brute-force rate limiting: 5 attempts per 15 minutes per IP
    const allowed = checkRateLimit(`login-${clientIp}`, 5, 15 * 60 * 1000);
    if (!allowed) {
      return sendJson(res, 429, {
        error: 'Too many failed login attempts. Locked out for 15 minutes for security.'
      });
    }

    const { passkey } = req.body || {};
    if (!passkey || !verifyAdminToken(passkey)) {
      return sendJson(res, 401, {
        error: 'Invalid admin passkey. Authentication failed.'
      });
    }

    // Success: return authorization token and session info
    return sendJson(res, 200, {
      success: true,
      token: ADMIN_SECRET,
      role: 'security_operator',
      issuedAt: new Date().toISOString()
    });
  }

  // 2. Authentication Gate: All other endpoints require valid Admin Token
  if (!isAuthorizedAdmin(req)) {
    return sendJson(res, 401, {
      error: 'Unauthorized. Valid Admin Bearer token or X-Admin-Key header required.'
    });
  }

  // 3. Verify Token Endpoint
  if (pathname === '/api/admin/verify' || subAction === 'verify') {
    return sendJson(res, 200, {
      success: true,
      authenticated: true,
      role: 'security_operator'
    });
  }

  // 4. List Cameras for Admin: GET /api/admin/cameras
  if ((pathname === '/api/admin/cameras' || subAction === 'cameras') && req.method === 'GET') {
    const cameras = await getCameras();
    return sendJson(res, 200, {
      success: true,
      total: cameras.length,
      operational: cameras.filter(c => c.status === 'operational').length,
      down: cameras.filter(c => c.status === 'down').length,
      archived: cameras.filter(c => c.status === 'archived').length,
      cameras
    });
  }

  // 5. Toggle / Update Camera Status: POST /api/admin/cameras/status
  if (pathname === '/api/admin/cameras/status' || subAction === 'status') {
    const { id, status } = req.body || {};
    if (!id || !status || !['operational', 'down', 'archived'].includes(status)) {
      return sendJson(res, 400, { error: 'Missing or invalid parameters: id and status required (operational, down, or archived)' });
    }

    const cameras = await getCameras();
    const target = cameras.find(c => String(c.id) === String(id));
    if (!target) {
      return sendJson(res, 404, { error: 'Camera not found' });
    }

    target.status = status;
    target.last_checked = new Date().toISOString();
    await updateCameraStatus(id, status);

    return sendJson(res, 200, { success: true, camera: target });
  }

  // 5b. Geocode address search: GET /api/admin/geocode?q=... (Uses Mullvad VPN on VPS)
  if (pathname === '/api/admin/geocode' || subAction === 'geocode') {
    const query = (req.query && req.query.q) || parsedUrl.searchParams.get('q') || '';
    if (!query || typeof query !== 'string' || query.trim().length < 2) {
      return sendJson(res, 400, { error: 'Query parameter q is required (min 2 chars)' });
    }

    try {
      const geoUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query.trim())}&limit=5&addressdetails=1`;
      const geoRes = await fetch(geoUrl, {
        headers: {
          'User-Agent': 'EyeFinder-Admin/2.0 (Tactical OSINT)',
          'Accept-Language': 'fr,en'
        },
        signal: AbortSignal.timeout(4500)
      });

      if (!geoRes.ok) {
        return sendJson(res, 502, { error: 'Geocoding service returned error ' + geoRes.status });
      }

      const results = await geoRes.json();
      const formatted = (results || []).map(r => ({
        display_name: r.display_name,
        name: r.name,
        lat: parseFloat(r.lat),
        lon: parseFloat(r.lon),
        city: r.address ? (r.address.city || r.address.town || r.address.village || r.address.municipality || '') : '',
        country: r.address ? (r.address.country || '') : ''
      }));

      return sendJson(res, 200, { success: true, results: formatted });
    } catch (err) {
      return sendJson(res, 500, { error: 'Geocoding failed: ' + err.message });
    }
  }

  // 5c. Reverse geocode coordinates to address: GET /api/admin/reverse-geocode?lat=...&lon=...
  if (pathname === '/api/admin/reverse-geocode' || subAction === 'reverse-geocode') {
    const lat = parseFloat((req.query && req.query.lat) || parsedUrl.searchParams.get('lat'));
    const lon = parseFloat((req.query && req.query.lon) || parsedUrl.searchParams.get('lon'));
    if (isNaN(lat) || isNaN(lon)) {
      return sendJson(res, 400, { error: 'Valid lat and lon parameters are required' });
    }

    try {
      const geoUrl = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&addressdetails=1`;
      const geoRes = await fetch(geoUrl, {
        headers: {
          'User-Agent': 'EyeFinder-Admin/2.0 (Tactical OSINT)',
          'Accept-Language': 'fr,en'
        },
        signal: AbortSignal.timeout(4500)
      });

      if (!geoRes.ok) {
        return sendJson(res, 502, { error: 'Reverse geocoding service unavailable' });
      }

      const r = await geoRes.json();
      return sendJson(res, 200, {
        success: true,
        display_name: r.display_name || '',
        city: r.address ? (r.address.city || r.address.town || r.address.village || r.address.municipality || '') : '',
        country: r.address ? (r.address.country || '') : ''
      });
    } catch (err) {
      return sendJson(res, 500, { error: 'Reverse geocoding failed: ' + err.message });
    }
  }

  // 6. On-demand SSRF-Safe Camera Probe: POST /api/admin/cameras/probe
  if (pathname === '/api/admin/cameras/probe' || subAction === 'probe') {
    const { url } = req.body || {};
    if (!url || typeof url !== 'string') {
      return sendJson(res, 400, { error: 'Missing stream URL' });
    }

    if (!isSafeUrl(url)) {
      return sendJson(res, 400, {
        error: 'Forbidden: URL rejected by SSRF security filter (private, loopback, or cloud metadata)'
      });
    }

    const status = await checkCameraHealth(url, 2500);
    return sendJson(res, 200, {
      success: true,
      url,
      status,
      timestamp: new Date().toISOString()
    });
  }

  // 7. Add Camera: POST /api/admin/cameras/add
  if (pathname === '/api/admin/cameras/add' || (pathname === '/api/admin/cameras' && req.method === 'POST') || subAction === 'add') {
    const sanitized = sanitizeCameraPayload(req.body);
    if (!sanitized) {
      return sendJson(res, 400, {
        error: 'Invalid camera data. Required: valid name, coordinates (-90..90, -180..180), and stream URL.'
      });
    }

    if (!isSafeUrl(sanitized.stream_url)) {
      return sendJson(res, 400, {
        error: 'Forbidden stream URL: SSRF filter rejected private, loopback, or metadata host.'
      });
    }

    const newCamera = {
      id: `cam-admin-${Date.now()}`,
      ...sanitized,
      last_checked: new Date().toISOString()
    };

    await upsertCameras([newCamera]);
    return sendJson(res, 201, { success: true, camera: newCamera });
  }

  // 8. Edit Camera: PUT /api/admin/cameras/edit
  if (pathname === '/api/admin/cameras/edit' || (pathname === '/api/admin/cameras' && req.method === 'PUT') || subAction === 'edit') {
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

  // 9. Delete Camera: DELETE /api/admin/cameras/delete
  if (pathname === '/api/admin/cameras/delete' || (pathname === '/api/admin/cameras' && req.method === 'DELETE') || subAction === 'delete') {
    const id = (req.body && req.body.id) || (req.query && req.query.id);
    if (!id) {
      return sendJson(res, 400, { error: 'Missing camera ID' });
    }

    const deleted = await deleteCamera(id);
    if (!deleted) {
      return sendJson(res, 404, { error: 'Camera ID not found' });
    }

    return sendJson(res, 200, { success: true, deletedId: id });
  }

  // 10. Export Database: GET /api/admin/export
  if (pathname === '/api/admin/export' || subAction === 'export') {
    const cameras = await getCameras();
    return sendJson(res, 200, {
      export_date: new Date().toISOString(),
      total: cameras.length,
      cameras
    });
  }

  // 11. Import Seed JSON: POST /api/admin/import
  if (pathname === '/api/admin/import' || subAction === 'import') {
    const list = Array.isArray(req.body) ? req.body : (req.body && req.body.cameras);
    if (!Array.isArray(list) || list.length === 0) {
      return sendJson(res, 400, { error: 'Invalid payload: expected non-empty array of cameras' });
    }

    const validated = [];
    for (const item of list) {
      const clean = sanitizeCameraPayload(item);
      if (clean && isSafeUrl(clean.stream_url)) {
        validated.push({
          id: item.id || `cam-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
          ...clean,
          last_checked: item.last_checked || new Date().toISOString()
        });
      }
    }

    if (validated.length === 0) {
      return sendJson(res, 400, { error: 'No valid cameras found in import payload' });
    }

    await saveAllCameras(validated);
    return sendJson(res, 200, {
      success: true,
      importedCount: validated.length
    });
  }

  // 12. Site Access Settings: GET & PUT /api/admin/settings
  if (pathname === '/api/admin/settings' || subAction === 'settings') {
    if (req.method === 'PUT' || req.method === 'POST') {
      const { private_mode, visitor_passkey } = req.body || {};
      const updates = {};
      if (typeof private_mode === 'boolean') updates.private_mode = private_mode;
      if (typeof visitor_passkey === 'string' && visitor_passkey.trim()) {
        updates.visitor_passkey = visitor_passkey.trim().slice(0, 100);
      }
      const updated = updateSiteSettings(updates);
      return sendJson(res, 200, { success: true, settings: updated });
    }
    const settings = getSiteSettings();
    return sendJson(res, 200, { success: true, settings });
  }

  return sendJson(res, 404, { error: 'Admin route not found' });
};
