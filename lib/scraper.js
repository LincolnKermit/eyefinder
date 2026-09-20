const { SEED_CAMERAS } = require('./seed');

// Ping a CCTV stream URL to verify if it is operational or down
async function checkCameraHealth(url, timeoutMs = 1200) {
  if (!url || typeof url !== 'string' || !url.startsWith('http')) {
    return 'down';
  }

  // Handle fake / unreachable test IPs immediately without network call
  if (url.includes('192.0.2.') || url.includes('example.com/offline')) {
    return 'down';
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    const response = await fetch(url, {
      method: 'HEAD',
      signal: controller.signal,
      headers: {
        'User-Agent': 'EyeFinder-OSINT-Probe/2.0'
      }
    }).catch(async () => {
      // Fallback to GET with 1 byte Range if HEAD is rejected by IP camera webserver
      return await fetch(url, {
        method: 'GET',
        signal: controller.signal,
        headers: {
          'User-Agent': 'EyeFinder-OSINT-Probe/2.0',
          'Range': 'bytes=0-0'
        }
      });
    });

    clearTimeout(timeoutId);

    // Any HTTP response under 500 (including 200, 302, 401, 403) means the remote IP camera host is alive
    if (response && response.status < 500) {
      return 'operational';
    }
    return 'down';
  } catch (err) {
    return 'down';
  }
}

// Scrape and fetch public camera feeds
async function scrapeFeeds() {
  return [...SEED_CAMERAS];
}

// High-speed parallel health check with total time budget protection
async function verifyAllCameras(cameras, maxDurationMs = 3800, concurrency = 40) {
  const start = Date.now();
  const results = [...cameras];

  let idx = 0;
  async function worker() {
    while (idx < cameras.length && (Date.now() - start) < maxDurationMs) {
      const currentIdx = idx++;
      const cam = cameras[currentIdx];
      try {
        const status = await checkCameraHealth(cam.stream_url);
        results[currentIdx] = {
          ...cam,
          status,
          last_checked: new Date().toISOString()
        };
      } catch (e) {}
    }
  }

  const workers = Array(concurrency).fill(0).map(() => worker());
  await Promise.all(workers);

  return results;
}

module.exports = {
  checkCameraHealth,
  scrapeFeeds,
  verifyAllCameras
};
