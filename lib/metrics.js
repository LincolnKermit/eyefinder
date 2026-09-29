const fs = require('fs');
const path = require('path');

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
  ip_details: {},
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

/**
 * Classify IP address type for intelligence display
 */
function classifyIp(ip) {
  if (!ip) return 'Unknown';
  const clean = ip.trim();
  if (clean === '127.0.0.1' || clean === '::1' || clean === 'localhost') return 'Localhost';
  if (/^10\./.test(clean) || /^192\.168\./.test(clean) || /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(clean)) return 'Private LAN';
  if (clean.startsWith('100.64.') || clean.startsWith('100.127.')) return 'Carrier NAT';
  if (clean.includes(':')) return 'Public IPv6';
  return 'Public IPv4';
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
          ip_details: { ...(parsed.ip_details || {}) },
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
    return { browser: 'Unknown', os: 'Unknown', device: 'Desktop', isBot: false };
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
  let cleanIp = String(ip || '127.0.0.1').trim();
  if (cleanIp === '::1') cleanIp = '127.0.0.1';
  if (cleanIp.startsWith('::ffff:')) cleanIp = cleanIp.slice(7);
  const cleanPath = String(path || '/').split('?')[0];
  const ipType = classifyIp(cleanIp);

  // Increment aggregate counters
  metrics.total_connections += 1;
  metrics.unique_ips[cleanIp] = (metrics.unique_ips[cleanIp] || 0) + 1;

  // Track rich per-IP details
  if (!metrics.ip_details) metrics.ip_details = {};
  const existingIp = metrics.ip_details[cleanIp] || {
    ip: cleanIp,
    type: ipType,
    count: 0,
    page_views: 0,
    first_seen: now,
    last_seen: now,
    last_path: cleanPath,
    last_method: method.toUpperCase(),
    last_status: Number(statusCode),
    browser: parsedUA.browser,
    os: parsedUA.os,
    device: parsedUA.device,
    is_bot: parsedUA.isBot,
    user_agent: String(userAgent || '').slice(0, 200),
    paths: []
  };

  existingIp.count += 1;
  existingIp.last_seen = now;
  existingIp.last_path = cleanPath;
  existingIp.last_method = method.toUpperCase();
  existingIp.last_status = Number(statusCode);
  if (parsedUA.browser && parsedUA.browser !== 'Unknown' && parsedUA.browser !== 'Other') {
    existingIp.browser = parsedUA.browser;
  }
  if (parsedUA.os && parsedUA.os !== 'Unknown') {
    existingIp.os = parsedUA.os;
  }
  if (parsedUA.device) existingIp.device = parsedUA.device;
  existingIp.is_bot = parsedUA.isBot;
  if (!existingIp.paths) existingIp.paths = [];
  if (!existingIp.paths.includes(cleanPath)) {
    existingIp.paths.unshift(cleanPath);
    if (existingIp.paths.length > 6) existingIp.paths.pop();
  }

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
    existingIp.page_views += 1;
  } else if (cleanPath.startsWith('/api/')) {
    category = 'api';
  } else if (cleanPath.endsWith('.json') || cleanPath.endsWith('.geojson') || cleanPath.endsWith('.kml') || cleanPath.endsWith('.csv')) {
    category = 'data';
  }

  metrics.ip_details[cleanIp] = existingIp;

  const logEntry = {
    id: `req-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    timestamp: now,
    ip: cleanIp,
    ip_type: ipType,
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

  // Keep last 500 connection records in memory/disk
  metrics.connection_logs.unshift(logEntry);
  if (metrics.connection_logs.length > 500) {
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
  if (metrics.recent_activity.length > 80) {
    metrics.recent_activity.pop();
  }

  scheduleSave();
}

/**
 * Record a client beacon event (e.g. filter clicked, camera opened, pageview)
 */
function recordEvent({ type, sessionId, device, details, ip, userAgent = '', referrer = '' }) {
  const now = new Date().toISOString();
  let cleanIp = String(ip || '127.0.0.1').trim();
  if (cleanIp === '::1') cleanIp = '127.0.0.1';
  if (cleanIp.startsWith('::ffff:')) cleanIp = cleanIp.slice(7);

  if (type === 'filter') {
    const key = (details || '').toLowerCase().trim();
    if (metrics.filter_usage[key] !== undefined) {
      metrics.filter_usage[key] += 1;
    }
  } else if (type === 'camera_view') {
    const camKey = String(details || 'Unknown Camera').slice(0, 100);
    metrics.camera_interactions[camKey] = (metrics.camera_interactions[camKey] || 0) + 1;
  } else if (type === 'pageview') {
    metrics.total_page_views += 1;
  }

  // Update IP tracking
  metrics.unique_ips[cleanIp] = (metrics.unique_ips[cleanIp] || 0) + 1;
  if (!metrics.ip_details) metrics.ip_details = {};
  if (!metrics.ip_details[cleanIp]) {
    metrics.ip_details[cleanIp] = {
      ip: cleanIp,
      type: classifyIp(cleanIp),
      count: 1,
      page_views: type === 'pageview' ? 1 : 0,
      first_seen: now,
      last_seen: now,
      last_path: details || `event:${type}`,
      last_method: 'BEACON',
      last_status: 200,
      browser: 'Web Client',
      os: 'Client OS',
      device: device || 'Desktop',
      is_bot: false,
      user_agent: String(userAgent || ''),
      paths: [details || `event:${type}`]
    };
  } else {
    metrics.ip_details[cleanIp].count += 1;
    metrics.ip_details[cleanIp].last_seen = now;
    if (type === 'pageview') metrics.ip_details[cleanIp].page_views += 1;
  }

  // Log client event
  const logEntry = {
    id: `ev-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    timestamp: now,
    ip: cleanIp,
    ip_type: classifyIp(cleanIp),
    method: 'EVENT',
    path: details ? `event:${type} [${details}]` : `event:${type}`,
    category: type === 'pageview' ? 'page' : 'event',
    status: 200,
    referrer: referrer || 'Direct',
    referrer_domain: 'Client Beacon',
    userAgent: userAgent || `Client (${device || 'Desktop'})`,
    browser: 'Web Browser',
    os: 'Client',
    device: device || 'Desktop',
    isBot: false,
    authStatus: type.includes('auth') ? 'authenticated' : 'public',
    durationMs: 0
  };

  metrics.connection_logs.unshift(logEntry);
  if (metrics.connection_logs.length > 500) metrics.connection_logs.pop();

  scheduleSave();
}

