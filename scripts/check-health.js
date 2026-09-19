const { getCameras, upsertCameras } = require('../lib/db');
const { verifyAllCameras } = require('../lib/scraper');

async function main() {
  console.log('[EyeFinder Scanner] Fetching cameras for health check...');
  const cameras = await getCameras();
  console.log(`[EyeFinder Scanner] Found ${cameras.length} cameras. Testing stream endpoints...`);

  const checked = await verifyAllCameras(cameras);
  await upsertCameras(checked);

  const operational = checked.filter(c => c.status === 'operational').length;
  const down = checked.filter(c => c.status === 'down').length;

  console.log('--- Scan Summary ---');
  console.log(`Total: ${checked.length}`);
  console.log(`Operational: ${operational}`);
  console.log(`Down: ${down}`);
}

main().catch(err => {
  console.error('[EyeFinder Scanner] Error:', err);
  process.exit(1);
});
