const express = require('express');
const router = express.Router();

const SaveGame = require('../models/SaveGame');
const requireAuth = require('../middleware/requireAuth');

router.use(requireAuth);

router.get('/', async (req, res) => {
  const save = await SaveGame.findOne({ userId: req.userId });
  res.json(save || null);
});

router.post('/', async (req, res) => {
  const { hp, currentArea, inventory, zombiesKilled, progress } = req.body;

  const save = await SaveGame.findOneAndUpdate(
    { userId: req.userId },
    { hp, currentArea, inventory, zombiesKilled, progress, updatedAt: Date.now() },
    { upsert: true, new: true }
  );

  res.json(save);
});

module.exports = router;