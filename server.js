const express = require('express');
const mongoose = require('mongoose');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const sanitize = require('./middleware/sanitize');
const authRoutes = require('./routes/auth');
const saveRoutes = require('./routes/save');
const adminRoutes = require('./routes/admin');

// --- Pakolliset ympäristömuuttujat: kaadu heti jos puuttuu ---
// Ilman tätä esim. puuttuva FRONTEND_URL avaisi CORSin kaikille origineille
// ja puuttuva JWT_SECRET kaataisi sovelluksen vasta ensimmäisellä
// kirjautumisyrityksellä.
const REQUIRED_ENV = ['MONGODB_URI', 'JWT_SECRET', 'FRONTEND_URL'];
const missing = REQUIRED_ENV.filter((key) => !process.env[key]);
if (missing.length > 0) {
  console.error(`Puuttuvat ympäristömuuttujat: ${missing.join(', ')}`);
  process.exit(1);
}

const app = express();

// Render/Heroku ym. käyttävät proxyä. Ilman tätä express-rate-limit näkee
// kaikkien pyyntöjen tulevan proxyn IP:stä, jolloin rajoitukset eivät toimi
// oikein. Arvo 1 = luota yhteen proxy-hyppyyn (ei 'true', joka luottaisi
// kaikkiin ja mahdollistaisi IP-huijauksen X-Forwarded-For-otsakkeella).
app.set('trust proxy', 1);

app.use(helmet());

// Piilota Express-versio otsakkeista
app.disable('x-powered-by');

app.use(cors({
  origin: process.env.FRONTEND_URL,
  credentials: true,
}));

app.use(express.json({ limit: '100kb' }));
app.use(cookieParser());
app.use(sanitize);

// Rate limit -vastaukset JSON-muodossa { error: ... }, jotta frontend
// (authApi.js) osaa lukea viestin. Oletuksena express-rate-limit palauttaa
// pelkkää tekstiä, jolloin frontend näyttäisi geneerisen "Jokin meni pieleen".
function jsonLimitHandler(message) {
  return (req, res) => res.status(429).json({ error: message });
}

const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  handler: jsonLimitHandler('Liian monta pyyntöä, yritä myöhemmin uudelleen.'),
});
app.use('/api', generalLimiter);

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: jsonLimitHandler('Liian monta kirjautumisyritystä. Yritä myöhemmin uudelleen.'),
});
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);

// Tilin tietojen muuttaminen: estä salasana-arvailu näiden reittien kautta
// (jokainen vaatii nykyisen salasanan).
const accountLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  handler: jsonLimitHandler('Liian monta muutospyyntöä. Yritä myöhemmin uudelleen.'),
});
app.use('/api/auth/username', accountLimiter);
app.use('/api/auth/email', accountLimiter);
app.use('/api/auth/password', accountLimiter);
app.use('/api/auth/account', accountLimiter);

const saveLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  handler: jsonLimitHandler('Liian monta tallennuspyyntöä. Odota hetki.'),
});
app.use('/api/save', saveLimiter);

// Ylläpitotoiminnot: tiukempi raja kuin yleinen.
const adminLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  handler: jsonLimitHandler('Liian monta ylläpitopyyntöä. Yritä myöhemmin uudelleen.'),
});
app.use('/api/admin', adminLimiter);

mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('MongoDB yhdistetty'))
  .catch((err) => console.error('MongoDB-virhe:', err));

app.use('/api/auth', authRoutes);
app.use('/api/save', saveRoutes);
app.use('/api/admin', adminRoutes);

app.get('/', (req, res) => {
  res.send('Keskiyön Pako backend käynnissä');
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Palvelinvirhe' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Palvelin käynnissä portissa ${PORT}`));