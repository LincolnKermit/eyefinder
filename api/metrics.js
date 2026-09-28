const { recordEvent, getMetricsSummary, resetMetrics } = require('../lib/metrics');
const { isAuthorizedAdmin, checkRateLimit, getClientIp } = require('../lib/security');

function sendJson(res, statusCode, data) {
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
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Admin-Key');
    if (typeof res.status === 'function') return res.status(200).end();
    res.statusCode = 200;
    return res.end();
  }

  const clientIp = getClientIp(req);

  // POST /api/metrics (or /api/metrics/ping): visitor telemetry beacon
  if (req.method === 'POST') {
    const body = req.body || {};
    const action = body.action || req.query.action || 'ping';

    if (action === 'reset') {
      if (!isAuthorizedAdmin(req)) {
        return sendJson(res, 401, { error: 'Unauthorized: Admin authentication required' });
      }
      resetMetrics();
      return sendJson(res, 200, { success: true, message: 'Telemetry reset complete' });
    }

    // Ping telemetry - rate-limit per IP to prevent spam (max 120 pings per minute)
    const rateLimitOk = checkRateLimit(`ping-${clientIp}`, 120, 60 * 1000);
    if (!rateLimitOk) {
      return sendJson(res, 429, { error: 'Rate limit exceeded' });
    }

    const { type, sessionId, device, details } = body;
    recordEvent({
      type: type || 'pageview',
      sessionId: String(sessionId || '').slice(0, 64),
      device: String(device || 'unknown').slice(0, 20),
      details: String(details || '').slice(0, 100),
      ip: clientIp
    });

    return sendJson(res, 200, { success: true, recorded: true });
  }

  // GET /api/metrics: Return metrics summary (Admin Only)
  if (req.method === 'GET') {
    if (!isAuthorizedAdmin(req)) {
      return sendJson(res, 401, { error: 'Unauthorized: Admin authentication required' });
    }

    const summary = getMetricsSummary();
    return sendJson(res, 200, summary);
  }

  return sendJson(res, 405, { error: 'Method not allowed' });
};
