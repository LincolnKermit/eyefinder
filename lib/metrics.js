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
  unique_visitors: {},
  device_breakdown: {
    desktop: 0,
    mobile: 0,
    tablet: 0,
    unknown: 0
  },
  filter_usage: {
    all: 0,
    france: 0,
    swiss: 0,
    live: 0,
    picture: 0,
    down: 0
  },
  camera_interactions: {},
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
          filter_usage: { ...metrics.filter_usage, ...(parsed.filter_usage || {}) },
          camera_interactions: { ...metrics.camera_interactions, ...(parsed.camera_interactions || {}) },
          recent_activity: Array.isArray(parsed.recent_activity) ? parsed.recent_activity : []
        };
      }
    }
  } catch (e) {
    // Start with default memory store if file cannot be read
  }
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
 * Mask IP address for privacy compliance (GDPR/ePrivacy: zero plain PII storage)
 */
function maskIp(ip) {
  if (!ip) return '0.0.0.0';
  if (ip.includes('.')) {
    const parts = ip.split('.');
    return `${parts[0]}.${parts[1]}.***.***`;
  }
  if (ip.includes(':')) {
    const parts = ip.split(':');
    return `${parts[0]}:${parts[1]}:****:****`;
  }
  return '***';
}

/**
 * Record a visitor ping/event
 */
function recordEvent({ type, sessionId, device, details, ip }) {
  const now = new Date().toISOString();
  const maskedIp = maskIp(ip);

  if (type === 'pageview') {
    metrics.total_page_views += 1;
    if (sessionId) {
      // Hash session ID with daily salt for anonymity
      const day = now.slice(0, 10);
      const hash = crypto.createHash('sha256').update(`${sessionId}-${day}`).digest('hex').slice(0, 16);
      metrics.unique_visitors[hash] = (metrics.unique_visitors[hash] || 0) + 1;
    }

    if (device && metrics.device_breakdown[device] !== undefined) {
      metrics.device_breakdown[device] += 1;
    } else {
      metrics.device_breakdown.unknown += 1;
    }
  } else if (type === 'filter') {
    const key = (details || '').toLowerCase().trim();
    if (metrics.filter_usage[key] !== undefined) {
      metrics.filter_usage[key] += 1;
    }
  } else if (type === 'camera_view') {
    const camKey = String(details || 'Unknown Camera').slice(0, 100);
    metrics.camera_interactions[camKey] = (metrics.camera_interactions[camKey] || 0) + 1;
  }

  // Prepend to recent activity stream (max 60 events)
  const eventEntry = {
    id: `ev-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    timestamp: now,
    type: String(type || 'event').slice(0, 30),
    details: String(details || '').slice(0, 120),
    device: String(device || 'unknown').slice(0, 20),
    ip: maskedIp
  };

  metrics.recent_activity.unshift(eventEntry);
  if (metrics.recent_activity.length > 60) {
    metrics.recent_activity.pop();
  }

  scheduleSave();
}

/**
 * Get aggregated metrics summary for Admin Dashboard
 */
function getMetricsSummary() {
  const uniqueCount = Object.keys(metrics.unique_visitors).length;
  
  // Sort top 10 cameras by interactions
  const topCameras = Object.entries(metrics.camera_interactions)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  return {
    success: true,
    total_page_views: metrics.total_page_views,
    unique_visitors: uniqueCount,
    device_breakdown: metrics.device_breakdown,
    filter_usage: metrics.filter_usage,
    top_cameras: topCameras,
    recent_activity: metrics.recent_activity.slice(0, 40),
    uptime_since: metrics.started_at
  };
}

/**
 * Reset metrics (Admin only)
 */
function resetMetrics() {
  metrics = {
    total_page_views: 0,
    unique_visitors: {},
    device_breakdown: { desktop: 0, mobile: 0, tablet: 0, unknown: 0 },
    filter_usage: { all: 0, france: 0, swiss: 0, live: 0, picture: 0, down: 0 },
    camera_interactions: {},
    recent_activity: [],
    started_at: new Date().toISOString()
  };
  scheduleSave();
  return true;
}

module.exports = {
  recordEvent,
  getMetricsSummary,
  resetMetrics
};
