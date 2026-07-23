const Log = require('../models/Log');

// Kirjoittaa lokitapahtuman. Ei koskaan kaada varsinaista toimintoa:
// jos lokitus epäonnistuu, virhe vain kirjataan konsoliin.
//
// actor  = kuka teki   { _id, username, role }
// target = kenelle     { _id, username }  (jos sama kuin actor, voi jättää pois)
async function writeLog({ actor, target, action, description, meta = {} }) {
  try {
    await Log.create({
      actorId: actor?._id || null,
      actorName: actor?.username || 'tuntematon',
      actorRole: actor?.role || 'user',
      targetId: target?._id || actor?._id || null,
      targetName: target?.username || actor?.username || null,
      action,
      description,
      meta,
    });
  } catch (err) {
    console.error('Lokitus epäonnistui:', err.message);
  }
}

module.exports = writeLog;
