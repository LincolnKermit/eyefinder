// Scraper for DIR Centre-Est public traffic webcams
// Source: https://www.webcams-dir.centre-est.developpement-durable.gouv.fr/mobile/

const fs = require('fs');
const path = require('path');

const SECTORS = [
  { id: 2, name: 'Lyon – Saint-Étienne' },
  { id: 3, name: 'N7 Vallée du Rhône' },
  { id: 4, name: 'Roanne – Lyon' },
  { id: 5, name: 'Moulins - Mâcon / Dijon' },
  { id: 6, name: 'Grenoble - Chambéry - Tarentaise' },
  { id: 7, name: 'Auxerre – Nevers' }
];

async function scrapeDirCentreEst() {
  console.log('[DIRCE Scraper] Fetching camera coordinates from carte.php...');
  const mapRes = await fetch('https://www.webcams-dir.centre-est.developpement-durable.gouv.fr/mobile/carte.php?secteur=2');
  const mapHtml = await mapRes.text();
  const match = mapHtml.match(/var donneesCamera = (\[.*?\]);/s);

  if (!match) {
    throw new Error('Could not find donneesCamera in carte.php');
  }

  const rawCoords = Function('return ' + match[1])();
  const coordsMap = {};
  rawCoords.forEach(c => { coordsMap[c.id] = c; });

  console.log(`[DIRCE Scraper] Found ${rawCoords.length} camera coordinates.`);

  const cameraDetails = {};

  for (const s of SECTORS) {
    console.log(`[DIRCE Scraper] Scraping sector ${s.id} (${s.name})...`);
    try {
      const res = await fetch(`https://www.webcams-dir.centre-est.developpement-durable.gouv.fr/mobile/index.php?secteur=${s.id}`);
      const html = await res.text();
      const regex = /<div class="webcam" id="(\d+)">.*?<div class="nom">(.*?)<\/div>.*?<div class="description">(.*?)<\/div>/gs;
      let m;
      while ((m = regex.exec(html)) !== null) {
        const id = parseInt(m[1]);
        const nom = m[2].trim();
        const desc = m[3].trim();
        cameraDetails[id] = {
          name: nom + (desc ? ` (${desc})` : ''),
          sector: s.name
        };
      }
    } catch (err) {
      console.warn(`[DIRCE Scraper] Failed fetching sector ${s.id}:`, err.message);
    }
  }

  const cameras = [];
  for (const id in coordsMap) {
    const c = coordsMap[id];
    const details = cameraDetails[id] || { name: `DIRCE Webcam ${id}`, sector: 'DIR Centre-Est' };
    cameras.push({
      id: `dirce-${id}`,
      name: details.name,
      latitude: parseFloat(c.latitude),
      longitude: parseFloat(c.longitude),
      stream_url: `https://www.webcams-dir.centre-est.developpement-durable.gouv.fr/streams/last/nce.${id}.mp4`,
      source: `DIR Centre-Est (${details.sector})`,
      status: 'operational',
      last_checked: new Date().toISOString()
    });
  }

  console.log(`[DIRCE Scraper] Successfully extracted ${cameras.length} live cameras.`);
  return cameras;
}

module.exports = {
  scrapeDirCentreEst
};

if (require.main === module) {
  scrapeDirCentreEst().then(cams => {
    console.log('Sample scraped camera:', cams[0]);
  });
}
