const http = require('http');
const https = require('https');
const { parse } = require('url');

// Inline SVG tactical placeholder when a feed is offline or timed out
function getOfflineSvg(message = 'SIGNAL OFFLINE') {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="240" viewBox="0 0 320 240" fill="#0d1117">
    <rect width="320" height="240" fill="#0a0f0d"/>
    <circle cx="160" cy="105" r="32" stroke="#ef4444" stroke-width="2" fill="none" opacity="0.5"/>
    <circle cx="160" cy="105" r="14" stroke="#ef4444" stroke-width="1.5" fill="none" opacity="0.8"/>
    <line x1="135" y1="80" x2="185" y2="130" stroke="#ef4444" stroke-width="2"/>
    <text x="160" y="160" fill="#ef4444" font-family="monospace" font-size="11" font-weight="bold" text-anchor="middle" letter-spacing="1.5">${message}</text>
    <text x="160" y="180" fill="#86efac" font-family="monospace" font-size="9" text-anchor="middle" opacity="0.6">REMOTE IP PROBE TIMEOUT</text>
  </svg>`;
}

// Extract a single JPEG frame from an MJPEG stream or image response
function fetchSingleFrame(targetUrl, timeoutMs = 4500) {
  return new Promise((resolve, reject) => {
    let parsedUrl;
    try {
      parsedUrl = parse(targetUrl);
    } catch (e) {
      return reject(new Error('Invalid URL'));
    }

    const client = parsedUrl.protocol === 'https:' ? https : http;
    const req = client.get(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8'
      },
      timeout: timeoutMs
    }, (res) => {
      const contentType = res.headers['content-type'] || 'image/jpeg';

      // If standard static image, collect all chunks
      if (contentType.includes('image/jpeg') || contentType.includes('image/png') || contentType.includes('image/webp')) {
        const chunks = [];
        res.on('data', c => chunks.push(c));
        res.on('end', () => resolve({ buffer: Buffer.concat(chunks), contentType }));
        res.on('error', reject);
        return;
      }

      // MJPEG multipart stream: scan for JPEG SOI (0xFF 0xD8) and EOI (0xFF 0xD9)
      let chunks = [];
      let found = false;

      res.on('data', (chunk) => {
        if (found) return;
        chunks.push(chunk);
        const buf = Buffer.concat(chunks);
        const start = buf.indexOf(Buffer.from([0xff, 0xd8]));
        if (start !== -1) {
          const end = buf.indexOf(Buffer.from([0xff, 0xd9]), start + 2);
          if (end !== -1) {
            found = true;
            req.destroy();
            resolve({ buffer: buf.slice(start, end + 2), contentType: 'image/jpeg' });
          }
        }
      });

      res.on('end', () => {
        if (!found) {
          const buf = Buffer.concat(chunks);
          if (buf.length > 0) {
            resolve({ buffer: buf, contentType: 'image/jpeg' });
          } else {
            reject(new Error('No frame captured'));
          }
        }
      });

      res.on('error', reject);
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Stream timeout'));
    });
  });
}

module.exports = async function handler(req, res) {
  // CORS & Security Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Range');
  res.setHeader('Referrer-Policy', 'no-referrer');

  if (req.method === 'OPTIONS') {
    res.statusCode = 200;
    return res.end();
  }

  // Parse query params safely
  const query = req.query || parse(req.url, true).query || {};
  const targetUrl = query.url;
  const mode = query.mode || 'stream'; // 'stream' or 'frame'

  if (!targetUrl || typeof targetUrl !== 'string') {
    res.statusCode = 400;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ error: 'Missing url parameter' }));
  }

  // Validate protocol & SSRF protection
  let parsedUrl;
  try {
    parsedUrl = parse(targetUrl);
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      res.statusCode = 400;
      return res.end('Invalid protocol');
    }
    const hostname = (parsedUrl.hostname || '').toLowerCase();
    if (
      !hostname ||
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname.startsWith('10.') ||
      hostname.startsWith('192.168.') ||
      hostname.startsWith('172.16.') ||
      hostname.startsWith('169.254.') ||
      hostname === '0.0.0.0'
    ) {
      res.statusCode = 403;
      return res.end('Forbidden host');
    }
  } catch (err) {
    res.statusCode = 400;
    return res.end('Malformed URL');
  }

  // Mode: Frame extraction (single JPEG image, ideal for fast snapshots and fallback)
  if (mode === 'frame') {
    try {
      const frame = await fetchSingleFrame(targetUrl, 4200);
      res.statusCode = 200;
      res.setHeader('Content-Type', frame.contentType || 'image/jpeg');
      res.setHeader('Content-Length', frame.buffer.length);
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      return res.end(frame.buffer);
    } catch (err) {
      res.statusCode = 502;
      res.setHeader('Content-Type', 'image/svg+xml');
      return res.end(getOfflineSvg('CAMERA OFFLINE'));
    }
  }

  // Mode: Live Streaming (pipes MJPEG multipart or direct image flux)
  const client = parsedUrl.protocol === 'https:' ? https : http;

  const remoteReq = client.get(targetUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8'
    },
    timeout: 7000
  }, (remoteRes) => {
    // If the remote server returns an error code
    if (remoteRes.statusCode >= 400) {
      if (!res.headersSent) {
        res.statusCode = 502;
        res.setHeader('Content-Type', 'image/svg+xml');
        return res.end(getOfflineSvg('STREAM UNAVAILABLE'));
      }
    }

    const contentType = remoteRes.headers['content-type'] || 'image/jpeg';
    res.statusCode = remoteRes.statusCode || 200;
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    // Pipe remote stream directly into response
    remoteRes.pipe(res);

    remoteRes.on('error', () => {
      if (!res.headersSent) {
        res.statusCode = 502;
        res.setHeader('Content-Type', 'image/svg+xml');
        res.end(getOfflineSvg('STREAM ERROR'));
      } else {
        res.end();
      }
    });
  });

  remoteReq.on('error', () => {
    if (!res.headersSent) {
      res.statusCode = 502;
      res.setHeader('Content-Type', 'image/svg+xml');
      res.end(getOfflineSvg('CONNECTION FAILED'));
    }
  });

  remoteReq.on('timeout', () => {
    remoteReq.destroy();
    if (!res.headersSent) {
      res.statusCode = 504;
      res.setHeader('Content-Type', 'image/svg+xml');
      res.end(getOfflineSvg('PROBE TIMEOUT'));
    }
  });

  // When client closes browser tab/popup, terminate upstream camera connection immediately
  req.on('close', () => {
    remoteReq.destroy();
  });
};
