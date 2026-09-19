// Seed dataset of verified public CCTV & city flux streams
const SEED_CAMERAS = [
  {
    id: "cam-nyc-times-square",
    name: "New York - Times Square North",
    latitude: 40.7580,
    longitude: -73.9855,
    stream_url: "https://www.earthcam.com/usa/newyork/timessquare/?cam=tsrobo1",
    source: "EarthCam Public Feeds",
    status: "operational"
  },
  {
    id: "cam-nyc-5th-ave",
    name: "New York - 5th Ave & 42nd St",
    latitude: 40.7527,
    longitude: -73.9818,
    stream_url: "https://webcams.nyctmc.org",
    source: "NYC DOT Traffic Cameras",
    status: "operational"
  },
  {
    id: "cam-nyc-brooklyn-bridge",
    name: "New York - Brooklyn Bridge Promenade",
    latitude: 40.7061,
    longitude: -73.9969,
    stream_url: "https://webcams.nyctmc.org",
    source: "NYC DOT Feeds",
    status: "operational"
  },
  {
    id: "cam-sf-bay-bridge",
    name: "San Francisco - Bay Bridge Westbound",
    latitude: 37.7983,
    longitude: -122.3778,
    stream_url: "https://cwwp2.dot.ca.gov/vm/loc/d4/hwy80atbaybridge.htm",
    source: "Caltrans District 4",
    status: "operational"
  },
  {
    id: "cam-sf-embarcadero",
    name: "San Francisco - Embarcadero Pier 14",
    latitude: 37.7936,
    longitude: -122.3912,
    stream_url: "https://www.sensibleweather.com",
    source: "Open City Webcams",
    status: "operational"
  },
  {
    id: "cam-london-tower-bridge",
    name: "London - Tower Bridge Quay",
    latitude: 51.5055,
    longitude: -0.0754,
    stream_url: "https://www.camscape.com/camera/london-tower-bridge-webcam/",
    source: "Camscape Feeds",
    status: "operational"
  },
  {
    id: "cam-london-piccadilly",
    name: "London - Piccadilly Circus",
    latitude: 51.5101,
    longitude: -0.1345,
    stream_url: "https://www.earthcam.com/world/uk/london/piccadillycircus/?cam=piccadillycircus",
    source: "EarthCam Feeds",
    status: "operational"
  },
  {
    id: "cam-paris-eiffel",
    name: "Paris - Tour Eiffel & Champ de Mars",
    latitude: 48.8584,
    longitude: 2.2945,
    stream_url: "https://www.skylinewebcams.com/fr/webcam/france/ile-de-france/paris/tour-eiffel.html",
    source: "SkylineWebcams",
    status: "operational"
  },
  {
    id: "cam-paris-concorde",
    name: "Paris - Place de la Concorde",
    latitude: 48.8656,
    longitude: 2.3212,
    stream_url: "https://www.viewsurf.com/univers/ville/vue/16769-france-ile-de-france-paris-place-de-la-concorde",
    source: "Viewsurf Open Feeds",
    status: "operational"
  },
  {
    id: "cam-tokyo-shibuya",
    name: "Tokyo - Shibuya Crossing Central",
    latitude: 35.6595,
    longitude: 139.7004,
    stream_url: "https://www.youtube.com/watch?v=HpdO5Kq3o8Y",
    source: "Shibuya Live Stream",
    status: "operational"
  },
  {
    id: "cam-tokyo-shinjuku",
    name: "Tokyo - Shinjuku Kabukicho Gate",
    latitude: 35.6938,
    longitude: 139.7034,
    stream_url: "https://www.youtube.com/watch?v=6afT4b_aXvI",
    source: "Live Shinjuku Cam",
    status: "operational"
  },
  {
    id: "cam-amsterdam-dam",
    name: "Amsterdam - Dam Square",
    latitude: 52.3728,
    longitude: 4.8936,
    stream_url: "https://www.skylinewebcams.com/en/webcam/netherlands/north-holland/amsterdam/dam-square.html",
    source: "SkylineWebcams",
    status: "operational"
  },
  {
    id: "cam-berlin-brandenburg",
    name: "Berlin - Brandenburger Tor",
    latitude: 52.5163,
    longitude: 13.3777,
    stream_url: "https://www.berlin.de/webcams/brandenburger-tor/",
    source: "Berlin Open Portal",
    status: "operational"
  },
  {
    id: "cam-rome-colosseum",
    name: "Rome - Colosseum Panoramic",
    latitude: 41.8902,
    longitude: 12.4922,
    stream_url: "https://www.skylinewebcams.com/en/webcam/italia/lazio/roma/colosseo.html",
    source: "SkylineWebcams",
    status: "operational"
  },
  {
    id: "cam-venice-san-marco",
    name: "Venice - Piazza San Marco",
    latitude: 45.4342,
    longitude: 12.3388,
    stream_url: "https://www.skylinewebcams.com/en/webcam/italia/veneto/venezia/piazza-san-marco.html",
    source: "SkylineWebcams",
    status: "operational"
  },
  {
    id: "cam-dublin-temple-bar",
    name: "Dublin - Temple Bar Street",
    latitude: 53.3456,
    longitude: -6.2642,
    stream_url: "https://www.earthcam.com/world/ireland/dublin/?cam=templebar",
    source: "EarthCam Feeds",
    status: "operational"
  },
  {
    id: "cam-sydney-harbour",
    name: "Sydney - Harbour & Opera House",
    latitude: -33.8568,
    longitude: 151.2153,
    stream_url: "https://www.sydneyoperahouse.com/our-story/live-webcam",
    source: "Sydney Open Stream",
    status: "operational"
  },
  {
    id: "cam-seoul-gangnam",
    name: "Seoul - Gangnam Station Junction",
    latitude: 37.4979,
    longitude: 127.0276,
    stream_url: "https://topis.seoul.go.kr",
    source: "Seoul TOPIS Traffic Feeds",
    status: "operational"
  },
  {
    id: "cam-toronto-dundas-sq",
    name: "Toronto - Yonge & Dundas Square",
    latitude: 43.6561,
    longitude: -79.3802,
    stream_url: "https://www.toronto.ca/services-payments/streets-parking-transportation/road-restrictions-closures/traffic-cameras/",
    source: "City of Toronto Traffic",
    status: "operational"
  },
  {
    id: "cam-prague-old-town",
    name: "Prague - Old Town Square & Astronomical Clock",
    latitude: 50.0875,
    longitude: 14.4211,
    stream_url: "https://www.earthcam.com/world/czechrepublic/prague/?cam=pragueoldtown",
    source: "EarthCam Feeds",
    status: "operational"
  },
  {
    id: "cam-unreachable-test",
    name: "Test Station - Signal Offline Feeder",
    latitude: 51.5200,
    longitude: -0.1200,
    stream_url: "http://192.0.2.1/stream.mjpg",
    source: "Offline Simulation Feed",
    status: "down"
  }
];

module.exports = {
  SEED_CAMERAS
};
