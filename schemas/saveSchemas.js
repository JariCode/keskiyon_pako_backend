const { z } = require('zod');

// Vain nämä esineet ovat olemassa pelissä. Estää mielivaltaisen inventaarion
// (esim. keksityt aseet) POST-kutsulla.
const VALID_ITEMS = ['maila', 'kirves', 'taskulamppu'];

// Vain nämä alueet ovat olemassa.
const VALID_AREAS = [
  'asunto', 'kaytava', 'aula', 'kaupunki',
  'metsa', 'mokki', 'kartano', 'hautausmaa', 'kirkko', 'katakombi',
];

// progress-objekti: sallitaan vain boolean/number/string-arvot, ei sisäkkäisiä
// objekteja tai taulukoita. Näin kantaan ei voi työntää mielivaltaista
// rakennetta, vaikka sanitize jo poistaakin $-avaimet.
const progressValue = z.union([z.boolean(), z.number(), z.string().max(100)]);

const saveSchema = z.object({
  characterName: z.string()
    .min(1, 'Hahmon nimi vaaditaan')
    .max(20, 'Hahmon nimi liian pitkä')
    .regex(/^[a-zA-ZäöåÄÖÅ0-9 _-]+$/, 'Hahmon nimessä vain kirjaimet, numerot, väli, - ja _'),
  hp: z.number().min(0).max(1000),
  currentArea: z.enum(VALID_AREAS),
  inventory: z.array(z.enum(VALID_ITEMS)).max(VALID_ITEMS.length),
  zombiesKilled: z.number().int().min(0).max(9999),
  progress: z.record(z.string().max(60), progressValue)
    .refine((obj) => Object.keys(obj).length <= 100, {
      message: 'Liian monta progress-kenttää',
    })
    .optional(),
});

module.exports = { saveSchema, VALID_ITEMS, VALID_AREAS };
