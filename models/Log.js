const mongoose = require('mongoose');

// Lokitapahtuma. Tallennetaan sekä tekijän että kohteen nimi TEKSTINÄ
// (ei pelkkänä viittauksena), jotta loki pysyy luettavana vaikka käyttäjä
// poistettaisiin myöhemmin.
const logSchema = new mongoose.Schema({
  // Kuka teki (tekstinä + viittaus jos käyttäjä on yhä olemassa)
  actorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
  actorName: {
    type: String,
    required: true,
  },
  actorRole: {
    type: String,
    enum: ['user', 'admin'],
    default: 'user',
  },

  // Kenelle kohdistui. Jos käyttäjä teki itselleen, target on sama kuin actor.
  targetId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
  targetName: {
    type: String,
    default: null,
  },

  // Mitä tehtiin: register, login, logout, username_change, email_change,
  // password_change, account_delete, admin_delete_user, admin_change_role
  action: {
    type: String,
    required: true,
  },

  // Valmis suomenkielinen kuvaus, esim.
  // "Jari vaihtoi käyttäjätunnuksen: jari -> elmeri"
  // "Admin Jari poisti käyttäjän elmeri"
  description: {
    type: String,
    required: true,
  },

  // Vapaat lisätiedot (esim. vanha ja uusi arvo)
  meta: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
  },

  createdAt: {
    type: Date,
    default: Date.now,
    index: true,
  },
});

// Lokit säilyvät vuoden, sen jälkeen poistuvat automaattisesti
logSchema.index({ createdAt: 1 }, { expireAfterSeconds: 31536000 });

module.exports = mongoose.model('Log', logSchema);
