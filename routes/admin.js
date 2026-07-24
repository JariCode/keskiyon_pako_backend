const express = require('express');
const router = express.Router();

const User = require('../models/User');
const SaveGame = require('../models/SaveGame');
const Log = require('../models/Log');
const requireAuth = require('../middleware/requireAuth');
const requireAdmin = require('../middleware/requireAdmin');
const validate = require('../middleware/validate');
const validateObjectId = require('../middleware/validateObjectId');
const mongoose = require('mongoose');
const writeLog = require('../utils/writeLog');
const { changeRoleSchema } = require('../schemas/adminSchemas');

// Kaikki tämän reitittimen polut vaativat kirjautumisen JA admin-roolin
router.use(requireAuth, requireAdmin);

// --- KÄYTTÄJÄLISTA ---
router.get('/users', async (req, res) => {
  try {
    const users = await User.find()
      .select('username email role createdAt lockedUntil failedLoginAttempts')
      .sort({ createdAt: -1 })
      .lean();

    // Merkitään kirjautunut admin, jotta frontend osaa estää itsensä
    // poistamisen/alentamisen myös käyttöliittymässä.
    const now = new Date();
    const withSelf = users.map((u) => ({
      ...u,
      isSelf: String(u._id) === String(req.adminUser._id),
      isLocked: !!(u.lockedUntil && new Date(u.lockedUntil) > now),
    }));

    res.json(withSelf);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Käyttäjien haku epäonnistui' });
  }
});

// --- LOKITAPAHTUMAT ---
// Valinnaiset query-parametrit: ?userId=... (suodata käyttäjän mukaan)
//                               ?limit=100
router.get('/logs', async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 100, 300);
    const filter = {};

    if (req.query.userId) {
      // Validoi ObjectId ennen kyselyä: virheellinen arvo aiheuttaisi
      // CastErrorin ja 500-vastauksen.
      if (!mongoose.Types.ObjectId.isValid(req.query.userId)) {
        return res.status(400).json({ error: 'Virheellinen käyttäjätunniste' });
      }
      // Näytä tapahtumat joissa käyttäjä on joko tekijä tai kohde
      filter.$or = [
        { actorId: req.query.userId },
        { targetId: req.query.userId },
      ];
    }

    const logs = await Log.find(filter)
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    res.json(logs);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Lokien haku epäonnistui' });
  }
});

// --- VAIHDA KÄYTTÄJÄN ROOLI ---
router.patch('/users/:id/role', validateObjectId('id'), validate(changeRoleSchema), async (req, res) => {
  const { role } = req.body;
  const targetId = req.params.id;

  try {
    // ESTO: admin ei voi muuttaa omaa rooliaan (ei alentaa itseään)
    if (String(targetId) === String(req.adminUser._id)) {
      return res.status(400).json({ error: 'Et voi muuttaa omaa rooliasi' });
    }

    const target = await User.findById(targetId);
    if (!target) return res.status(404).json({ error: 'Käyttäjää ei löytynyt' });

    if (target.role === role) {
      return res.status(400).json({ error: `Käyttäjällä on jo rooli ${role}` });
    }

    const oldRole = target.role;
    target.role = role;
    await target.save();

    const roleText = role === 'admin' ? 'ylläpitäjäksi' : 'peruskäyttäjäksi';
    await writeLog({
      actor: req.adminUser,
      target,
      action: 'admin_change_role',
      description: `Admin ${req.adminUser.username} muutti käyttäjän ${target.username} rooliksi ${roleText}`,
      meta: { oldRole, newRole: role },
      req,
    });

    res.json({ username: target.username, role: target.role });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Roolin vaihto epäonnistui' });
  }
});

// --- AVAA LUKITTU TILI ---
router.patch('/users/:id/unlock', validateObjectId('id'), async (req, res) => {
  try {
    const target = await User.findById(req.params.id);
    if (!target) return res.status(404).json({ error: 'Käyttäjää ei löytynyt' });

    const wasLocked = !!(target.lockedUntil && target.lockedUntil > new Date());
    if (!wasLocked && !target.failedLoginAttempts) {
      return res.status(400).json({ error: 'Tili ei ole lukittu' });
    }

    target.lockedUntil = null;
    target.failedLoginAttempts = 0;
    await target.save();

    await writeLog({
      actor: req.adminUser,
      target,
      action: 'admin_unlock_account',
      description: `Admin ${req.adminUser.username} avasi käyttäjän ${target.username} lukitun tilin`,
      req,
    });

    res.json({ username: target.username, message: 'Tili avattu' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Tilin avaus epäonnistui' });
  }
});

// --- POISTA KÄYTTÄJÄ (+ pelitiedot) ---
router.delete('/users/:id', validateObjectId('id'), async (req, res) => {
  const targetId = req.params.id;

  try {
    // ESTO: admin ei voi poistaa itseään admin-paneelista
    if (String(targetId) === String(req.adminUser._id)) {
      return res.status(400).json({ error: 'Et voi poistaa omaa tiliäsi täältä' });
    }

    const target = await User.findById(targetId);
    if (!target) return res.status(404).json({ error: 'Käyttäjää ei löytynyt' });

    const targetName = target.username;
    const targetRole = target.role;

    await SaveGame.deleteOne({ userId: target._id });
    await User.deleteOne({ _id: target._id });

    await writeLog({
      actor: req.adminUser,
      target: { _id: target._id, username: targetName },
      action: 'admin_delete_user',
      description: `Admin ${req.adminUser.username} poisti käyttäjän ${targetName}`,
      meta: { deletedRole: targetRole },
      req,
    });

    res.json({ message: `Käyttäjä ${targetName} poistettu` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Käyttäjän poisto epäonnistui' });
  }
});

module.exports = router;
