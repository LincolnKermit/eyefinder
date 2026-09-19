# EyeFinder Architecture Documentation

This document describes the design, code structure, functions, data flow, and deployment steps for maintainers of **EyeFinder**.

---

## 1. Overview

EyeFinder is an OSINT-style, real-time CCTV stream tracker. It indexes public traffic and city cameras around the globe, checks their connectivity status, and renders them onto an interactive dark grey minimalist map.

When an operator clicks on any camera reticle:
- The popup displays the camera name, coordinates, source, and status (`OPERATIONAL` in green or `DOWN` in light red / grey).
- Clicking **"ACCESS CCTV FLUX ↗"** redirects directly to the original stream URL or camera portal.

---

## 2. Directory Structure

```
eyefinder/
├── index.html              # Frontend OSINT HUD UI & Leaflet Map container
├── style.css               # Minimalist futuristic dark grey styling & marker CSS
├── app.js                  # Client logic: map layers, markers, filtering, search, rescan
├── server.js               # Node.js local dev server (mirrors Vercel serverless behavior)
├── package.json            # Node project configuration and dependencies
├── vercel.json             # Vercel deployment, serverless routes, and cron configuration
├── schema.sql              # Supabase / PostgreSQL schema and RLS policies
├── api/                    # Vercel Serverless Functions
│   ├── cameras.js          # GET (list all cameras) / POST (add new camera)
│   └── cron.js             # GET/POST (periodic health check & DB status updater)
├── lib/                    # Core modules
│   ├── db.js               # Database abstraction (Supabase + local JSON fallback)
│   ├── scraper.js          # Stream health probe & feed scraping logic
│   └── seed.js             # Initial verified global CCTV feed registry
├── scripts/                # CLI maintenance scripts
│   ├── seed-db.js          # Standalone database seeder
│   └── check-health.js     # Standalone health verification runner
└── data/
    └── cameras.json        # Local JSON datastore (used when Supabase is not configured)
```

---

## 3. Function Catalog

### `lib/db.js`
Handles persistence with **Supabase / PostgreSQL** when configured, or seamlessly falls back to a local JSON file store (`data/cameras.json`).

| Function | File | Description | Parameters / Returns |
| :--- | :--- | :--- | :--- |
| `getCameras()` | `lib/db.js` | Retrieves all registered cameras from Supabase or local JSON. | Returns `Promise<Array<Camera>>` |
| `updateCameraStatus(id, status)` | `lib/db.js` | Updates status (`'operational'` or `'down'`) and `last_checked` timestamp for a camera. | `id: string`, `status: string` → Returns `Promise<boolean>` |
| `upsertCameras(camerasList)` | `lib/db.js` | Batch inserts or updates cameras on conflict. | `camerasList: Array<Camera>` → Returns `Promise<Array<Camera>>` |
| `isUsingSupabase()` | `lib/db.js` | Checks if Supabase credentials are set in the environment. | Returns `boolean` |

### `lib/scraper.js`
Handles HTTP probing to detect whether a CCTV flux URL is alive or unreachable.

| Function | File | Description | Parameters / Returns |
| :--- | :--- | :--- | :--- |
| `checkCameraHealth(url, timeoutMs)` | `lib/scraper.js` | Sends an HTTP `HEAD` (or `GET` with byte range) with an `AbortController` timeout (default 3.5s). Returns `'operational'` if status < 400, else `'down'`. | `url: string`, `timeoutMs: number` → Returns `Promise<'operational' \| 'down'>` |
| `scrapeFeeds()` | `lib/scraper.js` | Aggregates camera feeds from public sources and seed lists. Extensible for new city scrapers. | Returns `Promise<Array<Camera>>` |
| `verifyAllCameras(cameras, concurrency)` | `lib/scraper.js` | Concurrently tests camera endpoints in small batches (default batch size: 5) to prevent socket exhaustion. | `cameras: Array<Camera>`, `concurrency: number` → Returns `Promise<Array<Camera>>` |

