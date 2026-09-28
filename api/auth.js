const {
  verifyAccessPasskey,
  getSiteSettings,
  checkRateLimit,
  getClientIp
} = require('../lib/security');

function sendJson(res, statusCode, data) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Access-Token, X-Admin-Key');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

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
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Access-Token, X-Admin-Key');
    if (typeof res.status === 'function') return res.status(200).end();
    res.statusCode = 200;
    return res.end();
  }

  const clientIp = getClientIp(req);
  const parsedUrl = new URL(req.url, 'http://localhost');
  const pathname = parsedUrl.pathname;
  const subAction = (req.query && req.query.action) || parsedUrl.searchParams.get('action') || '';
  const settings = getSiteSettings();

  // 1. Status Check: GET /api/auth/status
  if (pathname === '/api/auth/status' || subAction === 'status' || (req.method === 'GET' && pathname === '/api/auth')) {
    return sendJson(res, 200, {
      private_mode: Boolean(settings.private_mode),
      require_auth: Boolean(settings.require_auth)
    });
  }

  // 2. Passkey Verification: POST /api/auth/verify
  if (pathname === '/api/auth/verify' || subAction === 'verify' || (req.method === 'POST' && pathname === '/api/auth')) {
    // Rate limit: 5 attempts per 15 minutes per IP
    const allowed = checkRateLimit(`auth-${clientIp}`, 5, 15 * 60 * 1000);
    if (!allowed) {
      return sendJson(res, 429, {
        error: 'Trop de tentatives échouées. Veuillez patienter 15 minutes.'
      });
    }

    const { passkey } = req.body || {};
    if (!passkey) {
      return sendJson(res, 400, { error: 'Mot de passe ou code requis.' });
    }

    const auth = verifyAccessPasskey(passkey);
    if (!auth || !auth.valid) {
      return sendJson(res, 401, {
        error: 'Code d\'accès incorrect. Accès refusé.'
      });
    }

    return sendJson(res, 200, {
      success: true,
      role: auth.role,
      token: passkey,
      private_mode: settings.private_mode
    });
  }

  return sendJson(res, 404, { error: 'Endpoint not found' });
};
