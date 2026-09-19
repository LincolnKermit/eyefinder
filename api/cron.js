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
    const { getCameras, upsertCameras } = require('../lib/db');
    const { verifyAllCameras, scrapeFeeds } = require('../lib/scraper');

    let cameras = await getCameras();
    if (!cameras || cameras.length === 0) {
      cameras = await scrapeFeeds();
    }

    // Verify online / down status for all cameras
    const checkedCameras = await verifyAllCameras(cameras);

    // Save updated status to database
    try {
      await upsertCameras(checkedCameras);
    } catch (e) {}

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
    return sendJson(res, 200, {
      success: false,
      diagnostics: true,
      error: err.message
    });
  }
};
