// Script to import new verified Lyon feeds and update seed files
// Sources: Périphérique Nord (BPNL), Part-Dieu Silex², LPO Rhône-Alpes, Aérodrome Brindas

const fs = require('fs');
const path = require('path');

const NEW_LYON_CAMERAS = [
  {
    id: "bpnl-valvert",
    name: "Lyon - Périphérique Nord: Porte du Valvert",
    latitude: 45.7705553,
    longitude: 4.7872918,
    stream_url: "https://www.youtube.com/watch?v=WdgZIE0T4Gs",
    preview_image: "https://i.ytimg.com/vi/WdgZIE0T4Gs/hqdefault.jpg",
    youtube_id: "WdgZIE0T4Gs",
    is_snapshot: false,
    source: "Périphérique Nord (BPNL)",
    status: "operational",
    last_checked: new Date().toISOString()
  },
  {
    id: "bpnl-vaise",
    name: "Lyon - Périphérique Nord: Porte de Vaise",
    latitude: 45.7817334,
    longitude: 4.7993519,
    stream_url: "https://www.youtube.com/watch?v=z4vQEMiD3VI",
    preview_image: "https://i.ytimg.com/vi/z4vQEMiD3VI/hqdefault.jpg",
    youtube_id: "z4vQEMiD3VI",
    is_snapshot: false,
    source: "Périphérique Nord (BPNL)",
    status: "operational",
    last_checked: new Date().toISOString()
  },
  {
    id: "bpnl-croix-luizet",
    name: "Lyon - Périphérique Nord: Porte de Croix-Luizet",
    latitude: 45.7819899,
    longitude: 4.8927078,
    stream_url: "https://www.youtube.com/watch?v=CdLzCCHDaYQ",
    preview_image: "https://i.ytimg.com/vi/CdLzCCHDaYQ/hqdefault.jpg",
    youtube_id: "CdLzCCHDaYQ",
    is_snapshot: false,
    source: "Périphérique Nord (BPNL)",
    status: "operational",
    last_checked: new Date().toISOString()
  },
  {
    id: "bpnl-pape",
    name: "Lyon - Périphérique Nord: Porte de la Pape",
    latitude: 45.7910872,
    longitude: 4.8415849,
    stream_url: "https://www.youtube.com/watch?v=z545k7Tcb5o",
    preview_image: "https://i.ytimg.com/vi/z545k7Tcb5o/hqdefault.jpg",
    youtube_id: "z545k7Tcb5o",
    is_snapshot: false,
    source: "Périphérique Nord (BPNL)",
    status: "operational",
    last_checked: new Date().toISOString()
  },
  {
    id: "lyon-silex2-part-dieu",
    name: "Lyon - Part-Dieu: Tour Silex² (Covivio)",
    latitude: 45.7594,
    longitude: 4.8580,
    stream_url: "https://www.youtube.com/watch?v=S1GXeusRqMM",
    preview_image: "https://i.ytimg.com/vi/S1GXeusRqMM/hqdefault.jpg",
    youtube_id: "S1GXeusRqMM",
    is_snapshot: false,
    source: "Camera Silex Covivio",
    status: "operational",
    last_checked: new Date().toISOString()
  },
  {
    id: "chateauneuf-vallee-gier",
    name: "Vallée du Gier - Châteauneuf (LPO)",
    latitude: 45.5344777,
    longitude: 4.6341269,
    stream_url: "https://www.youtube.com/watch?v=vjZ7tn_bB34",
    preview_image: "https://i.ytimg.com/vi/vjZ7tn_bB34/hqdefault.jpg",
    youtube_id: "vjZ7tn_bB34",
    is_snapshot: false,
    source: "LPO Auvergne-Rhône-Alpes",
    status: "operational",
    last_checked: new Date().toISOString()
  },
  {
    id: "lyon-aerodrome-brindas",
    name: "Lyon - Aérodrome de Brindas (ACOL)",
    latitude: 45.7148,
    longitude: 4.6974,
    stream_url: "https://www.acol-brindas.com/pages/visu_camera_data.php?camera=1&vue=image&dc=1",
    preview_image: "https://www.acol-brindas.com/pages/visu_camera_data.php?camera=1&vue=image&dc=1",
    is_snapshot: true,
    refresh_interval: 60,
    source: "Aérodrome de Brindas (ACOL)",
    status: "operational",
    last_checked: new Date().toISOString()
  }
];

function run() {
  const publicSeedPath = path.join(__dirname, '../public/seed.json');
  const dataCamerasPath = path.join(__dirname, '../data/cameras.json');
  const libSeedPath = path.join(__dirname, '../lib/seed.js');

  const publicSeed = JSON.parse(fs.readFileSync(publicSeedPath, 'utf8'));
  let currentCameras = publicSeed.cameras || [];

  console.log(`Initial camera count: ${currentCameras.length}`);

  let added = 0;
  for (const cam of NEW_LYON_CAMERAS) {
    const exists = currentCameras.some(c => 
      c.id === cam.id || 
      (cam.youtube_id && c.youtube_id === cam.youtube_id) ||
      c.stream_url === cam.stream_url
    );

    if (exists) {
      console.log(`Skipping existing camera: ${cam.name} (${cam.id})`);
    } else {
      currentCameras.push(cam);
      console.log(`Adding new camera: ${cam.name} (${cam.id})`);
      added++;
    }
  }

  console.log(`Added ${added} new cameras. Total now: ${currentCameras.length}`);

  // 1. Update public/seed.json
  const updatedPublicSeed = {
    success: true,
    storage: "fallback",
    total: currentCameras.length,
    operational: currentCameras.filter(c => c.status === 'operational').length,
    down: currentCameras.filter(c => c.status === 'down').length,
    cameras: currentCameras
  };
  fs.writeFileSync(publicSeedPath, JSON.stringify(updatedPublicSeed, null, 2));
  console.log(`Updated ${publicSeedPath}`);

  // 2. Update data/cameras.json if exists
  if (fs.existsSync(dataCamerasPath)) {
    fs.writeFileSync(dataCamerasPath, JSON.stringify(currentCameras, null, 2));
    console.log(`Updated ${dataCamerasPath}`);
  }

  // 3. Update lib/seed.js
  const libSeedContent = `// Master Seed dataset of verified public CCTV & city flux streams\n` +
    `const SEED_CAMERAS = ${JSON.stringify(currentCameras, null, 2)};\n\n` +
    `module.exports = {\n  SEED_CAMERAS\n};\n`;
  fs.writeFileSync(libSeedPath, libSeedContent);
  console.log(`Updated ${libSeedPath}`);
}

if (require.main === module) {
  run();
}