### `api/cameras.js`
Vercel Serverless Function serving the `/api/cameras` route.

| Method | Description |
| :--- | :--- |
| `GET` | Returns JSON containing `total`, `operational`, `down`, storage engine name, and array of camera objects. Auto-populates seed data if database is empty. |
| `POST` | Accepts `{ name, latitude, longitude, stream_url, source }` and inserts a new camera into the database. |

### `api/cron.js`
Vercel Serverless Function & Cron Worker serving the `/api/cron` route.

| Method | Description |
| :--- | :--- |
| `GET` / `POST` | Runs a complete health verification sweep across all cameras, writes updated statuses and timestamps to the database, and returns the scan summary. Configured in `vercel.json` to run hourly. |

### `app.js` (Frontend)
Client-side controller powering the Leaflet map and OSINT HUD.

| Function | Description |
| :--- | :--- |
| `initMap()` | Initializes Leaflet instance centered at `[30.0, 0.0]`, attaches CartoDB Dark Matter tile layer, and initializes marker group. |
| `createPinIcon(status)` | Generates a custom Leaflet `DivIcon` DOM reticle: green with pulsing radar animation for `operational`, light red/grey with dashed ring for `down`. |
| `createPopupContent(cam)` | Builds the dark OSINT popup containing title, coordinates, source, last checked time, and the direct link button `ACCESS CCTV FLUX ↗`. |
| `loadCameras()` | Fetches `/api/cameras` and triggers stats update, marker rendering, and sidebar list updates. |
| `getFilteredCameras()` | Applies active search filter string and status toggle (`all`, `operational`, `down`). |
| `renderMapMarkers()` | Clears existing markers and plots filtered cameras onto the map layer. |
| `renderSidebarList()` | Populates the collapsible sidebar with camera feed cards. |
| `focusCamera(cam)` | Pans the map (`map.flyTo`) to the selected camera and automatically opens its popup. |
| `triggerReScan()` | Displays top scanning HUD banner, sends request to `/api/cron`, and refreshes the map and statistics upon completion. |
| `startClock()` | Displays real-time ticking UTC clock in header. |

---

## 4. Database Schema (Supabase / Postgres)

The SQL migration is located in `schema.sql`:

```sql
CREATE TABLE IF NOT EXISTS cameras (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    stream_url TEXT NOT NULL,
    source TEXT DEFAULT 'public',
    status TEXT DEFAULT 'operational' CHECK (status IN ('operational', 'down')),
    last_checked TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

---

## 5. Adding New CCTV Scrapers

To integrate a new public scraper (e.g. NYC DOT, Caltrans, London TfL, or Insecam):
1. Open [`lib/scraper.js`](file:///home/lincoln/Workspace/eyefinder/lib/scraper.js).
2. Create a dedicated extractor function:
```javascript
async function scrapeCityFeeds() {
  // Fetch open data API or parse HTML
  // Return array of: { id, name, latitude, longitude, stream_url, source }
}
```
3. Call it inside `scrapeFeeds()` and concatenate with the existing list.

---

## 6. Vercel Deployment

1. **Commit and Push to GitHub**:
   ```bash
   git add .
   git commit -m "feat: complete eyefinder real-time cctv map"
   git push origin main
   ```
2. **Import into Vercel**:
   - Link the GitHub repository `lincolnkermit/eyefinder`.
   - Vercel automatically detects the static frontend and the serverless functions in `api/`.
3. **Environment Variables (Optional for Supabase)**:
   - `SUPABASE_URL`: Your Supabase Project URL.
   - `SUPABASE_SERVICE_ROLE_KEY` or `SUPABASE_ANON_KEY`: Your Supabase API key.
   *(If omitted, EyeFinder gracefully uses the local datastore).*
4. **Automated Cron**:
   - `vercel.json` contains the cron configuration:
     ```json
     "crons": [{ "path": "/api/cron", "schedule": "0 * * * *" }]
     ```
   - Vercel will invoke `/api/cron` every hour to keep camera statuses updated.
