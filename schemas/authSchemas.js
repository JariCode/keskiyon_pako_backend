const { z } = require('zod');

const usernameRule = z.string()
  .min(3, 'Käyttäjänimen on oltava vähintään 3 merkkiä')
  .max(20, 'Käyttäjänimi liian pitkä')
  .regex(/^[a-zA-ZäöåÄÖÅ0-9_]+$/, 'Vain kirjaimet (myös ä, ö, å), numerot ja alaviiva sallittu');

const passwordRule = z.string()
  .min(8, 'Salasanan on oltava vähintään 8 merkkiä')
  .regex(/[A-Z]/, 'Salasanassa oltava vähintään yksi iso kirjain')
  .regex(/[0-9]/, 'Salasanassa oltava vähintään yksi numero');

const registerSchema = z.object({
  username: usernameRule,
  email: z.string().email('Virheellinen sähköpostiosoite'),
  password: passwordRule,
});

const loginSchema = z.object({
  email: z.string().email('Virheellinen sähköpostiosoite'),
  password: z.string().min(1, 'Salasana vaaditaan'),
});

const updateUsernameSchema = z.object({
  username: usernameRule,
  currentPassword: z.string().min(1, 'Nykyinen salasana vaaditaan'),
});

const updateEmailSchema = z.object({
  email: z.string().email('Virheellinen sähköpostiosoite'),
  currentPassword: z.string().min(1, 'Nykyinen salasana vaaditaan'),
});

const updatePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Nykyinen salasana vaaditaan'),
  newPassword: passwordRule,
});

const deleteAccountSchema = z.object({
  currentPassword: z.string().min(1, 'Nykyinen salasana vaaditaan'),
  confirmText: z.literal('POISTA', {
    errorMap: () => ({ message: 'Kirjoita POISTA vahvistaaksesi' }),
  }),
});

module.exports = {
  registerSchema,
  loginSchema,
  updateUsernameSchema,
  updateEmailSchema,
  updatePasswordSchema,
  deleteAccountSchema,
};