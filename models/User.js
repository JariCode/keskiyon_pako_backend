const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    minlength: 3,
    maxlength: 20,
  },
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
  },
  passwordHash: {
    type: String,
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  audioSettings: {
    musicVolume: { type: Number, default: 0.7, min: 0, max: 1 },
    sfxVolume: { type: Number, default: 0.5, min: 0, max: 1 },
    musicMuted: { type: Boolean, default: false },
    sfxMuted: { type: Boolean, default: false },
  },
});

module.exports = mongoose.model('User', userSchema);