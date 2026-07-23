// Vaatii admin-roolin. Käytetään requireAuthin JÄLKEEN, joka on jo hakenut
// käyttäjän kannasta (req.authUser). Rooli luetaan siis aina tietokannasta
// eikä tokenista, jolloin roolin poisto astuu voimaan heti ilman
// uudelleenkirjautumista.
function requireAdmin(req, res, next) {
  if (!req.authUser) {
    return res.status(401).json({ error: 'Kirjautuminen vaaditaan' });
  }
  if (req.authUser.role !== 'admin') {
    return res.status(403).json({ error: 'Ei oikeuksia' });
  }
  req.adminUser = req.authUser;
  next();
}

module.exports = requireAdmin;
