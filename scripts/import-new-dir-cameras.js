// Importer for:
// 1. DIR-Est (https://webcam.dir-est.fr/)
// 2. DIR Centre-Est (https://www.webcams-dir.centre-est.developpement-durable.gouv.fr/streams/last/nce.{i}.mp4)
// 3. DIR Massif Central (https://public.dir-massif-central.magsys-services.net/)

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

async function scrapeDirEst() {
  console.log('[1/3] Scraping DIR-Est (https://webcam.dir-est.fr/)...');
  const res = await fetch('https://webcam.dir-est.fr/');
  const html = await res.text();

  const startIdx = html.indexOf('var liens=');
  if (startIdx === -1) {
    throw new Error('Could not find var liens in webcam.dir-est.fr');
  }
  const endIdx = html.indexOf('</script>', startIdx);
  const scriptContent = html.substring(startIdx, endIdx);

  // Evaluate liens
  const liens = (new Function(scriptContent + '; return liens;'))();
  console.log(`[DIR-Est] Found ${liens.length} cameras in liens array.`);

  const cameras = [];

  for (const l of liens) {
    const idMatch = l.add.match(/\((\d+)\)/);
    const id = idMatch ? idMatch[1] : null;
    if (!id) continue;

    let meta = {};
    try {
      const metaRes = await fetch(`https://webcam.dir-est.fr/last/${id}`);
      if (metaRes.ok) {
        meta = await metaRes.json();
      }
    } catch (e) {}

    const clean = str => (str ? String(str).replace(/^"|"$/g, '').trim() : '');
    const nom = clean(meta.nomcam) || l.nom;
    const axe = clean(meta.axe);
    const dir = clean(meta.dir);
    const libelle = clean(meta.libelle);

    let fullName = nom;
    if (axe) fullName += ` ${axe}`;
    if (libelle && !fullName.includes(libelle)) fullName += ` - ${libelle}`;
    else if (dir && !fullName.includes(dir)) fullName += ` (${dir})`;

    cameras.push({
      id: `direst-${id}`,
      name: fullName,
      latitude: parseFloat(l.y),
      longitude: parseFloat(l.x),
      stream_url: `https://webcam.dir-est.fr/lastimg/${id}`,
      preview_image: `https://webcam.dir-est.fr/lastimg/${id}`,
      source: 'DIR Est (Webcam Route)',
      country: 'France',
      city: nom,
      is_snapshot: true,
      status: l.etat === 1 ? 'operational' : 'down',
      insecam_url: 'https://webcam.dir-est.fr/',
      last_checked: new Date().toISOString()
    });
  }

  console.log(`[DIR-Est] Successfully processed ${cameras.length} cameras.`);
  return cameras;
}

async function scrapeDirCentreEst() {
  console.log('[2/3] Checking DIR Centre-Est (https://www.webcams-dir.centre-est.developpement-durable.gouv.fr/)...');
  const res = await fetch('https://www.webcams-dir.centre-est.developpement-durable.gouv.fr/');
  const html = await res.text();

  const m = html.match(/var donneesCamera = (\[.*?\]);/s);
  if (!m) {
    throw new Error('Could not find donneesCamera on DIR Centre-Est');
  }

  const rawCams = (new Function('return ' + m[1]))();
  console.log(`[DIR Centre-Est] Found ${rawCams.length} official active cameras in donneesCamera.`);

  const SECTORS_MAP = {
    2: 'Lyon – Saint-Étienne',
    3: 'N7 Vallée du Rhône',
    4: 'Roanne – Lyon',
    5: 'Moulins - Mâcon / Dijon',
    6: 'Grenoble - Chambéry - Tarentaise',
    7: 'Auxerre – Nevers'
  };

  const cameras = rawCams.map(c => {
    const sectorName = SECTORS_MAP[c.secteur] || 'Auvergne-Rhône-Alpes';
    const desc = c.description || `DIRCE Cam ${c.id}`;
    const direction = c.direction ? ` (${c.direction})` : '';
    const cityName = desc.split(' ')[0] || 'Auvergne-Rhône-Alpes';

    return {
      id: `dirce-${c.id}`,
      name: `${desc}${direction}`,
      latitude: parseFloat(c.latitude),
      longitude: parseFloat(c.longitude),
      stream_url: `https://www.webcams-dir.centre-est.developpement-durable.gouv.fr/streams/last/nce.${c.id}.mp4`,
      preview_image: `https://www.webcams-dir.centre-est.developpement-durable.gouv.fr/streams/last/nce.${c.id}.thumbnail.jpg`,
      source: `DIR Centre-Est (${sectorName})`,
      country: 'France',
      city: cityName,
      is_snapshot: false,
      status: 'operational',
      insecam_url: 'https://www.webcams-dir.centre-est.developpement-durable.gouv.fr/',
      last_checked: new Date().toISOString()
    };
  });

  return cameras;
}

