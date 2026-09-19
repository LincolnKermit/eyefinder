# ⌖ EyeFinder

> Minimalist, real-time OSINT CCTV map tracker with live stream connectivity monitoring.

![Dark Minimalist OSINT Map](https://img.shields.io/badge/UI-OSINT%20Dark%20Grey-black?style=flat-square)
![Stack](https://img.shields.io/badge/Stack-Node.js%20%7C%20Leaflet%20%7C%20Vercel-black?style=flat-square)
![DB](https://img.shields.io/badge/DB-Supabase%20%2F%20Postgres-green?style=flat-square)

---

## ⚡ Quick Start

### 1. Install & Run Locally
```bash
git clone https://github.com/lincolnkermit/eyefinder.git
cd eyefinder
npm install
npm start
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🚀 Features

- **Free Open-Source Dark Map**: CartoDB Dark Matter tiles layered with Leaflet.js.
- **Real-Time Status Indicator**:
  - `● Green`: Operational CCTV flux.
  - `■ Light Red / Grey`: Down or unreachable stream.
- **Direct Flux Redirection**: Click any camera pin to view telemetry coordinates and jump straight to the live camera feed with `ACCESS CCTV FLUX ↗`.
- **Automated Health Scanning**: Built-in HTTP prober verifying stream health and updating the database.
- **Vercel Serverless Ready**: Deploy with 1-click on Vercel with automated cron verification (`/api/cron`).
- **Database Flexibility**: Native **Supabase / PostgreSQL** support with automatic fallback to local datastore.

---

## 📖 Architecture & Maintainer Guide

See [`ARCHITECTURE.md`](./ARCHITECTURE.md) for full function breakdowns, schema definitions, and scraper extensions.
