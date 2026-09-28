# EyeFinder - Sauvegardes & Guide de Restauration Cartographique

Ce dossier contient une sauvegarde intégrale et autonome des **249 caméras** référencées par EyeFinder (219 flux actifs en direct).

Ces fichiers permettent de visualiser, importer et restaurer instantanément la cartographie complète même en cas de panne totale du serveur, de l'hébergeur Vercel ou de la base de données.

---

## 📁 Fichiers Disponibles

| Fichier | Format | Cas d'usage principal |
| :--- | :--- | :--- |
| **[`standalone_map.html`](./standalone_map.html)** | Application HTML autonome | **Solution d'urgence 0-serveur** : double-cliquez pour ouvrir dans n'importe quel navigateur (Chrome, Firefox, Safari). Tout est embarqué. |
| **[`cameras.geojson`](./cameras.geojson)** | GeoJSON standard OGC | Import 1-clic sur [geojson.io](https://geojson.io), [uMap OpenStreetMap](https://umap.openstreetmap.fr), QGIS, Leaflet, Mapbox Studio, Felt. |
| **[`cameras.kml`](./cameras.kml)** | Google Earth / KML 2.2 | Import direct sur [Google My Maps](https://mymaps.google.com), Google Earth Pro, OsmAnd, MAPS.ME. |
| **[`cameras.csv`](./cameras.csv)** | Tableur CSV UTF-8 | Importation dans Google My Maps, Microsoft Excel, LibreOffice Calc, QGIS. |
| **[`cameras.json`](./cameras.json)** | JSON structuré | Restauration complète dans l'application EyeFinder ou réinjection en base de données. |

---

## 🚀 Comment afficher les caméras sur une carte si le site est DOWN ?

### Option 1 : La Carte Autonome d'Urgence (Recommandé - 0 installation)
1. Ouvrez simplement le fichier **`standalone_map.html`** dans votre navigateur (double-clic ou glisser-déposer dans Chrome/Firefox).
2. La carte s'affiche instantanément avec les **249 caméras** géolocalisées, la recherche textuelle, les filtres par réseau (DIR-Est, DIR Centre-Est, DIR Massif Central, Grand Lyon, Insecam...) et les lecteurs vidéo/images dans les popups.
3. Aucune dépendance backend : fonctionne hors-ligne ou via internet direct.

### Option 2 : Sur Google My Maps (Créer une carte personnelle Google)
1. Rendez-vous sur [Google My Maps](https://mymaps.google.com/).
2. Cliquez sur **"+ CRÉER UNE NOUVELLE CARTE"**.
3. Dans le premier calque, cliquez sur **"Importer"**.
4. Glissez-déposez le fichier **`cameras.csv`** (ou **`cameras.kml`**).
5. Si vous utilisez le CSV :
   - Choisissez les colonnes `latitude` et `longitude` pour l'emplacement.
   - Choisissez la colonne `name` pour le titre des repères.
6. Toutes les caméras apparaissent sur votre Google Maps personnel avec les liens vers les flux !

### Option 3 : Sur uMap (OpenStreetMap France)
1. Rendez-vous sur [uMap France](https://umap.openstreetmap.fr/).
2. Cliquez sur **"Créer une carte"**.
3. Cliquez sur l'icône **Importer des données** (flèche montante à droite).
4. Choisissez le fichier **`cameras.geojson`** (format GeoJSON détecté automatiquement).
5. Cliquez sur **"Importer"** : toutes les caméras sont positionnées avec leurs descriptions et flux.

### Option 4 : Sur geojson.io (Visualisation instantanée dans le navigateur)
1. Ouvrez [geojson.io](https://geojson.io/).
2. Glissez-déposez directement le fichier **`cameras.geojson`** sur la fenêtre.
3. Toutes les caméras sont immédiatement projetées sur la carte avec leur table attributaire.

### Option 5 : Sur Google Earth
1. Ouvrez Google Earth (application Web ou Google Earth Pro sur PC/Mac).
2. Cliquez sur **Fichier > Ouvrir** et sélectionnez **`cameras.kml`**.
3. Les caméras s'affichent avec des pastilles vertes (en ligne) ou rouges (hors-ligne).

---

## 🔄 Comment restaurer les données dans EyeFinder ?

Si vous réinstallez EyeFinder sur un nouveau serveur :
1. Remplacez le fichier `data/cameras.json` par ce fichier `cameras.json` :
   ```bash
   cp backups/cameras.json data/cameras.json
   cp backups/cameras.json seed.json
   cp backups/cameras.json public/seed.json
   ```
2. Ou via l'interface d'administration : rendez-vous sur `/admin.html`, section **"Importer des caméras"** et téléversez le fichier `cameras.json`.

---

## 🛠️ Regénérer les sauvegardes

Pour mettre à jour tous les formats de sauvegarde après l'ajout de nouvelles caméras :
```bash
npm run backup
# ou
node scripts/export-backup.js
```

*Dernière exportation : 2026-09-28T18:56:23.939Z*
