module.exports = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({
      type: 'https://httpstatuses.com/400',
      title: 'Validation Error',
      status: 400,
      errors: result.error.flatten().fieldErrors,
    });
  }
  req.body = result.data;
  next();
};