/**
 * Get aggregated metrics summary for Admin Dashboard
 */
function getMetricsSummary(limit = 200) {
  const uniqueIpsCount = Object.keys(metrics.unique_ips).length;
  const totalConns = metrics.total_connections || 1;

  // Rich IP intelligence list
  const topIps = Object.values(metrics.ip_details || {})
    .map(ipObj => ({
      ...ipObj,
      percentage: Math.round(((ipObj.count || 0) / totalConns) * 100)
    }))
    .sort((a, b) => b.count - a.count);

  // If ip_details was empty but unique_ips has entries, backfill
  if (topIps.length === 0 && uniqueIpsCount > 0) {
    Object.entries(metrics.unique_ips).forEach(([ip, count]) => {
      topIps.push({
        ip,
        type: classifyIp(ip),
        count,
        percentage: Math.round((count / totalConns) * 100),
        last_seen: metrics.started_at,
        last_path: '/',
        last_method: 'GET',
        last_status: 200,
        browser: 'Web Client',
        os: 'Client OS',
        device: 'Desktop',
        is_bot: false,
        user_agent: 'Client Request'
      });
    });
    topIps.sort((a, b) => b.count - a.count);
  }

  // Top Cameras
  const topCameras = Object.entries(metrics.camera_interactions)
    .map(([name, count]) => ({ name, label: name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 20);

  // Top Referrers
  const topReferrers = Object.entries(metrics.referrer_breakdown)
    .map(([domain, count]) => ({ domain, label: domain, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 20);

  // Top Browsers
  const topBrowsers = Object.entries(metrics.browser_breakdown)
    .map(([browser, count]) => ({ browser, label: browser, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 20);

  // Top Operating Systems
  const topOS = Object.entries(metrics.os_breakdown)
    .map(([os, count]) => ({ os, label: os, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 20);

  // Top Endpoints
  const topEndpoints = Object.entries(metrics.endpoint_breakdown)
    .map(([path, count]) => ({ path, label: path, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 20);

  // Devices
  const topDevices = Object.entries(metrics.device_breakdown)
    .map(([device, count]) => ({ device, label: device.toUpperCase(), count }))
    .sort((a, b) => b.count - a.count);

  // Status Codes
  const topStatuses = Object.entries(metrics.status_breakdown)
    .map(([status, count]) => ({ status, label: `${status} Code`, count }))
    .sort((a, b) => b.count - a.count);

  // Structured Categories Map for Dropdown Accordions
  const categories = {
    ips: {
      id: 'ips',
      title: 'Visitor IP Addresses',
      icon: '🌐',
      description: 'Network origins and direct client IP addresses',
      total_distinct: topIps.length,
      total_hits: metrics.total_connections,
      items: topIps
    },
    browsers: {
      id: 'browsers',
      title: 'Web Browsers',
      icon: '🧭',
      description: 'Client browser families and versions',
      total_distinct: topBrowsers.length,
      total_hits: metrics.total_connections,
      items: topBrowsers
    },
    os: {
      id: 'os',
      title: 'Operating Systems',
      icon: '💻',
      description: 'Host platforms and mobile environments',
      total_distinct: topOS.length,
      total_hits: metrics.total_connections,
      items: topOS
    },
    devices: {
      id: 'devices',
      title: 'Hardware & Platforms',
      icon: '📱',
      description: 'Form factor breakdown (Desktop, Mobile, Tablet, Bot)',
      total_distinct: topDevices.filter(d => d.count > 0).length,
      total_hits: metrics.total_connections,
      items: topDevices
    },
    endpoints: {
      id: 'endpoints',
      title: 'Requested Endpoints',
      icon: '🛣️',
      description: 'Top queried web routes and API methods',
      total_distinct: topEndpoints.length,
      total_hits: metrics.total_connections,
      items: topEndpoints
    },
    referrers: {
      id: 'referrers',
      title: 'Traffic Sources & Referrers',
      icon: '🔗',
      description: 'Referrer headers and origin domains',
      total_distinct: topReferrers.length,
      total_hits: metrics.total_connections,
      items: topReferrers
    },
    status_codes: {
      id: 'status_codes',
      title: 'HTTP Status Codes',
      icon: '🛡️',
      description: 'Response outcomes (200 OK, 401 Blocked, 404)',
      total_distinct: topStatuses.length,
      total_hits: metrics.total_connections,
      items: topStatuses
    },
    cameras: {
      id: 'cameras',
      title: 'Camera Stream Interactions',
      icon: '📹',
      description: 'Most viewed live feeds and snapshots',
      total_distinct: topCameras.length,
      total_hits: topCameras.reduce((acc, c) => acc + c.count, 0),
      items: topCameras
    }
  };

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
    categories,
    connection_logs: metrics.connection_logs.slice(0, Math.min(limit, 500)),
    recent_activity: metrics.recent_activity.slice(0, 50),
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
    ip_details: {},
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
  classifyIp,
  parseUserAgent,
  parseReferrer
};
