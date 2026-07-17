function stripDollarKeys(obj) {
  if (!obj || typeof obj !== 'object') return;

  for (const key of Object.keys(obj)) {
    if (key.startsWith('$') || key.includes('.')) {
      delete obj[key];
    } else {
      stripDollarKeys(obj[key]);
    }
  }
}

function sanitize(req, res, next) {
  stripDollarKeys(req.body);
  stripDollarKeys(req.params);
  next();
}

module.exports = sanitize;