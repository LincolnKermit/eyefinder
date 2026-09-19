const { getCameras, upsertCameras } = require('../lib/db');
const { verifyAllCameras, scrapeFeeds } = require('../lib/scraper');
const { SEED_CAMERAS } = require('../lib/seed');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const startTime = Date.now();

  try {
    let cameras = await getCameras();
    if (!cameras || cameras.length === 0) {
      cameras = await scrapeFeeds();
    }

    // Verify online / down status for all cameras
    const checkedCameras = await verifyAllCameras(cameras);

    // Save updated status to database
    await upsertCameras(checkedCameras);

    const operational = checkedCameras.filter(c => c.status === 'operational').length;
    const down = checkedCameras.filter(c => c.status === 'down').length;
    const duration = Date.now() - startTime;

    return res.status(200).json({
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
    return res.status(500).json({
      success: false,
      error: err.message
    });
  }
};
