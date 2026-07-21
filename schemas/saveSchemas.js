const { z } = require('zod');

const saveSchema = z.object({
  characterName: z.string()
    .min(1, 'Hahmon nimi vaaditaan')
    .max(20, 'Hahmon nimi liian pitkä')
    .regex(/^[a-zA-ZäöåÄÖÅ0-9 _-]+$/, 'Hahmon nimessä vain kirjaimet, numerot, väli, - ja _'),
  hp: z.number().min(0).max(1000),
  currentArea: z.enum([
    'asunto', 'kaytava', 'aula', 'kaupunki',
    'metsa', 'mokki', 'kartano', 'hautausmaa', 'kirkko', 'katakombi'
  ]),
  inventory: z.array(z.string()).max(50),
  zombiesKilled: z.number().int().min(0).max(9999),
  progress: z.record(z.string(), z.any()).optional(),
});

module.exports = { saveSchema };