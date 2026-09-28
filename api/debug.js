module.exports = async (req, res) => {
  const info = {
    url: req.url,
    method: req.method,
    node: process.version,
    env_keys: Object.keys(process.env).filter(k => !k.includes('KEY') && !k.includes('SECRET')),
    hasAdminSecret: Boolean(process.env.ADMIN_SECRET),
  };

  try {
    const sec = require('../lib/security');
    info.security_loaded = true;
    info.admin_secret_length = sec.ADMIN_SECRET ? sec.ADMIN_SECRET.length : 0;
  } catch (e) {
    info.security_error = e.message;
    info.security_stack = e.stack;
  }

  try {
    const db = require('../lib/db');
    info.db_loaded = true;
  } catch (e) {
    info.db_error = e.message;
    info.db_stack = e.stack;
  }

  try {
    const scraper = require('../lib/scraper');
    info.scraper_loaded = true;
  } catch (e) {
    info.scraper_error = e.message;
    info.scraper_stack = e.stack;
  }

  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(info, null, 2));
};
