const crypto = require('crypto');

// Default admin passkey if not configured in environment
const ADMIN_SECRET = process.env.ADMIN_SECRET || 'eyefinder-admin-2024';

// Rate limiting in-memory store for sensitive endpoints (e.g. login)
// key -> { attempts: number, resetAt: number }
const rateLimitStore = new Map();

/**
 * Check if an IP address falls within private, loopback, or reserved ranges (SSRF defense)
 */
function isPrivateOrReservedIP(ipStr) {
  if (!ipStr || typeof ipStr !== 'string') return true;

  const ip = ipStr.trim();

  // IPv4 Loopback (127.0.0.0/8)
  if (/^127\./.test(ip)) return true;

  // IPv4 RFC 1918 Private Ranges
  // 10.0.0.0/8
  if (/^10\./.test(ip)) return true;
  // 172.16.0.0/12 (172.16.0.0 - 172.31.255.255)
  if (/^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(ip)) return true;
  // 192.168.0.0/16
  if (/^192\.168\./.test(ip)) return true;

  // IPv4 Link-Local / Cloud Metadata (169.254.0.0/16 - e.g. AWS/GCP/Azure 169.254.169.254)
  if (/^169\.254\./.test(ip)) return true;

  // IPv4 Broadcast / Current Network / Reserved
  if (/^0\./.test(ip) || ip === '255.255.255.255') return true;
  // TEST-NET-1 (192.0.2.0/24), TEST-NET-2 (198.51.100.0/24), TEST-NET-3 (203.0.113.0/24)
  if (/^192\.0\.2\./.test(ip) || /^198\.51\.100\./.test(ip) || /^203\.0\.113\./.test(ip)) return true;
  // Carrier-grade NAT (100.64.0.0/10)
  if (/^100\.(6[4-9]|[7-9][0-9]|1[0-1][0-9]|12[0-7])\./.test(ip)) return true;

  // IPv6 Loopback & Link-local
  if (ip === '::1' || ip === '::' || /^fe80:/i.test(ip) || /^fc00:/i.test(ip) || /^fd00:/i.test(ip)) {
    return true;
  }

  return false;
}

/**
 * Validate that a URL is safe for server-side fetching (SSRF mitigation)
 * Blocks internal networks, cloud metadata, localhosts, and non-http(s) schemes
 */
function isSafeUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') return false;

  let parsed;
  try {
    parsed = new URL(rawUrl);
  } catch (e) {
    return false;
  }

  // Only permit HTTP and HTTPS schemes
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return false;
  }

  const hostname = parsed.hostname.toLowerCase();

  // Reject localhost or local domain variants
  if (
    hostname === 'localhost' ||
    hostname.endsWith('.localhost') ||
    hostname.endsWith('.local') ||
    hostname.endsWith('.internal') ||
    hostname.endsWith('.corp') ||
    hostname === 'metadata.google.internal'
  ) {
    return false;
  }

  // Reject IPv6 literals of private ranges or loopback
  const cleanHost = hostname.replace(/^\[|\]$/g, '');
  if (isPrivateOrReservedIP(cleanHost)) {
    return false;
  }

  // Only permit reasonable web/streaming ports
  const port = parsed.port ? parseInt(parsed.port, 10) : (parsed.protocol === 'https:' ? 443 : 80);
  const FORBIDDEN_PORTS = [
    21, 22, 23, 25, 53, 69, 110, 111, 135, 137, 138, 139, 143, 389,
    445, 636, 1433, 1521, 2049, 2375, 2376, 3306, 3389, 5432, 5900,
    6379, 9200, 11211, 27017, 28017
  ];
  if (FORBIDDEN_PORTS.includes(port)) {
    return false;
  }

  return true;
}

/**
 * Timing-safe authentication check for admin requests
 */
function verifyAdminToken(providedToken) {
  if (!providedToken || typeof providedToken !== 'string') return false;

  const expected = ADMIN_SECRET;
  const providedBuf = Buffer.from(providedToken);
  const expectedBuf = Buffer.from(expected);

  if (providedBuf.length !== expectedBuf.length) {
    // Constant time compare dummy to avoid timing leaks on length
    crypto.timingSafeEqual(expectedBuf, expectedBuf);
    return false;
  }

  return crypto.timingSafeEqual(providedBuf, expectedBuf);
}

/**
 * Extract auth token from request headers
 */
function extractAuthToken(req) {
  const authHeader = req.headers['authorization'] || '';
  if (authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7).trim();
  }
  return req.headers['x-admin-key'] || req.headers['x-admin-token'] || '';
}

/**
 * Middleware-like check: returns true if request is authorized as admin
 */
function isAuthorizedAdmin(req) {
  const token = extractAuthToken(req);
  return verifyAdminToken(token);
}

/**
 * Basic in-memory rate limiter for brute-force protection
 * @param {string} key Identifier (e.g. client IP or action)
 * @param {number} maxAttempts Max allowed attempts within window
 * @param {number} windowMs Window duration in milliseconds (default: 15 min)
 * @returns {boolean} True if allowed, false if limit exceeded
 */
function checkRateLimit(key, maxAttempts = 5, windowMs = 15 * 60 * 1000) {
  const now = Date.now();
  const record = rateLimitStore.get(key);

  if (!record || now > record.resetAt) {
    rateLimitStore.set(key, { attempts: 1, resetAt: now + windowMs });
    return true;
  }

  if (record.attempts >= maxAttempts) {
    return false;
  }

  record.attempts += 1;
  return true;
}

/**
 * Get client IP address from request headers
 */
function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  return req.socket ? (req.socket.remoteAddress || '127.0.0.1') : '127.0.0.1';
}

/**
 * Sanitize camera input payloads
 */
function sanitizeCameraPayload(payload) {
  if (!payload || typeof payload !== 'object') return null;

  const name = String(payload.name || '').trim().slice(0, 150);
  const stream_url = String(payload.stream_url || '').trim();
  const latitude = parseFloat(payload.latitude);
  const longitude = parseFloat(payload.longitude);
  const city = payload.city ? String(payload.city).trim().slice(0, 100) : '';
  const country = payload.country ? String(payload.country).trim().slice(0, 100) : 'Global';
  const source = payload.source ? String(payload.source).trim().slice(0, 100) : 'Manual Admin';
  const is_snapshot = Boolean(payload.is_snapshot);
  const is_mjpeg = Boolean(payload.is_mjpeg);
  const status = payload.status === 'down' ? 'down' : 'operational';

  if (!name || isNaN(latitude) || isNaN(longitude) || !stream_url) {
    return null;
  }

  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    return null;
  }

  return {
    name,
    latitude,
    longitude,
    stream_url,
    city,
    country,
    source,
    is_snapshot,
    is_mjpeg,
    status
  };
}

module.exports = {
  isPrivateOrReservedIP,
  isSafeUrl,
  verifyAdminToken,
  extractAuthToken,
  isAuthorizedAdmin,
  checkRateLimit,
  getClientIp,
  sanitizeCameraPayload,
  ADMIN_SECRET
};
