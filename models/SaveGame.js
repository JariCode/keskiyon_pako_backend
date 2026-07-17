const mongoose = require('mongoose');

const saveGameSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
  },
  characterName: { type: String, default: 'Ukko', trim: true, maxlength: 20 },
  hp: { type: Number, default: 100 },
  currentArea: { type: String, default: 'asunto' },
  inventory: { type: [String], default: [] },
  zombiesKilled: { type: Number, default: 0 },
  progress: { type: mongoose.Schema.Types.Mixed, default: {} },
  lastSaveTimestamp: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('SaveGame', saveGameSchema);