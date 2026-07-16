const express = require('express');
const router = express.Router();

const SaveGame = require('../models/SaveGame');
const requireAuth = require('../middleware/requireAuth');
const validate = require('../middleware/validate');
const { saveSchema } = require('../schemas/saveSchemas');
const { calculateLevel, calculateMaxHP } = require('../utils/gameRules');

const MAX_KILLS_PER_SAVE = 20;
const MIN_SAVE_INTERVAL_MS = 2000;

router.use(requireAuth);

router.get('/', async (req, res) => {
  const save = await SaveGame.findOne({ userId: req.userId });

  if (!save) {
    return res.json(null);
  }

  const level = calculateLevel(save.zombiesKilled);
  const maxHP = calculateMaxHP(level);

  res.json({
    ...save.toObject(),
    level,
    maxHP,
  });
});

router.post('/', validate(saveSchema), async (req, res) => {
  const { hp, currentArea, inventory, zombiesKilled, progress } = req.body;

  try {
    const existing = await SaveGame.findOne({ userId: req.userId });

    if (existing && Date.now() - existing.lastSaveTimestamp.getTime() < MIN_SAVE_INTERVAL_MS) {
      return res.status(429).json({ error: 'Tallennat liian usein, odota hetki' });
    }

    if (existing && zombiesKilled < existing.zombiesKilled) {
      return res.status(400).json({ error: 'Virheellinen tallennus: tapettujen määrä ei voi vähentyä' });
    }

    const killDelta = existing ? zombiesKilled - existing.zombiesKilled : zombiesKilled;
    if (killDelta > MAX_KILLS_PER_SAVE) {
      return res.status(400).json({ error: 'Virheellinen tallennus: epärealistinen edistyminen' });
    }

    const level = calculateLevel(zombiesKilled);
    const maxHP = calculateMaxHP(level);
    const clampedHP = Math.min(hp, maxHP);

    const save = await SaveGame.findOneAndUpdate(
      { userId: req.userId },
      {
        hp: clampedHP,
        currentArea,
        inventory,
        zombiesKilled,
        progress,
        lastSaveTimestamp: Date.now(),
        updatedAt: Date.now(),
      },
      { upsert: true, new: true }
    );

    res.json({
      ...save.toObject(),
      level,
      maxHP,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Tallennus epäonnistui' });
  }
});

module.exports = router;