module.exports = async (req, res) => {
  try {
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({
      ok: true,
      nodeVersion: process.version,
      hasReq: !!req,
      url: req.url,
      method: req.method
    }));
  } catch (err) {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'text/plain');
    res.end(String(err.stack || err));
  }
};
