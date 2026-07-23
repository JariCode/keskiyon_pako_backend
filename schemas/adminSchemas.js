const { z } = require('zod');

const changeRoleSchema = z.object({
  role: z.enum(['user', 'admin'], {
    errorMap: () => ({ message: 'Roolin on oltava user tai admin' }),
  }),
});

module.exports = {
  changeRoleSchema,
};
