const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const camerasHandler = require('./api/cameras');
const cronHandler = require('./api/cron');
const adminHandler = require('./api/admin');
const metricsHandler = require('./api/metrics');
const authHandler = require('./api/auth');
const { logConnection } = require('./lib/metrics');

const PORT = process.env.PORT || 3000;

// MIME types for static assets
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.geojson': 'application/geo+json; charset=utf-8',
  '.kml': 'application/vnd.google-earth.kml+xml; charset=utf-8',
  '.csv': 'text/csv; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp'
};

// Polyfill express/vercel-style response helpers and apply security headers
function enhanceResponse(res) {
  // Defensive Security Headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(), camera=(), microphone=()');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  
  // Content Security Policy (allowing Leaflet CDN, ESRI dark tiles, YouTube nocookie, and proxy endpoints)
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; " +
    "script-src 'self' 'unsafe-inline' https://unpkg.com; " +
    "style-src 'self' 'unsafe-inline' https://unpkg.com https://fonts.googleapis.com; " +
    "font-src 'self' https://fonts.gstatic.com data:; " +
    "img-src 'self' data: blob: https: http:; " +
    "media-src 'self' blob: https: http:; " +
    "frame-src 'self' https://www.youtube-nocookie.com https://www.youtube.com; " +
    "connect-src 'self' https: http:; " +
    "object-src 'none'; " +
    "base-uri 'self';"
  );

  res.status = function (code) {
    this.statusCode = code;
    return this;
  };
  res.json = function (data) {
    this.setHeader('Content-Type', 'application/json; charset=utf-8');
    this.end(JSON.stringify(data));
    return this;
  };
}

// Parse request body with DoS / payload size protection (max 2MB)
function parseBody(req, limitBytes = 2 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    let body = '';
    let bytes = 0;
    req.on('data', chunk => {
      bytes += chunk.length;
      if (bytes > limitBytes) {
        req.destroy();
        const err = new Error('Payload Too Large');
        err.statusCode = 413;
        reject(err);
        return;
      }
      body += chunk;
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (e) {
        resolve({});
      }
    });
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  const startTime = Date.now();
  enhanceResponse(res);
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;
  req.query = parsedUrl.query;

  // Log every connection upon response completion
  res.on('finish', () => {
    try {
      const forwarded = req.headers['x-forwarded-for'];
      const clientIp = forwarded
        ? forwarded.split(',')[0].trim()
        : (req.headers['x-real-ip'] || req.socket.remoteAddress || '127.0.0.1');

      let authStatus = 'public';
      if (res.statusCode === 401) {
        authStatus = 'blocked';
      } else if (pathname.startsWith('/api/admin')) {
        authStatus = 'admin';
      } else if (req.headers['authorization'] || req.headers['x-access-token']) {
        authStatus = 'authenticated';
      }

      logConnection({
        ip: clientIp,
        method: req.method,
        path: pathname,
        statusCode: res.statusCode,
        userAgent: req.headers['user-agent'] || '',
        referrer: req.headers['referer'] || req.headers['referrer'] || '',
        durationMs: Date.now() - startTime,
        authStatus
      });
    } catch (e) {}
  });

  // Auto-parse body for mutating HTTP methods
  if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method)) {
    try {
      req.body = await parseBody(req);
    } catch (err) {
      if (err.statusCode === 413) {
        res.statusCode = 413;
        return res.end(JSON.stringify({ error: 'Payload Too Large' }));
      }
      req.body = {};
    }
  }

  // 1. API: Cameras
  if (pathname === '/api/cameras') {
    return camerasHandler(req, res);
  }

  // 2. API: Health Cron
  if (pathname === '/api/cron' || pathname === '/api/refresh') {
    return cronHandler(req, res);
  }

  // 3. API: Admin
  if (pathname.startsWith('/api/admin')) {
    return adminHandler(req, res);
  }

  // 4. API: Visitor Metrics
  if (pathname.startsWith('/api/metrics')) {
    return metricsHandler(req, res);
  }

  // 5. API: Auth & Access Gate
  if (pathname.startsWith('/api/auth')) {
    return authHandler(req, res);
  }

  // 5. Protected datasets: seed.json, cameras.json, backups when private mode is enabled
  const sensitiveFiles = [
    '/seed.json', '/public/seed.json',
    '/data/cameras.json',
    '/backups/cameras.json', '/backups/cameras.geojson', '/backups/cameras.csv', '/backups/cameras.kml',
    '/public/backups/cameras.json', '/public/backups/cameras.geojson', '/public/backups/cameras.csv', '/public/backups/cameras.kml'
  ];
  if (sensitiveFiles.includes(pathname)) {
    try {
      const { getSiteSettings, verifyAccessPasskey, extractAuthToken } = require('./lib/security');
      const settings = getSiteSettings();
      if (settings.private_mode) {
        const token = extractAuthToken(req) || (req.query && req.query.token);
        const auth = verifyAccessPasskey(token);
        if (!auth || !auth.valid) {
          res.statusCode = 401;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          return res.end(JSON.stringify({ error: 'Accès restreint. Mot de passe requis.', locked: true }));
        }
      }
    } catch (e) {}
  }

  // 6. Serve static files with path traversal prevention
  const safeBase = path.resolve(__dirname);
  const targetFile = pathname === '/' ? 'index.html' : '.' + pathname;
  const filePath = path.resolve(safeBase, targetFile);

  // Strict path traversal mitigation: ensure target path is within project root
  if (!filePath.startsWith(safeBase + path.sep) && filePath !== path.join(safeBase, 'index.html')) {
    res.statusCode = 403;
    return res.end('Access Denied: Path Traversal Prohibited');
  }

  fs.stat(filePath, (err, stats) => {
    let finalPath = filePath;
    if (err || !stats.isFile()) {
      // Fallback to index.html for unknown routes if not an API route
      finalPath = path.join(safeBase, 'index.html');
    }

    const ext = path.extname(finalPath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    fs.readFile(finalPath, (readErr, content) => {
      if (readErr) {
        res.statusCode = 404;
        return res.end('Not Found');
      }
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content);
    });
  });
});

server.listen(PORT, () => {
  console.log(`[EyeFinder] Server running on http://localhost:${PORT}`);
  console.log(`[EyeFinder] Admin portal at http://localhost:${PORT}/admin.html`);
  console.log(`[EyeFinder] Security audit & defense active`);
});
