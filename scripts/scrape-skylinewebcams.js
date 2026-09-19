// Scraper for SkylineWebcams Auvergne-Rhône-Alpes feeds
// Source: https://www.skylinewebcams.com/fr/webcam/france/auvergne-rhone-alpes.html

const SKYLINE_COORDS = {
  'lac-du-bourget': { lat: 45.6985, lon: 5.8885, name: 'Aix-les-Bains - Lac du Bourget (Grand Port)' },
  'vallorcine-mont-blanc': { lat: 46.0336, lon: 6.9328, name: 'Vallorcine - Mont Blanc (Refuge de Loriaz)' },
  'lac-du-bourget-france': { lat: 45.6885, lon: 5.9125, name: 'Aix-les-Bains - Lac du Bourget Panoramique' },
  'les-aravis-mont-blanc': { lat: 46.0911, lon: 6.2197, name: 'Arbusigny - Chaîne des Aravis & Mont Blanc' },
  'domaine-skiable-des-contamines-montjoie': { lat: 45.7511, lon: 6.5847, name: 'Hauteluce - Domaine des Contamines Montjoie' },
  'lac-d-annecy-france': { lat: 45.7869, lon: 6.2203, name: 'Doussard - Lac d\'Annecy & Col de la Forclaz' },
  'la-chapelle-dabondance': { lat: 46.2953, lon: 6.7878, name: 'La Chapelle-d\'Abondance Panoramique' },
  'villard-de-lans': { lat: 45.0711, lon: 5.5517, name: 'Villard-de-Lans - Massif du Vercors' },
  'porte-de-saint-clair': { lat: 45.7875, lon: 4.8569, name: 'Lyon - Surveillance Trafic Porte de Saint-Clair' },
  'mont-cindre': { lat: 45.8197, lon: 4.8294, name: 'Lyon - Vue panoramique depuis le Mont Cindre' },
  'les-arcs-snowpark': { lat: 45.5722, lon: 6.8297, name: 'Bourg-Saint-Maurice - Les Arcs Snowpark' },
  'les-arcs-varet': { lat: 45.5564, lon: 6.8361, name: 'Bourg-Saint-Maurice - Pistes des Arcs Varet' },
  'les-arcs': { lat: 45.5700, lon: 6.8150, name: 'Bourg-Saint-Maurice - Pistes de ski des Arcs' },
  'colorado': { lat: 45.5064, lon: 6.6744, name: 'La Plagne - Domaine skiable Colorado' },
  'super-besse': { lat: 45.5117, lon: 2.8539, name: 'Super-Besse - Station du Massif du Sancy' }
};

// Known YouTube live stream IDs extracted from the respective Skyline pages
const KNOWN_YOUTUBE_IDS = {
  'porte-de-saint-clair': 'EBhCrTPpdBI',
  'mont-cindre': 's-J0yE5Tpu4',
  'villard-de-lans': 'olfe6GhsrIk',
  'la-chapelle-dabondance': 'X1o1sxtWi1M',
  'super-besse': 'XWmQtBOaSXQ',
  'les-arcs-varet': 'BuB981VNriE',
  'colorado': 'l9Z4fFK43AM',
  'les-arcs': 'SXXHa5SoAHo',
  'les-arcs-snowpark': 'B0vZX9GnpxI'
};

async function scrapeSkylineWebcams() {
  console.log('[Skyline Scraper] Fetching Auvergne-Rhône-Alpes webcams listing...');
  const res = await fetch('https://www.skylinewebcams.com/fr/webcam/france/auvergne-rhone-alpes.html', {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    }
  });

  const html = await res.text();
  const regex = /<a href="([^"]*?\.html)"[^>]*?class="col-xs-12[^"]*?"><div class="cam-light"><img src="([^"]*?live(\d+)\.jpg)"[^>]*?alt="([^"]*?)"/gis;

  const cameras = [];
  let m;

  while ((m = regex.exec(html)) !== null) {
    let pageUrl = m[1];
    if (!pageUrl.startsWith('http')) {
      pageUrl = `https://www.skylinewebcams.com/${pageUrl.replace(/^\//, '')}`;
    }
    const thumbUrl = m[2];
    const camNum = m[3];
    const alt = m[4].trim();

    const slug = pageUrl.split('/').pop().replace('.html', '');
    const meta = SKYLINE_COORDS[slug] || {
      lat: 45.75,
      lon: 5.80,
      name: alt
    };

    const youtubeId = KNOWN_YOUTUBE_IDS[slug] || null;

    cameras.push({
      id: `skyline-${camNum}`,
      name: meta.name || alt,
      latitude: meta.lat,
      longitude: meta.lon,
      stream_url: youtubeId ? `https://www.youtube.com/watch?v=s${youtubeId}`.replace('/watch?vs', '/watch?v=') : pageUrl,
      youtube_id: youtubeId,
      preview_image: thumbUrl,
      source: 'SkylineWebcams (Auvergne-Rhône-Alpes)',
      status: 'operational',
      last_checked: new Date().toISOString()
    });
  }

  console.log(`[Skyline Scraper] Successfully extracted ${cameras.length} live cameras (${cameras.filter(c => c.youtube_id).length} YouTube streams).`);
  return cameras;
}

module.exports = {
  scrapeSkylineWebcams,
  KNOWN_YOUTUBE_IDS
};

if (require.main === module) {
  scrapeSkylineWebcams().then(cams => {
    console.log(`Extracted ${cams.length} cams. Sample:`, cams[0]);
  });
}
