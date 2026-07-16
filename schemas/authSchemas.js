const { z } = require('zod');

const registerSchema = z.object({
  username: z.string()
    .min(3, 'Käyttäjänimen on oltava vähintään 3 merkkiä')
    .max(20, 'Käyttäjänimi liian pitkä')
    .regex(/^[a-zA-ZäöåÄÖÅ0-9_]+$/, 'Vain kirjaimet (myös ä, ö, å), numerot ja alaviiva sallittu'),
  email: z.string().email('Virheellinen sähköpostiosoite'),
  password: z.string()
    .min(8, 'Salasanan on oltava vähintään 8 merkkiä')
    .regex(/[A-Z]/, 'Salasanassa oltava vähintään yksi iso kirjain')
    .regex(/[0-9]/, 'Salasanassa oltava vähintään yksi numero'),
});

const loginSchema = z.object({
  email: z.string().email('Virheellinen sähköpostiosoite'),
  password: z.string().min(1, 'Salasana vaaditaan'),
});

module.exports = { registerSchema, loginSchema };