const mongoose = require('mongoose');

// Tarkistaa että reittiparametri on kelvollinen Mongo ObjectId.
// Ilman tätä esim. /admin/users/roska/role heittäisi CastErrorin, joka
// päätyisi 500-vastaukseksi (oikea vastaus on 400) ja roskaisi lokit.
function validateObjectId(paramName = 'id') {
  return (req, res, next) => {
    const value = req.params[paramName];
    if (!mongoose.Types.ObjectId.isValid(value)) {
      return res.status(400).json({ error: 'Virheellinen tunniste' });
    }
    next();
  };
}

module.exports = validateObjectId;
