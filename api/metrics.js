const { recordEvent, getMetricsSummary, resetMetrics, clearConnectionLogs } = require('../lib/metrics');
const { isAuthorizedAdmin, checkRateLimit, getClientIp } = require('../lib/security');

function sendJson(res, statusCode, data) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  if (typeof res.status === 'function' && typeof res.json === 'function') {
    return res.status(statusCode).json(data);
  }
  res.statusCode = statusCode;
  return res.end(JSON.stringify(data));
}

function escapeCsv(val) {
  if (val === null || val === undefined) return '';
  const str = String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
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
  const parsedUrl = new URL(req.url, 'http://localhost');
  const query = req.query || Object.fromEntries(parsedUrl.searchParams.entries());

  // POST /api/metrics: visitor telemetry beacon or admin management
  if (req.method === 'POST') {
    const body = req.body || {};
    const action = body.action || query.action || 'ping';

    if (action === 'reset') {
      if (!isAuthorizedAdmin(req)) {
        return sendJson(res, 401, { error: 'Unauthorized: Admin authentication required' });
      }
      resetMetrics();
      return sendJson(res, 200, { success: true, message: 'All telemetry reset complete' });
    }

    if (action === 'clear_logs') {
      if (!isAuthorizedAdmin(req)) {
        return sendJson(res, 401, { error: 'Unauthorized: Admin authentication required' });
      }
      clearConnectionLogs();
      return sendJson(res, 200, { success: true, message: 'Connection logs cleared' });
    }

    // Ping telemetry - rate-limit per IP to prevent spam (max 120 pings per minute)
    const rateLimitOk = checkRateLimit(`ping-${clientIp}`, 120, 60 * 1000);
    if (!rateLimitOk) {
      return sendJson(res, 429, { error: 'Rate limit exceeded' });
    }

    const { type, sessionId, device, details, referrer } = body;
    recordEvent({
      type: type || 'pageview',
      sessionId: String(sessionId || '').slice(0, 64),
      device: String(device || 'Desktop').slice(0, 20),
      details: String(details || '').slice(0, 150),
      ip: clientIp,
      userAgent: req.headers['user-agent'] || '',
      referrer: req.headers['referer'] || req.headers['referrer'] || referrer || 'Direct'
    });

    return sendJson(res, 200, { success: true, recorded: true, ip: clientIp });
  }

  // GET /api/metrics: Return metrics summary & logs (Admin Only)
  if (req.method === 'GET') {
    if (!isAuthorizedAdmin(req)) {
      return sendJson(res, 401, { error: 'Unauthorized: Admin authentication required' });
    }

    const limit = parseInt(query.limit, 10) || 300;
    const summary = getMetricsSummary(limit);

    // CSV Export option (Enhanced with UTF-8 BOM and full metadata)
    if (query.export === 'csv') {
      const headers = [
        'id',
        'timestamp',
        'ip',
        'ip_type',
        'method',
        'path',
        'status',
        'referrer',
        'referrer_domain',
        'browser',
        'os',
        'device',
        'isBot',
        'authStatus',
        'durationMs',
        'userAgent'
      ];
      const rows = [headers.join(',')];

      (summary.connection_logs || []).forEach(log => {
        rows.push([
          escapeCsv(log.id),
          escapeCsv(log.timestamp),
          escapeCsv(log.ip),
          escapeCsv(log.ip_type || 'Unknown'),
          escapeCsv(log.method),
          escapeCsv(log.path),
          escapeCsv(log.status),
          escapeCsv(log.referrer),
          escapeCsv(log.referrer_domain || 'Direct'),
          escapeCsv(log.browser),
          escapeCsv(log.os),
          escapeCsv(log.device),
          escapeCsv(log.isBot ? '1' : '0'),
          escapeCsv(log.authStatus),
          escapeCsv(log.durationMs || 0),
          escapeCsv(log.userAgent)
        ].join(','));
      });

      // Prepend UTF-8 BOM so Excel opens accents and symbols cleanly
      const csvPayload = '\uFEFF' + rows.join('\r\n');
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="eyefinder-traffic-audit-${new Date().toISOString().slice(0, 10)}.csv"`);
      return res.end(csvPayload);
    }

    return sendJson(res, 200, summary);
  }

  return sendJson(res, 405, { error: 'Method not allowed' });
};