async function scrapeDirMassifCentral() {
  console.log('[3/3] Scraping DIR Massif Central (https://public.dir-massif-central.magsys-services.net/)...');
  // Use curl because nginx returns ': text/html: ' header token which triggers node HPE_INVALID_HEADER_TOKEN
  const html = execSync('curl -sL https://public.dir-massif-central.magsys-services.net/', { maxBuffer: 10 * 1024 * 1024 }).toString('utf-8');

  // Extract markers from buildMap
  const start = html.indexOf('function buildMap');
  const end = html.indexOf('</script>', start);
  const code = html.substring(start, end);

  const markerRegex = /latitude\s*=\s*'([^']+)'\s*;\s*longitude\s*=\s*'([^']+)'\s*;\s*titre\s*=\s*'([^']+)'\s*;(?:[\s\S]*?)id\s*=\s*'map-cam-(\d+)'/g;
  let m;
  const markers = [];
  while ((m = markerRegex.exec(code)) !== null) {
    markers.push({
      id: m[4],
      lat: parseFloat(m[1]),
      lon: parseFloat(m[2]),
      title: m[3]
    });
  }
  console.log(`[DIR Massif Central] Extracted ${markers.length} markers.`);

  // Extract stream URLs from cam_previous or img tags
  const streamMap = new Map();
  const prevRegex = /cam-image-(\d+)[^;]*cam_previous\s*=\s*['\"]([^'\"]+)['\"]/g;
  let pm;
  while ((pm = prevRegex.exec(html)) !== null) {
    let url = pm[2];
    if (url.startsWith('/')) url = 'https://public.dir-massif-central.magsys-services.net' + url;
    else if (url.startsWith('stream/')) url = 'https://public.dir-massif-central.magsys-services.net/' + url;
    streamMap.set(pm[1], url);
  }

  // Also check for road description and unavailable status in cam boxes
  const camMeta = new Map();
  const boxParts = html.split('<div id="cam-');
  for (let i = 1; i < boxParts.length; i++) {
    const part = boxParts[i];
    const idEnd = part.indexOf('"');
    if (idEnd === -1) continue;
    const id = part.substring(0, idEnd);
    const roadM = part.match(/<div class="cam-road">(.*?)<\/div>/);
    const isDown = part.includes('indisponible') || part.includes('Caméra indisponible');
    camMeta.set(id, {
      road: roadM ? roadM[1].trim() : '',
      isDown
    });
  }

  const cameras = markers.map(mk => {
    const meta = camMeta.get(mk.id) || {};
    const stream = streamMap.get(mk.id);
    const isVideo = stream && stream.endsWith('.mp4');
    const isSnapshot = !isVideo;
    const isDown = meta.isDown || !stream;

    let fullName = mk.title;
    if (meta.road && !fullName.includes(meta.road)) {
      fullName += ` (${meta.road})`;
    }

    // Determine city / region based on name
    let city = 'Massif Central';
    if (mk.title.includes('Lioran') || mk.title.includes('Aurillac') || mk.title.includes('Polminhac')) city = 'Cantal (15)';
    else if (mk.title.includes('Fix') || mk.title.includes('Pertuis') || mk.title.includes('Yssingeaux') || mk.title.includes('Peyrebeille')) city = 'Haute-Loire (43)';
    else if (mk.title.includes('Auberoques') || mk.title.includes('Engayresque') || mk.title.includes('Montalies') || mk.title.includes('Bel-air')) city = 'Aveyron (12)';
    else if (mk.title.includes('CAYLAR') || mk.title.includes('Cazouls') || mk.title.includes('Juvignac')) city = 'Hérault (34)';
    else if (mk.title.includes('Montmirat') || mk.title.includes('Jalcreste') || mk.title.includes('La Garde') || mk.title.includes('Issartets') || mk.title.includes('Fagette')) city = 'Lozère (48)';
    else if (mk.title.includes('Coudes') || mk.title.includes('Fageole') || mk.title.includes('Chantier') || mk.title.includes('Coren') || mk.title.includes('PMVPR11')) city = 'Puy-de-Dôme / Cantal';

    return {
      id: `dirmc-${mk.id}`,
      name: fullName,
      latitude: mk.lat,
      longitude: mk.lon,
      stream_url: stream || `https://public.dir-massif-central.magsys-services.net/#cam-${mk.id}`,
      preview_image: (stream && stream.endsWith('.jpg')) ? stream : null,
      source: 'DIR Massif Central (M-CAM)',
      country: 'France',
      city: city,
      is_snapshot: isSnapshot,
      status: isDown ? 'down' : 'operational',
      insecam_url: `https://public.dir-massif-central.magsys-services.net/#cam-${mk.id}`,
      last_checked: new Date().toISOString()
    };
  });

  console.log(`[DIR Massif Central] Successfully processed ${cameras.length} cameras.`);
  return cameras;
}

