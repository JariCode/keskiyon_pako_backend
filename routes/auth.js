const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const router = express.Router();

const User = require('../models/User');
const SaveGame = require('../models/SaveGame');
const validate = require('../middleware/validate');
const requireAuth = require('../middleware/requireAuth');
const {
  registerSchema,
  loginSchema,
  updateUsernameSchema,
  updateEmailSchema,
  updatePasswordSchema,
  deleteAccountSchema,
  updateAudioSettingsSchema,
} = require('../schemas/authSchemas');

const SALT_ROUNDS = 12;

const TOKEN_EXPIRES_IN_DAYS = Number(process.env.JWT_EXPIRES_IN_DAYS) || 7;
const TOKEN_EXPIRES_IN_MS = TOKEN_EXPIRES_IN_DAYS * 24 * 60 * 60 * 1000;

function createToken(userId) {
  return jwt.sign({ userId }, process.env.JWT_SECRET, {
    expiresIn: `${TOKEN_EXPIRES_IN_DAYS}d`,
  });
}

function setCookie(res, token) {
  res.cookie('token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: TOKEN_EXPIRES_IN_MS,
  });
}

// --- REKISTERÖINTI ---
router.post('/register', validate(registerSchema), async (req, res) => {
  const { username, email, password } = req.body;

  try {
    const existing = await User.findOne({ $or: [{ email }, { username }] });
    if (existing) {
      return res.status(409).json({ error: 'Käyttäjänimi tai sähköposti on jo käytössä' });
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const user = await User.create({ username, email, passwordHash });

    const token = createToken(user._id);
    setCookie(res, token);

    res.status(201).json({ username: user.username });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Rekisteröinti epäonnistui' });
  }
});

// --- KIRJAUTUMINEN ---
router.post('/login', validate(loginSchema), async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ error: 'Virheellinen sähköposti tai salasana' });
    }

    const match = await bcrypt.compare(password, user.passwordHash);
    if (!match) {
      return res.status(401).json({ error: 'Virheellinen sähköposti tai salasana' });
    }

    const token = createToken(user._id);
    setCookie(res, token);

    res.json({ username: user.username });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Kirjautuminen epäonnistui' });
  }
});

// --- ULOSKIRJAUTUMINEN ---
router.post('/logout', (req, res) => {
  res.clearCookie('token');
  res.json({ message: 'Uloskirjautuminen onnistui' });
});

// --- NYKYINEN KÄYTTÄJÄ ---
router.get('/me', requireAuth, async (req, res) => {
  const user = await User.findById(req.userId).select('username email audioSettings');
  res.json(user);
});

// --- VAIHDA KÄYTTÄJÄNIMI ---
router.patch('/username', requireAuth, validate(updateUsernameSchema), async (req, res) => {
  const { username, currentPassword } = req.body;

  try {
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ error: 'Käyttäjää ei löytynyt' });

    const match = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!match) return res.status(401).json({ error: 'Väärä salasana' });

    const taken = await User.findOne({ username, _id: { $ne: user._id } });
    if (taken) return res.status(409).json({ error: 'Käyttäjänimi on jo käytössä' });

    user.username = username;
    await user.save();

    res.json({ username: user.username });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Käyttäjänimen vaihto epäonnistui' });
  }
});

// --- VAIHDA SÄHKÖPOSTI ---
router.patch('/email', requireAuth, validate(updateEmailSchema), async (req, res) => {
  const { email, currentPassword } = req.body;

  try {
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ error: 'Käyttäjää ei löytynyt' });

    const match = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!match) return res.status(401).json({ error: 'Väärä salasana' });

    const taken = await User.findOne({ email, _id: { $ne: user._id } });
    if (taken) return res.status(409).json({ error: 'Sähköposti on jo käytössä' });

    user.email = email;
    await user.save();

    res.json({ email: user.email });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Sähköpostin vaihto epäonnistui' });
  }
});

// --- VAIHDA SALASANA ---
router.patch('/password', requireAuth, validate(updatePasswordSchema), async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  try {
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ error: 'Käyttäjää ei löytynyt' });

    const match = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!match) return res.status(401).json({ error: 'Väärä salasana' });

    user.passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
    await user.save();

    // Uusi token, jotta vanha istunto ei jää voimaan
    const token = createToken(user._id);
    setCookie(res, token);

    res.json({ message: 'Salasana vaihdettu' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Salasanan vaihto epäonnistui' });
  }
});

// --- POISTA TILI + PELITIEDOT ---
router.delete('/account', requireAuth, validate(deleteAccountSchema), async (req, res) => {
  const { currentPassword } = req.body;

  try {
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ error: 'Käyttäjää ei löytynyt' });

    const match = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!match) return res.status(401).json({ error: 'Väärä salasana' });

    await SaveGame.deleteOne({ userId: user._id });
    await User.deleteOne({ _id: user._id });

    res.clearCookie('token');
    res.json({ message: 'Tili ja pelitiedot poistettu' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Tilin poisto epäonnistui' });
  }
});

// --- TALLENNA ÄÄNIASETUKSET ---
router.patch('/settings', requireAuth, validate(updateAudioSettingsSchema), async (req, res) => {
  const { musicVolume, sfxVolume, musicMuted, sfxMuted } = req.body;

  try {
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ error: 'Käyttäjää ei löytynyt' });

    user.audioSettings = { musicVolume, sfxVolume, musicMuted, sfxMuted };
    await user.save();

    res.json({ audioSettings: user.audioSettings });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ääniasetusten tallennus epäonnistui' });
  }
});

module.exports = router;