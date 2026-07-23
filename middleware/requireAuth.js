const jwt = require('jsonwebtoken');
const User = require('../models/User');

async function requireAuth(req, res, next) {
  const token = req.cookies.token;

  if (!token) {
    return res.status(401).json({ error: 'Kirjautuminen vaaditaan' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Tarkista että käyttäjä on YHÄ olemassa. Ilman tätä poistetun käyttäjän
    // token toimisi vielä koko voimassaoloaikansa (esim. 7 vrk) ja hän voisi
    // esimerkiksi tallentaa peliä orvolla userId:llä.
    const user = await User.findById(decoded.userId).select('_id username role');
    if (!user) {
      res.clearCookie('token');
      return res.status(401).json({ error: 'Käyttäjätiliä ei enää ole' });
    }

    req.userId = user._id;
    req.authUser = user;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Virheellinen tai vanhentunut istunto' });
  }
}

module.exports = requireAuth;