async function run() {
  const [dirEstCams, dirCeCams, dirMcCams] = await Promise.all([
    scrapeDirEst(),
    scrapeDirCentreEst(),
    scrapeDirMassifCentral()
  ]);

  console.log('\n--- Summary of Scraped Networks ---');
  console.log('DIR-Est cameras:', dirEstCams.length);
  console.log('DIR Centre-Est cameras:', dirCeCams.length);
  console.log('DIR Massif Central cameras:', dirMcCams.length);

  // Load existing seed
  const seedPath = path.resolve(__dirname, '../public/seed.json');
  const rootSeedPath = path.resolve(__dirname, '../seed.json');
  const seedData = JSON.parse(fs.readFileSync(seedPath, 'utf-8'));
  const initialCount = seedData.cameras.length;

  // Build camera map by id
  const camMap = new Map();
  seedData.cameras.forEach(c => camMap.set(c.id, c));

  // Add / Update DIR-Est
  let addedEst = 0;
  dirEstCams.forEach(c => {
    if (!camMap.has(c.id)) addedEst++;
    camMap.set(c.id, c);
  });

  // Add / Update DIR Centre-Est
  let addedCe = 0;
  dirCeCams.forEach(c => {
    if (!camMap.has(c.id)) addedCe++;
    camMap.set(c.id, {
      ...(camMap.get(c.id) || {}),
      ...c
    });
  });

  // Add / Update DIR Massif Central
  let addedMc = 0;
  dirMcCams.forEach(c => {
    if (!camMap.has(c.id)) addedMc++;
    camMap.set(c.id, c);
  });

  const finalCameras = Array.from(camMap.values());
  seedData.cameras = finalCameras;
  seedData.total = finalCameras.length;
  seedData.operational = finalCameras.filter(c => c.status === 'operational').length;
  seedData.down = finalCameras.filter(c => c.status === 'down').length;

  console.log(`\nInitial cameras count: ${initialCount}`);
  console.log(`Added DIR-Est: +${addedEst}`);
  console.log(`Added DIR Centre-Est: +${addedCe}`);
  console.log(`Added DIR Massif Central: +${addedMc}`);
  console.log(`Total cameras in database now: ${finalCameras.length}`);
  console.log(`Operational: ${seedData.operational}, Down: ${seedData.down}`);

  fs.writeFileSync(seedPath, JSON.stringify(seedData, null, 2), 'utf-8');
  fs.writeFileSync(rootSeedPath, JSON.stringify(seedData, null, 2), 'utf-8');
  console.log(`Successfully updated ${seedPath} and ${rootSeedPath}!`);
}

run().catch(err => {
  console.error('Fatal error during scrape/import:', err);
  process.exit(1);
});
