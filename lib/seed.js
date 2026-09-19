// Seed dataset of verified public CCTV & city flux streams
const SEED_CAMERAS = [
  {
    "id": "skyline-4276",
    "name": "Aix-les-Bains - Lac du Bourget (Grand Port)",
    "latitude": 45.6985,
    "longitude": 5.8885,
    "stream_url": "https://www.skylinewebcams.com/fr/webcam/france/auvergne-rhone-alpes/aix-les-bains/lac-du-bourget.html",
    "youtube_id": null,
    "preview_image": "https://cdn.skylinewebcams.com/live4276.jpg",
    "source": "SkylineWebcams (Auvergne-Rhône-Alpes)",
    "status": "operational",
    "last_checked": "2026-09-19T22:32:02.982Z"
  },
  {
    "id": "skyline-5366",
    "name": "Vallorcine - Mont Blanc (Refuge de Loriaz)",
    "latitude": 46.0336,
    "longitude": 6.9328,
    "stream_url": "https://www.skylinewebcams.com/fr/webcam/france/auvergne-rhone-alpes/vallorcine/vallorcine-mont-blanc.html",
    "youtube_id": null,
    "preview_image": "https://cdn.skylinewebcams.com/live5366.jpg",
    "source": "SkylineWebcams (Auvergne-Rhône-Alpes)",
    "status": "operational",
    "last_checked": "2026-09-19T22:32:02.983Z"
  },
  {
    "id": "skyline-5755",
    "name": "Aix-les-Bains - Lac du Bourget Panoramique",
    "latitude": 45.6885,
    "longitude": 5.9125,
    "stream_url": "https://www.skylinewebcams.com/fr/webcam/france/auvergne-rhone-alpes/aix-les-bains/lac-du-bourget-france.html",
    "youtube_id": null,
    "preview_image": "https://cdn.skylinewebcams.com/live5755.jpg",
    "source": "SkylineWebcams (Auvergne-Rhône-Alpes)",
    "status": "operational",
    "last_checked": "2026-09-19T22:32:02.983Z"
  },
  {
    "id": "skyline-5627",
    "name": "Arbusigny - Chaîne des Aravis & Mont Blanc",
    "latitude": 46.0911,
    "longitude": 6.2197,
    "stream_url": "https://www.skylinewebcams.com/fr/webcam/france/auvergne-rhone-alpes/arbusigny/les-aravis-mont-blanc.html",
    "youtube_id": null,
    "preview_image": "https://cdn.skylinewebcams.com/live5627.jpg",
    "source": "SkylineWebcams (Auvergne-Rhône-Alpes)",
    "status": "operational",
    "last_checked": "2026-09-19T22:32:02.983Z"
  },
  {
    "id": "skyline-5671",
    "name": "Hauteluce - Domaine des Contamines Montjoie",
    "latitude": 45.7511,
    "longitude": 6.5847,
    "stream_url": "https://www.skylinewebcams.com/fr/webcam/france/auvergne-rhone-alpes/hauteluce/domaine-skiable-des-contamines-montjoie.html",
    "youtube_id": null,
    "preview_image": "https://cdn.skylinewebcams.com/live5671.jpg",
    "source": "SkylineWebcams (Auvergne-Rhône-Alpes)",
    "status": "operational",
    "last_checked": "2026-09-19T22:32:02.983Z"
  },
  {
    "id": "skyline-4666",
    "name": "Doussard - Lac d'Annecy & Col de la Forclaz",
    "latitude": 45.7869,
    "longitude": 6.2203,
    "stream_url": "https://www.skylinewebcams.com/fr/webcam/france/auvergne-rhone-alpes/doussard/lac-d-annecy-france.html",
    "youtube_id": null,
    "preview_image": "https://cdn.skylinewebcams.com/live4666.jpg",
    "source": "SkylineWebcams (Auvergne-Rhône-Alpes)",
    "status": "operational",
    "last_checked": "2026-09-19T22:32:02.983Z"
  },
  {
    "id": "skyline-6195",
    "name": "Lyon - Vue panoramique depuis le Mont Cindre",
    "latitude": 45.8197,
    "longitude": 4.8294,
    "stream_url": "https://www.youtube.com/watch?v=s-J0yE5Tpu4",
    "youtube_id": "s-J0yE5Tpu4",
    "preview_image": "https://cdn.skylinewebcams.com/live6195.jpg",
    "source": "SkylineWebcams (Auvergne-Rhône-Alpes)",
    "status": "operational",
    "last_checked": "2026-09-19T22:32:02.983Z"
  },
  {
    "id": "skyline-6185",
    "name": "Lyon - Surveillance Trafic Porte de Saint-Clair",
    "latitude": 45.7875,
    "longitude": 4.8569,
    "stream_url": "https://www.youtube.com/watch?v=EBhCrTPpdBI",
    "youtube_id": "EBhCrTPpdBI",
    "preview_image": "https://cdn.skylinewebcams.com/live6185.jpg",
    "source": "SkylineWebcams (Auvergne-Rhône-Alpes)",
    "status": "operational",
    "last_checked": "2026-09-19T22:32:02.983Z"
  },
  {
    "id": "skyline-3771",
    "name": "Villard-de-Lans - Massif du Vercors",
    "latitude": 45.0711,
    "longitude": 5.5517,
    "stream_url": "https://www.youtube.com/watch?v=olfe6GhsrIk",
    "youtube_id": "olfe6GhsrIk",
    "preview_image": "https://cdn.skylinewebcams.com/live3771.jpg",
    "source": "SkylineWebcams (Auvergne-Rhône-Alpes)",
    "status": "operational",
    "last_checked": "2026-09-19T22:32:02.983Z"
  },
  {
    "id": "skyline-6199",
    "name": "La Chapelle-d'Abondance Panoramique",
    "latitude": 46.2953,
    "longitude": 6.7878,
    "stream_url": "https://www.youtube.com/watch?v=X1o1sxtWi1M",
    "youtube_id": "X1o1sxtWi1M",
    "preview_image": "https://cdn.skylinewebcams.com/live6199.jpg",
    "source": "SkylineWebcams (Auvergne-Rhône-Alpes)",
    "status": "operational",
    "last_checked": "2026-09-19T22:32:02.983Z"
  },
  {
    "id": "skyline-2427",
    "name": "Super-Besse - Station du Massif du Sancy",
    "latitude": 45.5117,
    "longitude": 2.8539,
    "stream_url": "https://www.youtube.com/watch?v=XWmQtBOaSXQ",
    "youtube_id": "XWmQtBOaSXQ",
    "preview_image": "https://cdn.skylinewebcams.com/live2427.jpg",
    "source": "SkylineWebcams (Auvergne-Rhône-Alpes)",
    "status": "operational",
    "last_checked": "2026-09-19T22:32:02.983Z"
  },
  {
    "id": "skyline-3761",
    "name": "Bourg-Saint-Maurice - Pistes des Arcs Varet",
    "latitude": 45.5564,
    "longitude": 6.8361,
    "stream_url": "https://www.youtube.com/watch?v=BuB981VNriE",
    "youtube_id": "BuB981VNriE",
    "preview_image": "https://cdn.skylinewebcams.com/live3761.jpg",
    "source": "SkylineWebcams (Auvergne-Rhône-Alpes)",
    "status": "operational",
    "last_checked": "2026-09-19T22:32:02.983Z"
  },
  {
    "id": "skyline-3499",
    "name": "La Plagne - Domaine skiable Colorado",
    "latitude": 45.5064,
    "longitude": 6.6744,
    "stream_url": "https://www.youtube.com/watch?v=l9Z4fFK43AM",
    "youtube_id": "l9Z4fFK43AM",
    "preview_image": "https://cdn.skylinewebcams.com/live3499.jpg",
    "source": "SkylineWebcams (Auvergne-Rhône-Alpes)",
    "status": "operational",
    "last_checked": "2026-09-19T22:32:02.983Z"
  },
  {
    "id": "skyline-3638",
    "name": "Bourg-Saint-Maurice - Pistes de ski des Arcs",
    "latitude": 45.57,
    "longitude": 6.815,
    "stream_url": "https://www.youtube.com/watch?v=SXXHa5SoAHo",
    "youtube_id": "SXXHa5SoAHo",
    "preview_image": "https://cdn.skylinewebcams.com/live3638.jpg",
    "source": "SkylineWebcams (Auvergne-Rhône-Alpes)",
    "status": "operational",
    "last_checked": "2026-09-19T22:32:02.983Z"
  },
  {
    "id": "skyline-3762",
    "name": "Bourg-Saint-Maurice - Les Arcs Snowpark",
    "latitude": 45.5722,
    "longitude": 6.8297,
    "stream_url": "https://www.youtube.com/watch?v=B0vZX9GnpxI",
    "youtube_id": "B0vZX9GnpxI",
    "preview_image": "https://cdn.skylinewebcams.com/live3762.jpg",
    "source": "SkylineWebcams (Auvergne-Rhône-Alpes)",
    "status": "operational",
    "last_checked": "2026-09-19T22:32:02.983Z"
  },
  {
    "id": "dirce-4",
    "name": "Pouilly-s/-Loire A77 PR117+280 (vers Moulins)",
    "latitude": 47.2979,
    "longitude": 2.95234,
    "stream_url": "https://www.webcams-dir.centre-est.developpement-durable.gouv.fr/streams/last/nce.4.mp4",
    "source": "DIR Centre-Est (Auxerre – Nevers)",
    "status": "operational",
    "last_checked": "2026-09-19T22:19:47.759Z"
  },
  {
    "id": "dirce-5",
    "name": "Givors A47 PR3+840 (vers Lyon)",
    "latitude": 45.5854,
    "longitude": 4.7511,
    "stream_url": "https://www.webcams-dir.centre-est.developpement-durable.gouv.fr/streams/last/nce.5.mp4",
    "source": "DIR Centre-Est (Lyon – Saint-Étienne)",
    "status": "operational",
    "last_checked": "2026-09-19T22:19:47.760Z"
  },
  {
    "id": "dirce-7",
    "name": "Auxerre N6 PR83+500 (vers Troyes)",
    "latitude": 47.8194,
    "longitude": 3.57128,
    "stream_url": "https://www.webcams-dir.centre-est.developpement-durable.gouv.fr/streams/last/nce.7.mp4",
    "source": "DIR Centre-Est (Auxerre – Nevers)",
    "status": "operational",
    "last_checked": "2026-09-19T22:19:47.760Z"
  },
  {
    "id": "dirce-8",
    "name": "Nœud des îles N346 PR26+48 (vers Marseille)",
    "latitude": 45.8034,
    "longitude": 4.92638,
    "stream_url": "https://www.webcams-dir.centre-est.developpement-durable.gouv.fr/streams/last/nce.8.mp4",
    "source": "DIR Centre-Est (Lyon – Saint-Étienne)",
    "status": "operational",
    "last_checked": "2026-09-19T22:19:47.760Z"
  },
  {
    "id": "dirce-9",
    "name": "Les Littes A72 PR2+170 (vers Roanne)",
    "latitude": 45.4505,
    "longitude": 4.4201,
    "stream_url": "https://www.webcams-dir.centre-est.developpement-durable.gouv.fr/streams/last/nce.9.mp4",
    "source": "DIR Centre-Est (Lyon – Saint-Étienne)",
    "status": "operational",
    "last_checked": "2026-09-19T22:19:47.760Z"
  },
  {
    "id": "dirce-13",
    "name": "Terrenoire N88 PR33+560 (vers Saint-Étienne)",
    "latitude": 45.4397,
    "longitude": 4.45516,
    "stream_url": "https://www.webcams-dir.centre-est.developpement-durable.gouv.fr/streams/last/nce.13.mp4",
    "source": "DIR Centre-Est (Lyon – Saint-Étienne)",
    "status": "operational",
    "last_checked": "2026-09-19T22:19:47.760Z"
  },
  {
    "id": "dirce-15",
    "name": "La Léchère N90 PR44+53 (vers Moûtiers)",
    "latitude": 45.5205,
    "longitude": 6.48541,
    "stream_url": "https://www.webcams-dir.centre-est.developpement-durable.gouv.fr/streams/last/nce.15.mp4",
    "source": "DIR Centre-Est (Grenoble - Chambéry - Tarentaise)",
    "status": "operational",
    "last_checked": "2026-09-19T22:19:47.760Z"
  },
  {
    "id": "dirce-16",
    "name": "Manissieux N346 PR40+226 (vers Marseille)",
    "latitude": 45.7103,
    "longitude": 4.96788,
    "stream_url": "https://www.webcams-dir.centre-est.developpement-durable.gouv.fr/streams/last/nce.16.mp4",
    "source": "DIR Centre-Est (Lyon – Saint-Étienne)",
    "status": "operational",
    "last_checked": "2026-09-19T22:19:47.760Z"
  },
  {
    "id": "dirce-17",
    "name": "Valence N7 PR44+857 (vers Lyon)",
    "latitude": 44.932,
    "longitude": 4.94488,
    "stream_url": "https://www.webcams-dir.centre-est.developpement-durable.gouv.fr/streams/last/nce.17.mp4",
    "source": "DIR Centre-Est (N7 Vallée du Rhône)",
    "status": "operational",
    "last_checked": "2026-09-19T22:19:47.760Z"
  },
  {
    "id": "dirce-19",
    "name": "Ternay A7 PR19+790 (vers Lyon)",
    "latitude": 45.5903,
    "longitude": 4.7973,
    "stream_url": "https://www.webcams-dir.centre-est.developpement-durable.gouv.fr/streams/last/nce.19.mp4",
    "source": "DIR Centre-Est (Lyon – Saint-Étienne)",
    "status": "operational",
    "last_checked": "2026-09-19T22:19:47.760Z"
  },
  {
    "id": "dirce-20",
    "name": "Feyzin A7 PR8+778 (vers D301 Boulevard Urbain Sud)",
    "latitude": 45.68,
    "longitude": 4.84886,
    "stream_url": "https://www.webcams-dir.centre-est.developpement-durable.gouv.fr/streams/last/nce.20.mp4",
    "source": "DIR Centre-Est (Lyon – Saint-Étienne)",
    "status": "operational",
    "last_checked": "2026-09-19T22:19:47.760Z"
  },
  {
    "id": "dirce-24",
    "name": "Chambon N88 PR45+827 (vers Lyon)",
    "latitude": 45.3941,
    "longitude": 4.32776,
    "stream_url": "https://www.webcams-dir.centre-est.developpement-durable.gouv.fr/streams/last/nce.24.mp4",
    "source": "DIR Centre-Est (Lyon – Saint-Étienne)",
    "status": "operational",
    "last_checked": "2026-09-19T22:19:47.760Z"
  },
  {
    "id": "dirce-25",
    "name": "Col Pin Bouchain N7 PR0+680 (vers Roanne)",
    "latitude": 45.9158,
    "longitude": 4.34315,
    "stream_url": "https://www.webcams-dir.centre-est.developpement-durable.gouv.fr/streams/last/nce.25.mp4",
    "source": "DIR Centre-Est (Roanne – Lyon)",
    "status": "operational",
    "last_checked": "2026-09-19T22:19:47.760Z"
  },
  {
    "id": "dirce-26",
    "name": "Bourg-St-Maurice N90 PR75+210 (vers Albertville)",
    "latitude": 45.6026,
    "longitude": 6.75392,
    "stream_url": "https://www.webcams-dir.centre-est.developpement-durable.gouv.fr/streams/last/nce.26.mp4",
    "source": "DIR Centre-Est (Grenoble - Chambéry - Tarentaise)",
    "status": "operational",
    "last_checked": "2026-09-19T22:19:47.760Z"
  },
  {
    "id": "dirce-27",
    "name": "Meylan N87 PR10+590 (vers Lyon/ Gap/ Sisteron)",
    "latitude": 45.2037,
    "longitude": 5.78258,
    "stream_url": "https://www.webcams-dir.centre-est.developpement-durable.gouv.fr/streams/last/nce.27.mp4",
    "source": "DIR Centre-Est (Grenoble - Chambéry - Tarentaise)",
    "status": "operational",
    "last_checked": "2026-09-19T22:19:47.760Z"
  },
  {
    "id": "dirce-29",
    "name": "Vienne N7 PR 5+434 (vers Lyon)",
    "latitude": 45.5323,
    "longitude": 4.87398,
    "stream_url": "https://www.webcams-dir.centre-est.developpement-durable.gouv.fr/streams/last/nce.29.mp4",
    "source": "DIR Centre-Est (N7 Vallée du Rhône)",
    "status": "operational",
    "last_checked": "2026-09-19T22:19:47.760Z"
  },
  {
    "id": "dirce-30",
    "name": "Sortie 15 Chambéry N201 PR4+1033 (vers Lyon)",
    "latitude": 45.5858,
    "longitude": 5.90688,
    "stream_url": "https://www.webcams-dir.centre-est.developpement-durable.gouv.fr/streams/last/nce.30.mp4",
    "source": "DIR Centre-Est (Grenoble - Chambéry - Tarentaise)",
    "status": "operational",
    "last_checked": "2026-09-19T22:19:47.760Z"
  },
  {
    "id": "dirce-31",
    "name": "Eybens N87 PR4+200 (vers Lyon/ Gap/ Sisteron)",
    "latitude": 45.1558,
    "longitude": 5.74697,
    "stream_url": "https://www.webcams-dir.centre-est.developpement-durable.gouv.fr/streams/last/nce.31.mp4",
    "source": "DIR Centre-Est (Grenoble - Chambéry - Tarentaise)",
    "status": "operational",
    "last_checked": "2026-09-19T22:19:47.760Z"
  },
  {
    "id": "dirce-32",
    "name": "Chambéry sortie centre commercial  N201 PR5+980 (vers Albertville)",
    "latitude": 45.5918,
    "longitude": 5.89783,
    "stream_url": "https://www.webcams-dir.centre-est.developpement-durable.gouv.fr/streams/last/nce.32.mp4",
    "source": "DIR Centre-Est (Grenoble - Chambéry - Tarentaise)",
    "status": "operational",
    "last_checked": "2026-09-19T22:19:47.762Z"
  },
  {
    "id": "dirce-34",
    "name": "A450 PR1+537 (vers Lyon)",
    "latitude": 45.6914,
    "longitude": 4.81978,
    "stream_url": "https://www.webcams-dir.centre-est.developpement-durable.gouv.fr/streams/last/nce.34.mp4",
    "source": "DIR Centre-Est (Lyon – Saint-Étienne)",
    "status": "operational",
    "last_checked": "2026-09-19T22:19:47.762Z"
  },
  {
    "id": "dirce-37",
    "name": "Pierre Bénite A7 PR6+428 (vers Marseille)",
    "latitude": 45.698,
    "longitude": 4.8359,
    "stream_url": "https://www.webcams-dir.centre-est.developpement-durable.gouv.fr/streams/last/nce.37.mp4",
    "source": "DIR Centre-Est (Lyon – Saint-Étienne)",
    "status": "operational",
    "last_checked": "2026-09-19T22:19:47.762Z"
  },
  {
    "id": "dirce-40",
    "name": "Couleures N7 PR43+350 (vers Grenoble)",
    "latitude": 44.953,
    "longitude": 4.93509,
    "stream_url": "https://www.webcams-dir.centre-est.developpement-durable.gouv.fr/streams/last/nce.40.mp4",
    "source": "DIR Centre-Est (N7 Vallée du Rhône)",
    "status": "operational",
    "last_checked": "2026-09-19T22:19:47.762Z"
  },
  {
    "id": "dirce-41",
    "name": "Bessay N7 PR26+620 (vers Moulins)",
    "latitude": 46.4748,
    "longitude": 3.36751,
    "stream_url": "https://www.webcams-dir.centre-est.developpement-durable.gouv.fr/streams/last/nce.41.mp4",
    "source": "DIR Centre-Est (Moulins - Mâcon / Dijon)",
    "status": "operational",
    "last_checked": "2026-09-19T22:19:47.762Z"
  },
  {
    "id": "dirce-45",
    "name": "Mably N7 PR28+1219 (vers Moulins)",
    "latitude": 46.0631,
    "longitude": 4.06162,
    "stream_url": "https://www.webcams-dir.centre-est.developpement-durable.gouv.fr/streams/last/nce.45.mp4",
    "source": "DIR Centre-Est (Roanne – Lyon)",
    "status": "operational",
    "last_checked": "2026-09-19T22:19:47.762Z"
  },
  {
    "id": "dirce-47",
    "name": "Col de Bois Clair N79 PR63+640 (vers Mâcon)",
    "latitude": 46.3839,
    "longitude": 4.66724,
    "stream_url": "https://www.webcams-dir.centre-est.developpement-durable.gouv.fr/streams/last/nce.47.mp4",
    "source": "DIR Centre-Est (Moulins - Mâcon / Dijon)",
    "status": "operational",
    "last_checked": "2026-09-19T22:19:47.762Z"
  },
  {
    "id": "dirce-49",
    "name": "Gilly-sur-Isère N90 PR20+029 (vers Albertville)",
    "latitude": 45.6503,
    "longitude": 6.34652,
    "stream_url": "https://www.webcams-dir.centre-est.developpement-durable.gouv.fr/streams/last/nce.49.mp4",
    "source": "DIR Centre-Est (Grenoble - Chambéry - Tarentaise)",
    "status": "operational",
    "last_checked": "2026-09-19T22:19:47.762Z"
  },
  {
    "id": "dirce-55",
    "name": "Chambéry nord accès A41A43 RN201 PR7+100 (vers Lyon)",
    "latitude": 45.5999,
    "longitude": 5.89298,
    "stream_url": "https://www.webcams-dir.centre-est.developpement-durable.gouv.fr/streams/last/nce.55.mp4",
    "source": "DIR Centre-Est (Grenoble - Chambéry - Tarentaise)",
    "status": "operational",
    "last_checked": "2026-09-19T22:19:47.762Z"
  },
  {
    "id": "dirce-57",
    "name": "Rondeau A480 PR7+384 (vers Sisteron)",
    "latitude": 45.1589,
    "longitude": 5.70088,
    "stream_url": "https://www.webcams-dir.centre-est.developpement-durable.gouv.fr/streams/last/nce.57.mp4",
    "source": "DIR Centre-Est (Grenoble - Chambéry - Tarentaise)",
    "status": "operational",
    "last_checked": "2026-09-19T22:19:47.762Z"
  },
  {
    "id": "dirce-61",
    "name": "Bron A43 2+841 sens 1 (vers Lyon)",
    "latitude": 45.7262,
    "longitude": 4.917,
    "stream_url": "https://www.webcams-dir.centre-est.developpement-durable.gouv.fr/streams/last/nce.61.mp4",
    "source": "DIR Centre-Est (Lyon – Saint-Étienne)",
    "status": "operational",
    "last_checked": "2026-09-19T22:19:47.762Z"
  },
  {
    "id": "dirce-64",
    "name": "Tartaras A47 PR12+840 (Lyon)",
    "latitude": 45.5437,
    "longitude": 4.65852,
    "stream_url": "https://www.webcams-dir.centre-est.developpement-durable.gouv.fr/streams/last/nce.64.mp4",
    "source": "DIR Centre-Est (Lyon – Saint-Étienne)",
    "status": "operational",
    "last_checked": "2026-09-19T22:19:47.762Z"
  },
  {
    "id": "dirce-65",
    "name": "La Rize N346 PR32+142 (vers Paris)",
    "latitude": 45.7768,
    "longitude": 4.97971,
    "stream_url": "https://www.webcams-dir.centre-est.developpement-durable.gouv.fr/streams/last/nce.65.mp4",
    "source": "DIR Centre-Est (Lyon – Saint-Étienne)",
    "status": "operational",
    "last_checked": "2026-09-19T22:19:47.762Z"
  },
  {
    "id": "dirce-66",
    "name": "Paray-le-Monial N79 PR13+407 (vers Chalon/s-Saône)",
    "latitude": 46.4747,
    "longitude": 4.13631,
    "stream_url": "https://www.webcams-dir.centre-est.developpement-durable.gouv.fr/streams/last/nce.66.mp4",
    "source": "DIR Centre-Est (Moulins - Mâcon / Dijon)",
    "status": "operational",
    "last_checked": "2026-09-19T22:19:47.762Z"
  },
  {
    "id": "dirce-67",
    "name": "Vendranges N82 PR3+11 (vers Saint-Étienne et Lyon)",
    "latitude": 45.9431,
    "longitude": 4.14081,
    "stream_url": "https://www.webcams-dir.centre-est.developpement-durable.gouv.fr/streams/last/nce.67.mp4",
    "source": "DIR Centre-Est (Roanne – Lyon)",
    "status": "operational",
    "last_checked": "2026-09-19T22:19:47.762Z"
  },
  {
    "id": "cam-nyc-times-square",
    "name": "New York - Times Square North",
    "latitude": 40.758,
    "longitude": -73.9855,
    "stream_url": "https://www.earthcam.com/usa/newyork/timessquare/?cam=tsrobo1",
    "source": "EarthCam Public Feeds",
    "status": "operational"
  },
  {
    "id": "cam-nyc-5th-ave",
    "name": "New York - 5th Ave & 42nd St",
    "latitude": 40.7527,
    "longitude": -73.9818,
    "stream_url": "https://webcams.nyctmc.org",
    "source": "NYC DOT Traffic Cameras",
    "status": "operational"
  },
  {
    "id": "cam-nyc-brooklyn-bridge",
    "name": "New York - Brooklyn Bridge Promenade",
    "latitude": 40.7061,
    "longitude": -73.9969,
    "stream_url": "https://webcams.nyctmc.org",
    "source": "NYC DOT Feeds",
    "status": "operational"
  },
  {
    "id": "cam-sf-bay-bridge",
    "name": "San Francisco - Bay Bridge Westbound",
    "latitude": 37.7983,
    "longitude": -122.3778,
    "stream_url": "https://cwwp2.dot.ca.gov/vm/loc/d4/hwy80atbaybridge.htm",
    "source": "Caltrans District 4",
    "status": "operational"
  },
  {
    "id": "cam-sf-embarcadero",
    "name": "San Francisco - Embarcadero Pier 14",
    "latitude": 37.7936,
    "longitude": -122.3912,
    "stream_url": "https://www.sensibleweather.com",
    "source": "Open City Webcams",
    "status": "operational"
  },
  {
    "id": "cam-london-tower-bridge",
    "name": "London - Tower Bridge Quay",
    "latitude": 51.5055,
    "longitude": -0.0754,
    "stream_url": "https://www.camscape.com/camera/london-tower-bridge-webcam/",
    "source": "Camscape Feeds",
    "status": "operational"
  },
  {
    "id": "cam-london-piccadilly",
    "name": "London - Piccadilly Circus",
    "latitude": 51.5101,
    "longitude": -0.1345,
    "stream_url": "https://www.earthcam.com/world/uk/london/piccadillycircus/?cam=piccadillycircus",
    "source": "EarthCam Feeds",
    "status": "operational"
  },
  {
    "id": "cam-paris-eiffel",
    "name": "Paris - Tour Eiffel & Champ de Mars",
    "latitude": 48.8584,
    "longitude": 2.2945,
    "stream_url": "https://www.skylinewebcams.com/fr/webcam/france/ile-de-france/paris/tour-eiffel.html",
    "source": "SkylineWebcams",
    "status": "operational"
  },
  {
    "id": "cam-paris-concorde",
    "name": "Paris - Place de la Concorde",
    "latitude": 48.8656,
    "longitude": 2.3212,
    "stream_url": "https://www.viewsurf.com/univers/ville/vue/16769-france-ile-de-france-paris-place-de-la-concorde",
    "source": "Viewsurf Open Feeds",
    "status": "operational"
  },
  {
    "id": "cam-tokyo-shibuya",
    "name": "Tokyo - Shibuya Crossing Central",
    "latitude": 35.6595,
    "longitude": 139.7004,
    "stream_url": "https://www.youtube.com/watch?v=HpdO5Kq3o8Y",
    "source": "Shibuya Live Stream",
    "status": "operational"
  },
  {
    "id": "cam-tokyo-shinjuku",
    "name": "Tokyo - Shinjuku Kabukicho Gate",
    "latitude": 35.6938,
    "longitude": 139.7034,
    "stream_url": "https://www.youtube.com/watch?v=6afT4b_aXvI",
    "source": "Live Shinjuku Cam",
    "status": "operational"
  },
  {
    "id": "cam-amsterdam-dam",
    "name": "Amsterdam - Dam Square",
    "latitude": 52.3728,
    "longitude": 4.8936,
    "stream_url": "https://www.skylinewebcams.com/en/webcam/netherlands/north-holland/amsterdam/dam-square.html",
    "source": "SkylineWebcams",
    "status": "operational"
  },
  {
    "id": "cam-berlin-brandenburg",
    "name": "Berlin - Brandenburger Tor",
    "latitude": 52.5163,
    "longitude": 13.3777,
    "stream_url": "https://www.berlin.de/webcams/brandenburger-tor/",
    "source": "Berlin Open Portal",
    "status": "operational"
  },
  {
    "id": "cam-rome-colosseum",
    "name": "Rome - Colosseum Panoramic",
    "latitude": 41.8902,
    "longitude": 12.4922,
    "stream_url": "https://www.skylinewebcams.com/en/webcam/italia/lazio/roma/colosseo.html",
    "source": "SkylineWebcams",
    "status": "operational"
  },
  {
    "id": "cam-venice-san-marco",
    "name": "Venice - Piazza San Marco",
    "latitude": 45.4342,
    "longitude": 12.3388,
    "stream_url": "https://www.skylinewebcams.com/en/webcam/italia/veneto/venezia/piazza-san-marco.html",
    "source": "SkylineWebcams",
    "status": "operational"
  },
  {
    "id": "cam-dublin-temple-bar",
    "name": "Dublin - Temple Bar Street",
    "latitude": 53.3456,
    "longitude": -6.2642,
    "stream_url": "https://www.earthcam.com/world/ireland/dublin/?cam=templebar",
    "source": "EarthCam Feeds",
    "status": "operational"
  },
  {
    "id": "cam-sydney-harbour",
    "name": "Sydney - Harbour & Opera House",
    "latitude": -33.8568,
    "longitude": 151.2153,
    "stream_url": "https://www.sydneyoperahouse.com/our-story/live-webcam",
    "source": "Sydney Open Stream",
    "status": "operational"
  },
  {
    "id": "cam-seoul-gangnam",
    "name": "Seoul - Gangnam Station Junction",
    "latitude": 37.4979,
    "longitude": 127.0276,
    "stream_url": "https://topis.seoul.go.kr",
    "source": "Seoul TOPIS Traffic Feeds",
    "status": "operational"
  },
  {
    "id": "cam-toronto-dundas-sq",
    "name": "Toronto - Yonge & Dundas Square",
    "latitude": 43.6561,
    "longitude": -79.3802,
    "stream_url": "https://www.toronto.ca/services-payments/streets-parking-transportation/road-restrictions-closures/traffic-cameras/",
    "source": "City of Toronto Traffic",
    "status": "operational"
  },
  {
    "id": "cam-prague-old-town",
    "name": "Prague - Old Town Square & Astronomical Clock",
    "latitude": 50.0875,
    "longitude": 14.4211,
    "stream_url": "https://www.earthcam.com/world/czechrepublic/prague/?cam=pragueoldtown",
    "source": "EarthCam Feeds",
    "status": "operational"
  },
  {
    "id": "cam-unreachable-test",
    "name": "Test Station - Signal Offline Feeder",
    "latitude": 51.52,
    "longitude": -0.12,
    "stream_url": "http://192.0.2.1/stream.mjpg",
    "source": "Offline Simulation Feed",
    "status": "down"
  }
];

module.exports = {
  SEED_CAMERAS
};
