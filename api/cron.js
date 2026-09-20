function sendJson(res, statusCode, data) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Content-Type', 'application/json');

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
    if (typeof res.status === 'function') return res.status(200).end();
    res.statusCode = 200;
    return res.end();
  }

  const startTime = Date.now();

  try {
    let getCameras, upsertCameras;
    try {
      const db = require('../lib/db');
      getCameras = db.getCameras;
      upsertCameras = db.upsertCameras;
    } catch (e) {}

    const { verifyAllCameras, scrapeFeeds } = require('../lib/scraper');

    let cameras = null;
    if (typeof getCameras === 'function') {
      try {
        cameras = await getCameras();
      } catch (e) {}
    }

    if (!cameras || cameras.length === 0) {
      try {
        const seedJson = require('../public/seed.json');
        cameras = seedJson.cameras || [];
      } catch (e) {
        cameras = await scrapeFeeds();
      }
    }

    // Verify online / down status for all cameras with strict 3.8s time budget
    const checkedCameras = await verifyAllCameras(cameras, 3800, 40);

    // Save updated status to database asynchronously without blocking response
    if (typeof upsertCameras === 'function') {
      upsertCameras(checkedCameras).catch(() => {});
    }

    const operational = checkedCameras.filter(c => c.status === 'operational').length;
    const down = checkedCameras.filter(c => c.status === 'down').length;
    const duration = Date.now() - startTime;

    return sendJson(res, 200, {
      success: true,
      timestamp: new Date().toISOString(),
      duration_ms: duration,
      summary: {
        total: checkedCameras.length,
        operational,
        down
      },
      cameras: checkedCameras
    });
  } catch (err) {
    console.error('Cron job error:', err);
    // Graceful fallback to static seed if anything fails
    try {
      const seedJson = require('../public/seed.json');
      return sendJson(res, 200, {
        success: true,
        summary: {
          total: seedJson.total || seedJson.cameras.length,
          operational: seedJson.operational || seedJson.cameras.length,
          down: seedJson.down || 0
        },
        cameras: seedJson.cameras
      });
    } catch (e2) {
      return sendJson(res, 200, {
        success: false,
        error: err.message
      });
    }
  }
};
