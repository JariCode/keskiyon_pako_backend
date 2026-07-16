const express = require('express');
const mongoose = require('mongoose');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const mongoSanitize = require('express-mongo-sanitize');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const saveRoutes = require('./routes/save');

const app = express();

app.use(helmet());

app.use(cors({
  origin: process.env.FRONTEND_URL,
  credentials: true,
}));

app.use(express.json({ limit: '100kb' }));
app.use(cookieParser());
app.use(mongoSanitize());

const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  message: 'Liian monta pyyntöä, yritä myöhemmin uudelleen.',
});
app.use('/api', generalLimiter);

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: 'Liian monta kirjautumisyritystä, yritä myöhemmin uudelleen.',
});
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);

const saveLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 15,
  message: 'Liian monta tallennuspyyntöä.',
});
app.use('/api/save', saveLimiter);

mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('MongoDB yhdistetty'))
  .catch((err) => console.error('MongoDB-virhe:', err));

app.use('/api/auth', authRoutes);
app.use('/api/save', saveRoutes);

app.get('/', (req, res) => {
  res.send('Keskiyön Pako backend käynnissä');
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Palvelinvirhe' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Palvelin käynnissä portissa ${PORT}`));