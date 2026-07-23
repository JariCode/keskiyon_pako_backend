const User = require('../models/User');

// Vaatii admin-roolin. Käytetään requireAuthin JÄLKEEN, jolloin req.userId
// on jo asetettu. Rooli luetaan aina tietokannasta (ei tokenista), jotta
// roolin poisto astuu voimaan heti ilman uudelleenkirjautumista.
async function requireAdmin(req, res, next) {
  try {
    const user = await User.findById(req.userId).select('username role');
    if (!user) {
      return res.status(401).json({ error: 'Käyttäjää ei löytynyt' });
    }
    if (user.role !== 'admin') {
      return res.status(403).json({ error: 'Ei oikeuksia' });
    }
    req.adminUser = user;
    next();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Palvelinvirhe' });
  }
}

module.exports = requireAdmin;
