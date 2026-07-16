function validate(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({
        error: 'Virheellinen syöte',
        details: result.error.issues.map((i) => i.message),
      });
    }
    req.body = result.data;
    next();
  };
}

module.exports = validate;