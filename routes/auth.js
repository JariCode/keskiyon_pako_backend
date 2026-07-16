const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const router = express.Router();

const User = require('../models/User');
const validate = require('../middleware/validate');
const requireAuth = require('../middleware/requireAuth');
const { registerSchema, loginSchema } = require('../schemas/authSchemas');

const SALT_ROUNDS = 12;

function createToken(userId) {
  return jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: '7d' });
}

function setCookie(res, token) {
  res.cookie('token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
}

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

router.post('/logout', (req, res) => {
  res.clearCookie('token');
  res.json({ message: 'Uloskirjautuminen onnistui' });
});

router.get('/me', requireAuth, async (req, res) => {
  const user = await User.findById(req.userId).select('username email');
  res.json(user);
});

module.exports = router;