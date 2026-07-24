const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const router = express.Router();

const User = require('../models/User');
const SaveGame = require('../models/SaveGame');
const validate = require('../middleware/validate');
const requireAuth = require('../middleware/requireAuth');
const writeLog = require('../utils/writeLog');
const {
  registerSchema,
  loginSchema,
  updateUsernameSchema,
  updateEmailSchema,
  updatePasswordSchema,
  deleteAccountSchema,
} = require('../schemas/authSchemas');

const SALT_ROUNDS = 12;

// Tilin lukitus: näin monta peräkkäistä epäonnistunutta kirjautumista ennen
// lukitusta, ja lukituksen kesto. Suojaa hajautetulta salasana-arvailulta
// (IP-pohjainen rate limit ei auta jos hyökkääjällä on monta IP:tä).
const MAX_FAILED_LOGINS = 5;
const LOCK_DURATION_MS = 15 * 60 * 1000;

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
    // Yhtenäinen viesti molemmista: ei paljasteta kummasta kentästä on kyse,
    // jolloin sähköpostin olemassaoloa ei voi selvittää kokeilemalla.
    const existing = await User.findOne({ $or: [{ email }, { username }] });
    if (existing) {
      return res.status(409).json({ error: 'Käyttäjänimi tai sähköposti on jo käytössä' });
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const user = await User.create({ username, email, passwordHash });

    const token = createToken(user._id);
    setCookie(res, token);

    await writeLog({
      actor: user,
      action: 'register',
      description: `${user.username} rekisteröityi käyttäjäksi`,
      req,
    });

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
      // Sama viesti kuin väärällä salasanalla, jottei paljasteta onko
      // sähköposti olemassa (käyttäjien luettelointi estetty).
      return res.status(401).json({ error: 'Virheellinen sähköposti tai salasana' });
    }

    // Onko tili lukittu liian monen epäonnistuneen yrityksen takia?
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      return res.status(423).json({
        error: 'Tili on lukittu liian monen epäonnistuneen kirjautumisen takia. Yritä myöhemmin uudelleen.',
      });
    }

    const match = await bcrypt.compare(password, user.passwordHash);
    if (!match) {
      user.failedLoginAttempts = (user.failedLoginAttempts || 0) + 1;

      if (user.failedLoginAttempts >= MAX_FAILED_LOGINS) {
        user.lockedUntil = new Date(Date.now() + LOCK_DURATION_MS);
        user.failedLoginAttempts = 0;
        await user.save();

        await writeLog({
          actor: user,
          action: 'account_locked',
          description: `${user.username} tili lukittiin ${MAX_FAILED_LOGINS} epäonnistuneen kirjautumisen jälkeen`,
          req,
        });

        return res.status(423).json({
          error: 'Tili on lukittu liian monen epäonnistuneen kirjautumisen takia. Yritä myöhemmin uudelleen.',
        });
      }

      await user.save();

      await writeLog({
        actor: user,
        action: 'login_failed',
        description: `${user.username} epäonnistunut kirjautumisyritys (${user.failedLoginAttempts}/${MAX_FAILED_LOGINS})`,
        req,
      });

      return res.status(401).json({ error: 'Virheellinen sähköposti tai salasana' });
    }

    // Onnistunut kirjautuminen: nollaa laskurit
    if (user.failedLoginAttempts > 0 || user.lockedUntil) {
      user.failedLoginAttempts = 0;
      user.lockedUntil = null;
      await user.save();
    }

    const token = createToken(user._id);
    setCookie(res, token);

    await writeLog({
      actor: user,
      action: 'login',
      description: `${user.username} kirjautui sisään`,
      req,
    });

    res.json({ username: user.username });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Kirjautuminen epäonnistui' });
  }
});

// --- ULOSKIRJAUTUMINEN ---
// EI requireAuth: eväste on tyhjennettävä myös silloin kun token on
// vanhentunut tai käyttäjä poistettu — muuten käyttäjä jäisi jumiin tilaan
// jossa uloskirjautuminen palauttaa 401 eikä eväste poistu. Token luetaan
// silti jos se on kelvollinen, jotta tiedämme kuka kirjautui ulos.
router.post('/logout', async (req, res) => {
  try {
    const token = req.cookies.token;
    if (token) {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.userId).select('username role');
      if (user) {
        await writeLog({
          actor: user,
          action: 'logout',
          description: `${user.username} kirjautui ulos`,
          req,
        });
      }
    }
  } catch (err) {
    // Vanhentunut/virheellinen token: ei lokitusta, mutta eväste silti pois.
  }
  res.clearCookie('token');
  res.json({ message: 'Uloskirjautuminen onnistui' });
});

// --- NYKYINEN KÄYTTÄJÄ ---
router.get('/me', requireAuth, async (req, res) => {
  const user = await User.findById(req.userId).select('username email role');
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

    const oldUsername = user.username;
    user.username = username;
    await user.save();

    // Uusi token, samoin kuin salasanan ja sähköpostin vaihdossa.
    const token = createToken(user._id);
    setCookie(res, token);

    await writeLog({
      actor: user,
      action: 'username_change',
      description: `${oldUsername} vaihtoi käyttäjätunnuksen: ${oldUsername} -> ${username}`,
      meta: { oldUsername, newUsername: username },
      req,
    });

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

    const oldEmail = user.email;
    user.email = email;
    await user.save();

    // Uusi token samoin kuin salasanan vaihdossa: jos istunto on kaapattu ja
    // hyökkääjä vaihtaa sähköpostin, vanhat istunnot eivät jää voimaan.
    const token = createToken(user._id);
    setCookie(res, token);

    await writeLog({
      actor: user,
      action: 'email_change',
      description: `${user.username} vaihtoi sähköpostin: ${oldEmail} -> ${email}`,
      meta: { oldEmail, newEmail: email },
      req,
    });

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

    await writeLog({
      actor: user,
      action: 'password_change',
      description: `${user.username} vaihtoi salasanansa`,
      req,
    });

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

    // ESTO: admin ei voi poistaa itseään myöskään profiilisivulta
    if (user.role === 'admin') {
      return res.status(400).json({
        error: 'Ylläpitäjä ei voi poistaa omaa tiliään. Pyydä toista ylläpitäjää poistamaan tunnuksesi.',
      });
    }

    await writeLog({
      actor: user,
      action: 'account_delete',
      description: `${user.username} poisti oman tilinsä`,
      req,
    });

    await SaveGame.deleteOne({ userId: user._id });
    await User.deleteOne({ _id: user._id });

    res.clearCookie('token');
    res.json({ message: 'Tili ja pelitiedot poistettu' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Tilin poisto epäonnistui' });
  }
});

module.exports = router;