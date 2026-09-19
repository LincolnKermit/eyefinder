const { upsertCameras, isUsingSupabase } = require('../lib/db');
const { SEED_CAMERAS } = require('../lib/seed');

async function main() {
  console.log('[EyeFinder Seed] Initializing database with seed CCTV streams...');
  console.log(`[EyeFinder Seed] Target database: ${isUsingSupabase() ? 'Supabase' : 'Local Datastore'}`);

  const saved = await upsertCameras(SEED_CAMERAS);
  console.log(`[EyeFinder Seed] Successfully loaded ${saved.length} cameras into database.`);
}

main().catch(err => {
  console.error('[EyeFinder Seed] Error:', err);
  process.exit(1);
});
