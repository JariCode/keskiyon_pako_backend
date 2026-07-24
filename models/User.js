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
  role: {
    type: String,
    enum: ['user', 'admin'],
    default: 'user',
  },
  // Tilin lukitus: peräkkäiset epäonnistuneet kirjautumiset. Rate limit
  // kohdistuu IP:hen, tämä kohdistuu tiliin — suojaa hajautetulta
  // salasana-arvailulta (sama tili, monta IP:tä).
  failedLoginAttempts: {
    type: Number,
    default: 0,
  },
  lockedUntil: {
    type: Date,
    default: null,
  },
  // Ääniasetukset seuraavat käyttäjää laitteesta toiseen.
  audioSettings: {
    musicVolume: { type: Number, default: 0.7, min: 0, max: 1 },
    sfxVolume: { type: Number, default: 0.5, min: 0, max: 1 },
    musicMuted: { type: Boolean, default: false },
    sfxMuted: { type: Boolean, default: false },
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('User', userSchema);