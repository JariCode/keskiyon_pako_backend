const { z } = require('zod');

const saveSchema = z.object({
  hp: z.number().min(0).max(1000),
  currentArea: z.enum([
    'asunto', 'kaytava', 'aula', 'kaupunki', 'katakombit',
    'metsa', 'mokki', 'kartano', 'hautausmaa', 'kirkko',
  ]),
  inventory: z.array(z.string()).max(50),
  zombiesKilled: z.number().int().min(0).max(9999),
  progress: z.record(z.string(), z.any()).optional(),
});

module.exports = { saveSchema };