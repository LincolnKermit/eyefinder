const http = require('http');
const https = require('https');
const { SEED_CAMERAS } = require('./seed');

// Ping a CCTV stream URL to verify if it is operational or down
async function checkCameraHealth(url, timeoutMs = 3500) {
  if (!url || typeof url !== 'string' || !url.startsWith('http')) {
    return 'down';
  }

  // Handle fake / unreachable IPs immediately without hanging
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
        'User-Agent': 'EyeFinder-OSINT-Probe/1.0'
      }
    }).catch(async () => {
      // Fallback to GET with Range 0-0 if HEAD is disallowed
      return await fetch(url, {
        method: 'GET',
        signal: controller.signal,
        headers: {
          'User-Agent': 'EyeFinder-OSINT-Probe/1.0',
          'Range': 'bytes=0-10'
        }
      });
    });

    clearTimeout(timeoutId);

    // Any response under 400 is considered operational
    if (response && response.status < 400) {
      return 'operational';
    }
    return 'down';
  } catch (err) {
    return 'down';
  }
}

// Scrape and fetch public camera feeds
// Extensible: new city scrapers can be plugged here
async function scrapeFeeds() {
  const scraped = [...SEED_CAMERAS];

  // Example of extensible public scraper: Paris Open Data or Caltrans feed
  try {
    // We can merge additional live public feeds here
    // e.g. Open City Webcams / DOT feeds
  } catch (err) {
    console.error('Error in feed scraper:', err.message);
  }

  return scraped;
}

// Check health of an array of cameras in small batches
async function verifyAllCameras(cameras, concurrency = 5) {
  const results = [];

  for (let i = 0; i < cameras.length; i += concurrency) {
    const batch = cameras.slice(i, i + concurrency);
    const checkedBatch = await Promise.all(
      batch.map(async (cam) => {
        const status = await checkCameraHealth(cam.stream_url);
        return {
          ...cam,
          status,
          last_checked: new Date().toISOString()
        };
      })
    );
    results.push(...checkedBatch);
  }

  return results;
}

module.exports = {
  checkCameraHealth,
  scrapeFeeds,
  verifyAllCameras
};
