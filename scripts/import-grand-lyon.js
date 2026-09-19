// Import Grand Lyon CRITER traffic cameras
const fs = require('fs');
const path = require('path');

const GRAND_LYON_GEOJSON = {
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "id": "pvo_patrimoine_voirie.pvocameracriter.31",
      "geometry": { "type": "Point", "coordinates": [4.80811826, 45.7748934] },
      "properties": {
        "nom": "Tunnel Croix Rousse",
        "libellelong": "Pont Clemenceau",
        "identifiant": 218,
        "numeromaintenance": "CWL9018",
        "typecamera": "Web",
        "fournisseur": "CRITER",
        "observation": "Direction : Tunnel de la Croix Rousse",
        "url": "https://download.data.grandlyon.com/files/rdata/pvo_patrimoine_voirie.pvocameracriter/CWL9018.JPG",
        "gid": 31
      }
    },
    {
      "type": "Feature",
      "id": "pvo_patrimoine_voirie.pvocameracriter.32",
      "geometry": { "type": "Point", "coordinates": [4.81570358, 45.7288611] },
      "properties": {
        "nom": "M7 - Marseille",
        "libellelong": "Pont de la Mulatière",
        "identifiant": 258,
        "numeromaintenance": "CWML005",
        "typecamera": "Web",
        "fournisseur": "CRITER",
        "observation": "Direction : M7 - Marseille",
        "url": "https://download.data.grandlyon.com/files/rdata/pvo_patrimoine_voirie.pvocameracriter/CWML005.JPG",
        "gid": 32
      }
    },
    {
      "type": "Feature",
      "id": "pvo_patrimoine_voirie.pvocameracriter.33",
      "geometry": { "type": "Point", "coordinates": [4.88646296, 45.73088473] },
      "properties": {
        "nom": "Lyon Centre",
        "libellelong": "Av. Jean Mermoz / Bd Pinel",
        "identifiant": 224,
        "numeromaintenance": "CW2L8114",
        "typecamera": "Web",
        "fournisseur": "CRITER",
        "observation": "Direction : Lyon Centre",
        "url": "https://download.data.grandlyon.com/files/rdata/pvo_patrimoine_voirie.pvocameracriter/CW2L8114.JPG",
        "gid": 33
      }
    },
    {
      "type": "Feature",
      "id": "pvo_patrimoine_voirie.pvocameracriter.34",
      "geometry": { "type": "Point", "coordinates": [4.81978207, 45.75235829] },
      "properties": {
        "nom": "Lyon - Perrache",
        "libellelong": "Tunnel sous Fourvière",
        "identifiant": 219,
        "numeromaintenance": "CWL5801",
        "typecamera": "Web",
        "fournisseur": "CRITER",
        "observation": "Direction : Lyon - Perrache",
        "url": "https://download.data.grandlyon.com/files/rdata/pvo_patrimoine_voirie.pvocameracriter/CWL5801.JPG",
        "gid": 34
      }
    },
    {
      "type": "Feature",
      "id": "pvo_patrimoine_voirie.pvocameracriter.35",
      "geometry": { "type": "Point", "coordinates": [4.86040666, 45.78824631] },
      "properties": {
        "nom": "Lyon - Villeurbanne",
        "libellelong": "Pont Poincaré",
        "identifiant": 254,
        "numeromaintenance": "CW3CL005",
        "typecamera": "Web",
        "fournisseur": "CRITER",
        "observation": "Direction : Lyon - Villeurbanne",
        "url": "https://download.data.grandlyon.com/files/rdata/pvo_patrimoine_voirie.pvocameracriter/CW3CL005.JPG",
        "gid": 35
      }
    },
    {
      "type": "Feature",
      "id": "pvo_patrimoine_voirie.pvocameracriter.36",
      "geometry": { "type": "Point", "coordinates": [4.92752365, 45.72711031] },
      "properties": {
        "nom": "Eurexpo",
        "libellelong": "Boulevard des Droits de l'Homme / Avenue F.Roosevelt",
        "identifiant": 253,
        "numeromaintenance": "CWBR044",
        "typecamera": "Web",
        "fournisseur": "CRITER",
        "observation": "Direction : Eurexpo",
        "url": "https://download.data.grandlyon.com/files/rdata/pvo_patrimoine_voirie.pvocameracriter/CWBR044.JPG",
        "gid": 36
      }
    },
    {
      "type": "Feature",
      "id": "pvo_patrimoine_voirie.pvocameracriter.37",
      "geometry": { "type": "Point", "coordinates": [4.92010936, 45.72302417] },
      "properties": {
        "nom": "Porte des Alpes",
        "libellelong": "Boulevard de l'Université / Rue A.Bouloche",
        "identifiant": 255,
        "numeromaintenance": "CWBR043",
        "typecamera": "Web",
        "fournisseur": "CRITER",
        "observation": "Direction : Porte des Alpes",
        "url": "https://download.data.grandlyon.com/files/rdata/pvo_patrimoine_voirie.pvocameracriter/CWBR043.JPG",
        "gid": 37
      }
    },
    {
      "type": "Feature",
      "id": "pvo_patrimoine_voirie.pvocameracriter.38",
      "geometry": { "type": "Point", "coordinates": [4.89207215, 45.78343515] },
      "properties": {
        "nom": "Porte de La Pape",
        "libellelong": "Porte de Croix Luizet",
        "identifiant": 256,
        "numeromaintenance": "CWVL802",
        "typecamera": "Web",
        "fournisseur": "CRITER",
        "observation": "Direction : Porte de La Doua",
        "url": "https://download.data.grandlyon.com/files/rdata/pvo_patrimoine_voirie.pvocameracriter/CWVL802.JPG",
        "gid": 38
      }
    },
    {
      "type": "Feature",
      "id": "pvo_patrimoine_voirie.pvocameracriter.39",
      "geometry": { "type": "Point", "coordinates": [4.78129686, 45.76378028] },
      "properties": {
        "nom": "Porte de Valvert",
        "libellelong": "Place Vauboin (Horloge)",
        "identifiant": 257,
        "numeromaintenance": "CWTA006",
        "typecamera": "Web",
        "fournisseur": "CRITER",
        "observation": "Direction : Porte de Valvert",
        "url": "https://download.data.grandlyon.com/files/rdata/pvo_patrimoine_voirie.pvocameracriter/CWTA006.JPG",
        "gid": 39
      }
    },
    {
      "type": "Feature",
      "id": "pvo_patrimoine_voirie.pvocameracriter.40",
      "geometry": { "type": "Point", "coordinates": [4.83031718, 45.72673364] },
      "properties": {
        "nom": "Porte de Gerland",
        "libellelong": "Avenue T.Garnier / Avenue J.Jaurès",
        "identifiant": 259,
        "numeromaintenance": "CWL7033",
        "typecamera": "Web",
        "fournisseur": "CRITER",
        "observation": "Direction : Porte de Gerland",
        "url": "https://download.data.grandlyon.com/files/rdata/pvo_patrimoine_voirie.pvocameracriter/CWL7033.JPG",
        "gid": 40
      }
    },
    {
      "type": "Feature",
      "id": "pvo_patrimoine_voirie.pvocameracriter.41",
      "geometry": { "type": "Point", "coordinates": [4.80278803, 45.76352371] },
      "properties": {
        "nom": "A7 - Paris",
        "libellelong": "Tunnel sous Fourvière",
        "identifiant": 261,
        "numeromaintenance": "CWL9801",
        "typecamera": "Web",
        "fournisseur": "CRITER",
        "observation": "Direction : M6 - Paris",
        "url": "https://download.data.grandlyon.com/files/rdata/pvo_patrimoine_voirie.pvocameracriter/CWL9801.JPG",
        "gid": 41
      }
    },
    {
      "type": "Feature",
      "id": "pvo_patrimoine_voirie.pvocameracriter.42",
      "geometry": { "type": "Point", "coordinates": [4.85958053, 45.74958364] },
      "properties": {
        "nom": "Grange Blanche",
        "libellelong": "Cours A.Thomas / Bd des Tchécoslovaques",
        "identifiant": 220,
        "numeromaintenance": "CWL3005",
        "typecamera": "Web",
        "fournisseur": "CRITER",
        "observation": "Direction : Grange Blanche",
        "url": "https://download.data.grandlyon.com/files/rdata/pvo_patrimoine_voirie.pvocameracriter/CWL3005.JPG",
        "gid": 42
      }
    },
    {
      "type": "Feature",
      "id": "pvo_patrimoine_voirie.pvocameracriter.43",
      "geometry": { "type": "Point", "coordinates": [4.85873485, 45.771691] },
      "properties": {
        "nom": "Caluire",
        "libellelong": "Bd de Stalingrad / Rue W.Rousseau",
        "identifiant": 221,
        "numeromaintenance": "CWL6165",
        "typecamera": "Web",
        "fournisseur": "CRITER",
        "observation": "Direction : Caluire",
        "url": "https://download.data.grandlyon.com/files/rdata/pvo_patrimoine_voirie.pvocameracriter/CWL6165.JPG",
        "gid": 43
      }
    },
    {
      "type": "Feature",
      "id": "pvo_patrimoine_voirie.pvocameracriter.44",
      "geometry": { "type": "Point", "coordinates": [4.92956796, 45.76641254] },
      "properties": {
        "nom": "La Soie",
        "libellelong": "Av. de Bohlen / Rue R.Salengro",
        "identifiant": 222,
        "numeromaintenance": "CWVV011",
        "typecamera": "Web",
        "fournisseur": "CRITER",
        "observation": "Direction : Porte de La Soie",
        "url": "https://download.data.grandlyon.com/files/rdata/pvo_patrimoine_voirie.pvocameracriter/CWVV011.JPG",
        "gid": 44
      }
    },
    {
      "type": "Feature",
      "id": "pvo_patrimoine_voirie.pvocameracriter.45",
      "geometry": { "type": "Point", "coordinates": [4.88934031, 45.73032411] },
      "properties": {
        "nom": "A43 - Grenoble",
        "libellelong": "Av. Jean Mermoz / Bd Pinel",
        "identifiant": 223,
        "numeromaintenance": "CW1L8114",
        "typecamera": "Web",
        "fournisseur": "CRITER",
        "observation": "Direction : A43 - Grenoble",
        "url": "https://download.data.grandlyon.com/files/rdata/pvo_patrimoine_voirie.pvocameracriter/CW1L8114.JPG",
        "gid": 45
      }
    }
  ]
};

function parseGrandLyonCameras() {
  return GRAND_LYON_GEOJSON.features.map(f => {
    const props = f.properties;
    const coords = f.geometry.coordinates;
    const direction = props.observation ? ` (${props.observation.replace('Direction :', '').trim()})` : '';

    return {
      id: `lyon-criter-${props.identifiant}`,
      name: `Lyon - ${props.nom}: ${props.libellelong}${direction}`,
      latitude: coords[1],
      longitude: coords[0],
      stream_url: props.url,
      preview_image: props.url,
      is_snapshot: true,
      refresh_interval: 60,
      source: `Grand Lyon CRITER (${props.fournisseur})`,
      status: 'operational',
      last_checked: new Date().toISOString()
    };
  });
}

module.exports = {
  parseGrandLyonCameras
};

if (require.main === module) {
  const cams = parseGrandLyonCameras();
  console.log(`Parsed ${cams.length} Grand Lyon cameras. First:`, cams[0]);
}
