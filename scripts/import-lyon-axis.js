const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT_DIR = path.resolve(__dirname, '..');
const DATA_FILE = path.join(ROOT_DIR, 'data', 'cameras.json');
const SEED_FILE = path.join(ROOT_DIR, 'lib', 'seed.js');
const PUBLIC_SEED = path.join(ROOT_DIR, 'public', 'seed.json');

const NEW_LYON_CAMERAS = [
  {
    id: "lyon-axis-aubepin",
    name: "[Axis] Lyon Ouest - Monts du Lyonnais (Météo L'Aubépin)",
    latitude: 45.6742,
    longitude: 4.4981,
    stream_url: "https://www.meteo-aubepin.fr/axis/live.jpg",
    preview_image: "https://www.meteo-aubepin.fr/axis/live.jpg",
    is_snapshot: true,
    refresh_interval: 60,
    source: "Axis Communications (Météo L'Aubépin)",
    country: "France",
    city: "Lyon",
    status: "operational",
    insecam_url: "https://www.meteo-aubepin.fr/",
    last_checked: new Date().toISOString()
  },
  {
    id: "lyon-rhone-alpes-axis-m5525e",
    name: "[Axis] Lyon / Rhône-Alpes - Axis M5525-E PTZ Live Stream",
    latitude: 45.0716,
    longitude: 5.5564,
    stream_url: "http://82.127.206.236/axis-cgi/mjpg/video.cgi",
    preview_image: "http://82.127.206.236/axis-cgi/jpg/image.cgi",
    is_snapshot: false,
    is_mjpeg: true,
    refresh_interval: 0,
    source: "Insecam (Axis M5525-E)",
    country: "France",
    city: "Lyon",
    status: "operational",
    insecam_url: "http://82.127.206.236/",
    last_checked: new Date().toISOString()
  },
  {
    id: "lyon-mont-cindre",
    name: "Lyon Métropole - Mont Cindre (Panoramique Sud-Est)",
    latitude: 45.8197,
    longitude: 4.8214,
    stream_url: "https://images-webcams.windy.com/06/1661360406/current/full/1661360406.jpg",
    preview_image: "https://images-webcams.windy.com/06/1661360406/current/full/1661360406.jpg",
    is_snapshot: true,
    refresh_interval: 120,
    source: "NetSyst (Mont Cindre)",
    country: "France",
    city: "Lyon",
    status: "operational",
    insecam_url: "https://app.webcam-hd.com/netsyst/mont-cindre",
    last_checked: new Date().toISOString()
  },
  {
    id: "lyon-oullins-ifs",
    name: "Lyon Sud - Oullins: Résidence Les Ifs",
    latitude: 45.7144,
    longitude: 4.8067,
    stream_url: "http://residence-les-ifs.info/Webcam/Webcam.jpg",
    preview_image: "http://residence-les-ifs.info/Webcam/Webcam.jpg",
    is_snapshot: true,
    refresh_interval: 60,
    source: "Résidence Les Ifs (Grand Lyon)",
    country: "France",
    city: "Lyon",
    status: "operational",
    insecam_url: "http://residence-les-ifs.info/",
    last_checked: new Date().toISOString()
  },
  {
    id: "lyon-centre-ipcam",
    name: "Lyon Centre - Caméra IP Publique (Presqu'île)",
    latitude: 45.7578,
    longitude: 4.8320,
    stream_url: "http://92.154.0.63:1024/oneshotimage1",
    preview_image: "http://92.154.0.63:1024/oneshotimage1",
    is_snapshot: true,
    refresh_interval: 30,
    source: "Insecam (Lyon IP Cam)",
    country: "France",
    city: "Lyon",
    status: "operational",
    insecam_url: "http://www.insecam.org/en/view/869519/",
    last_checked: new Date().toISOString()
  },
  {
    id: "lyon-ouest-sain-bel",
    name: "Lyon Ouest - Sain-Bel (Vallée de la Brévenne)",
    latitude: 45.8119,
    longitude: 4.6006,
    stream_url: "http://www.meteo-sain-bel.fr/script/webcam/webcam.jpg",
    preview_image: "http://www.meteo-sain-bel.fr/script/webcam/webcam.jpg",
    is_snapshot: true,
    refresh_interval: 60,
    source: "Météo Sain-Bel (Rhône)",
    country: "France",
    city: "Lyon",
    status: "operational",
    insecam_url: "http://www.meteo-sain-bel.fr/",
    last_checked: new Date().toISOString()
  },
  {
    id: "lyon-nord-anse",
    name: "Lyon Nord - Anse: Val de Saône / Beaujolais",
    latitude: 45.9347,
    longitude: 4.7172,
    stream_url: "https://www.bojolpif.com/Anse_cam.php",
    preview_image: "https://www.bojolpif.com/Anse_cam.php",
    is_snapshot: true,
    refresh_interval: 60,
    source: "Bojolpif Météo (Rhône)",
    country: "France",
    city: "Lyon",
    status: "operational",
    insecam_url: "https://www.bojolpif.com/",
    last_checked: new Date().toISOString()
  }
];

function runImport() {
  console.log('--- Importing verified Lyon cameras ---');

  // 1. Update data/cameras.json
  let cameras = [];
  if (fs.existsSync(DATA_FILE)) {
    cameras = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  }

  NEW_LYON_CAMERAS.forEach(newCam => {
    const existingIdx = cameras.findIndex(c => c.id === newCam.id);
    if (existingIdx >= 0) {
      cameras[existingIdx] = { ...cameras[existingIdx], ...newCam };
      console.log(`Updated existing: ${newCam.id}`);
    } else {
      cameras.push(newCam);
      console.log(`Added new: ${newCam.id} (${newCam.name})`);
    }
  });

  fs.writeFileSync(DATA_FILE, JSON.stringify(cameras, null, 2), 'utf8');
  console.log(`Saved ${cameras.length} cameras to ${DATA_FILE}`);

  // 2. Update public/seed.json
  const seedPayload = {
    total: cameras.length,
    operational: cameras.filter(c => c.status === 'operational').length,
    down: cameras.filter(c => c.status === 'down').length,
    last_updated: new Date().toISOString(),
    cameras
  };
  fs.writeFileSync(PUBLIC_SEED, JSON.stringify(seedPayload, null, 2), 'utf8');
  console.log(`Saved to ${PUBLIC_SEED}`);

  // 3. Update lib/seed.js
  const seedJsContent = `// Auto-generated seed cameras list\nconst SEED_CAMERAS = ${JSON.stringify(cameras, null, 2)};\n\nmodule.exports = { SEED_CAMERAS };\n`;
  fs.writeFileSync(SEED_FILE, seedJsContent, 'utf8');
  console.log(`Saved to ${SEED_FILE}`);

  // 4. Run export-backup.js
  console.log('Regenerating multi-format backups...');
  execSync('node ' + path.join(__dirname, 'export-backup.js'), { stdio: 'inherit' });
  console.log('--- Import completed successfully ---');
}

runImport();
