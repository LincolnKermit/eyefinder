module.exports = async function handler(req, res) {
  const diagnostics = {};
  diagnostics.nodeVersion = process.version;
  diagnostics.env = {
    VERCEL: process.env.VERCEL,
    NODE_ENV: process.env.NODE_ENV,
    HAS_SUPABASE_URL: Boolean(process.env.SUPABASE_URL),
    HAS_SUPABASE_KEY: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY)
  };

  try {
    const fs = require('fs');
    const path = require('path');
    diagnostics.cwd = process.cwd();
    diagnostics.dirname = __dirname;
    diagnostics.rootFiles = fs.readdirSync(process.cwd());
    diagnostics.dirnameFiles = fs.readdirSync(__dirname);
  } catch (err) {
    diagnostics.fsError = err.message;
  }

  try {
    const seed = require('../lib/seed');
    diagnostics.seedLoaded = Boolean(seed && seed.SEED_CAMERAS);
    diagnostics.seedCount = seed ? seed.SEED_CAMERAS.length : 0;
  } catch (err) {
    diagnostics.seedRequireError = err.message;
    diagnostics.seedRequireStack = err.stack;
  }

  try {
    const db = require('../lib/db');
    diagnostics.dbLoaded = Boolean(db && db.getCameras);
  } catch (err) {
    diagnostics.dbRequireError = err.message;
  }

  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(diagnostics, null, 2));
};
