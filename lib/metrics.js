const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const isVercel = Boolean(process.env.VERCEL);
const METRICS_FILE = isVercel
  ? path.join('/tmp', 'metrics.json')
  : path.join(__dirname, '..', 'data', 'metrics.json');

// In-memory metrics state
let metrics = {
  total_page_views: 0,
  total_connections: 0,
  unique_visitors: {},
  unique_ips: {},
  device_breakdown: {
    desktop: 0,
    mobile: 0,
    tablet: 0,
    bot: 0,
    unknown: 0
  },
  browser_breakdown: {},
  os_breakdown: {},
  referrer_breakdown: {},
  endpoint_breakdown: {},
  status_breakdown: {},
  blocked_attempts: 0,
  filter_usage: {
    all: 0,
    france: 0,
    swiss: 0,
    live: 0,
    picture: 0,
    down: 0
  },
  camera_interactions: {},
  connection_logs: [],
  recent_activity: [],
  started_at: new Date().toISOString()
};

function ensureDir() {
  try {
    const dir = path.dirname(METRICS_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  } catch (e) {}
}

function loadMetrics() {
  try {
    if (fs.existsSync(METRICS_FILE)) {
      const raw = fs.readFileSync(METRICS_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        metrics = {
          ...metrics,
          ...parsed,
          device_breakdown: { ...metrics.device_breakdown, ...(parsed.device_breakdown || {}) },
          browser_breakdown: { ...(parsed.browser_breakdown || {}) },
          os_breakdown: { ...(parsed.os_breakdown || {}) },
          referrer_breakdown: { ...(parsed.referrer_breakdown || {}) },
          endpoint_breakdown: { ...(parsed.endpoint_breakdown || {}) },
          status_breakdown: { ...(parsed.status_breakdown || {}) },
          filter_usage: { ...metrics.filter_usage, ...(parsed.filter_usage || {}) },
          camera_interactions: { ...metrics.camera_interactions, ...(parsed.camera_interactions || {}) },
          unique_ips: { ...(parsed.unique_ips || {}) },
          connection_logs: Array.isArray(parsed.connection_logs) ? parsed.connection_logs : [],
          recent_activity: Array.isArray(parsed.recent_activity) ? parsed.recent_activity : []
        };
      }
    }
  } catch (e) {}
}

// Throttle saves to disk
let saveTimeout = null;
function scheduleSave() {
  if (saveTimeout) return;
  saveTimeout = setTimeout(() => {
    saveTimeout = null;
    try {
      ensureDir();
      fs.writeFileSync(METRICS_FILE, JSON.stringify(metrics, null, 2), 'utf-8');
    } catch (e) {}
  }, 1000);
}

// Initialize on module load
loadMetrics();

/**
 * Robust User-Agent Parser
 */
function parseUserAgent(ua) {
  if (!ua || typeof ua !== 'string') {
    return { browser: 'Unknown', os: 'Unknown', device: 'Unknown', isBot: false };
  }

  let browser = 'Other';
  let os = 'Unknown';
  let device = 'Desktop';
  let isBot = false;

  const uaLower = ua.toLowerCase();

  // Bot & Crawler Detection
  if (
    uaLower.includes('bot') ||
    uaLower.includes('crawl') ||
    uaLower.includes('spider') ||
    uaLower.includes('slurp') ||
    uaLower.includes('curl') ||
    uaLower.includes('wget') ||
    uaLower.includes('python') ||
    uaLower.includes('postman') ||
    uaLower.includes('headless')
  ) {
    isBot = true;
    device = 'Bot';
    if (uaLower.includes('googlebot')) browser = 'Googlebot';
    else if (uaLower.includes('bingbot')) browser = 'Bingbot';
    else if (uaLower.includes('curl')) browser = 'curl CLI';
    else if (uaLower.includes('python')) browser = 'Python Client';
    else if (uaLower.includes('postman')) browser = 'Postman';
    else browser = 'Bot / Crawler';
  }

  // OS Detection
  if (ua.includes('Windows NT 10.0') || ua.includes('Windows NT 11.0')) os = 'Windows 10/11';
  else if (ua.includes('Windows NT 6.3')) os = 'Windows 8.1';
  else if (ua.includes('Windows NT 6.1')) os = 'Windows 7';
  else if (ua.includes('Windows')) os = 'Windows';
  else if (ua.includes('iPhone')) { os = 'iOS (iPhone)'; device = 'Mobile'; }
  else if (ua.includes('iPad')) { os = 'iPadOS (iPad)'; device = 'Tablet'; }
  else if (ua.includes('Macintosh') || ua.includes('Mac OS X')) os = 'macOS';
  else if (ua.includes('Android')) {
    os = 'Android';
    device = ua.includes('Mobile') ? 'Mobile' : 'Tablet';
  } else if (ua.includes('Linux')) os = 'Linux';
  else if (ua.includes('CrOS')) os = 'ChromeOS';

  // Browser Detection
  if (!isBot) {
    if (ua.includes('Edg/')) {
      const match = ua.match(/Edg\/([\d.]+)/);
      browser = `Edge ${match ? match[1].split('.')[0] : ''}`.trim();
    } else if (ua.includes('Chrome/') && !ua.includes('Chromium')) {
      const match = ua.match(/Chrome\/([\d.]+)/);
      browser = `Chrome ${match ? match[1].split('.')[0] : ''}`.trim();
    } else if (ua.includes('Firefox/')) {
      const match = ua.match(/Firefox\/([\d.]+)/);
      browser = `Firefox ${match ? match[1].split('.')[0] : ''}`.trim();
    } else if (ua.includes('Safari/') && !ua.includes('Chrome')) {
      const match = ua.match(/Version\/([\d.]+)/);
      browser = `Safari ${match ? match[1].split('.')[0] : ''}`.trim();
    } else if (ua.includes('OPR/') || ua.includes('Opera/')) {
      browser = 'Opera';
    } else if (ua.includes('SamsungBrowser/')) {
      browser = 'Samsung Internet';
    }
  }

  return { browser, os, device, isBot };
}

/**
 * Referrer URL & Domain Parser
 */
function parseReferrer(rawRef) {
  if (!rawRef || typeof rawRef !== 'string') {
    return { referrer: 'Direct / None', domain: 'Direct' };
  }
  const clean = rawRef.trim();
  if (!clean || clean === 'null' || clean === 'undefined') {
    return { referrer: 'Direct / None', domain: 'Direct' };
  }
  try {
    const u = new URL(clean);
    const domain = u.hostname.replace(/^www\./, '');
    return { referrer: clean, domain: domain || 'Direct' };
  } catch (e) {
    return { referrer: clean, domain: clean.slice(0, 50) };
  }
}

/**
 * Log an individual incoming connection / HTTP request
 */
function logConnection({
  ip,
  method = 'GET',
  path = '/',
  statusCode = 200,
  userAgent = '',
  referrer = '',
  durationMs = 0,
  authStatus = 'public'
}) {
  const now = new Date().toISOString();
  const parsedUA = parseUserAgent(userAgent);
  const parsedRef = parseReferrer(referrer);
  const cleanIp = String(ip || '127.0.0.1').trim();
  const cleanPath = String(path || '/').split('?')[0];

  // Increment aggregate counters
  metrics.total_connections += 1;
  metrics.unique_ips[cleanIp] = (metrics.unique_ips[cleanIp] || 0) + 1;

  // Device & Bot
  const devKey = parsedUA.isBot ? 'bot' : parsedUA.device.toLowerCase();
  if (metrics.device_breakdown[devKey] !== undefined) {
    metrics.device_breakdown[devKey] += 1;
  } else {
    metrics.device_breakdown.unknown += 1;
  }

  // Browser
  const browserKey = parsedUA.browser;
  metrics.browser_breakdown[browserKey] = (metrics.browser_breakdown[browserKey] || 0) + 1;

  // OS
  const osKey = parsedUA.os;
  metrics.os_breakdown[osKey] = (metrics.os_breakdown[osKey] || 0) + 1;

  // Referrer domain
  const refKey = parsedRef.domain;
  metrics.referrer_breakdown[refKey] = (metrics.referrer_breakdown[refKey] || 0) + 1;

  // Endpoint
  metrics.endpoint_breakdown[cleanPath] = (metrics.endpoint_breakdown[cleanPath] || 0) + 1;

  // Status code
  const statusStr = String(statusCode);
  metrics.status_breakdown[statusStr] = (metrics.status_breakdown[statusStr] || 0) + 1;

  // Blocked attempts
  if (statusCode === 401 || authStatus === 'blocked') {
    metrics.blocked_attempts += 1;
  }

  // Category classification
  let category = 'asset';
  if (cleanPath === '/' || cleanPath === '/index.html' || cleanPath === '/admin.html') {
    category = 'page';
    metrics.total_page_views += 1;
  } else if (cleanPath.startsWith('/api/')) {
    category = 'api';
  } else if (cleanPath.endsWith('.json') || cleanPath.endsWith('.geojson') || cleanPath.endsWith('.kml') || cleanPath.endsWith('.csv')) {
    category = 'data';
  }

  const logEntry = {
    id: `req-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    timestamp: now,
    ip: cleanIp,
    method: method.toUpperCase(),
    path: cleanPath,
    category,
    status: Number(statusCode),
    referrer: parsedRef.referrer,
    referrer_domain: parsedRef.domain,
    userAgent: String(userAgent || '').slice(0, 300),
    browser: parsedUA.browser,
    os: parsedUA.os,
    device: parsedUA.device,
    isBot: parsedUA.isBot,
    authStatus,
    durationMs: Math.round(durationMs)
  };

  // Keep last 300 connection records in memory/disk
  metrics.connection_logs.unshift(logEntry);
  if (metrics.connection_logs.length > 300) {
    metrics.connection_logs.pop();
  }

  // Also record in activity stream
  const activityEntry = {
    id: logEntry.id,
    timestamp: now,
    type: category,
    details: `${method} ${cleanPath} [${statusCode}]`,
    device: `${parsedUA.device} (${parsedUA.browser})`,
    ip: cleanIp,
    referrer: parsedRef.domain
  };
  metrics.recent_activity.unshift(activityEntry);
  if (metrics.recent_activity.length > 60) {
    metrics.recent_activity.pop();
  }

  scheduleSave();
}

/**
 * Record a client beacon event (e.g. filter clicked, camera opened)
 */
function recordEvent({ type, sessionId, device, details, ip }) {
  const now = new Date().toISOString();
  const cleanIp = String(ip || '127.0.0.1').trim();

  if (type === 'filter') {
    const key = (details || '').toLowerCase().trim();
    if (metrics.filter_usage[key] !== undefined) {
      metrics.filter_usage[key] += 1;
    }
  } else if (type === 'camera_view') {
    const camKey = String(details || 'Unknown Camera').slice(0, 100);
    metrics.camera_interactions[camKey] = (metrics.camera_interactions[camKey] || 0) + 1;
  }

  scheduleSave();
}

/**
 * Get aggregated metrics summary for Admin Dashboard
 */
function getMetricsSummary(limit = 100) {
  const uniqueIpsCount = Object.keys(metrics.unique_ips).length;

  // Top 10 Cameras
  const topCameras = Object.entries(metrics.camera_interactions)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  // Top 10 Referrers
  const topReferrers = Object.entries(metrics.referrer_breakdown)
    .map(([domain, count]) => ({ domain, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  // Top 10 Browsers
  const topBrowsers = Object.entries(metrics.browser_breakdown)
    .map(([browser, count]) => ({ browser, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  // Top 10 Operating Systems
  const topOS = Object.entries(metrics.os_breakdown)
    .map(([os, count]) => ({ os, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  // Top 10 Endpoints
  const topEndpoints = Object.entries(metrics.endpoint_breakdown)
    .map(([path, count]) => ({ path, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  // Top 10 Active IPs
  const topIps = Object.entries(metrics.unique_ips)
    .map(([ip, count]) => ({ ip, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  return {
    success: true,
    total_connections: metrics.total_connections,
    total_page_views: metrics.total_page_views,
    unique_visitors: uniqueIpsCount,
    unique_ips_count: uniqueIpsCount,
    blocked_attempts: metrics.blocked_attempts,
    device_breakdown: metrics.device_breakdown,
    browser_breakdown: topBrowsers,
    os_breakdown: topOS,
    referrer_breakdown: topReferrers,
    endpoint_breakdown: topEndpoints,
    status_breakdown: metrics.status_breakdown,
    filter_usage: metrics.filter_usage,
    top_cameras: topCameras,
    top_ips: topIps,
    connection_logs: metrics.connection_logs.slice(0, Math.min(limit, 300)),
    recent_activity: metrics.recent_activity.slice(0, 40),
    uptime_since: metrics.started_at
  };
}

/**
 * Clear connection logs
 */
function clearConnectionLogs() {
  metrics.connection_logs = [];
  metrics.recent_activity = [];
  scheduleSave();
  return true;
}

/**
 * Reset all metrics
 */
function resetMetrics() {
  metrics = {
    total_page_views: 0,
    total_connections: 0,
    unique_visitors: {},
    unique_ips: {},
    device_breakdown: { desktop: 0, mobile: 0, tablet: 0, bot: 0, unknown: 0 },
    browser_breakdown: {},
    os_breakdown: {},
    referrer_breakdown: {},
    endpoint_breakdown: {},
    status_breakdown: {},
    blocked_attempts: 0,
    filter_usage: { all: 0, france: 0, swiss: 0, live: 0, picture: 0, down: 0 },
    camera_interactions: {},
    connection_logs: [],
    recent_activity: [],
    started_at: new Date().toISOString()
  };
  scheduleSave();
  return true;
}

module.exports = {
  logConnection,
  recordEvent,
  getMetricsSummary,
  clearConnectionLogs,
  resetMetrics,
  parseUserAgent,
  parseReferrer
};
