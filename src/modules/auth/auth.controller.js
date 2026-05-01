const { login, me } = require('./auth.service');

async function loginHandler(req, res, next) {
  try {
    const result = await login(req.body);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

async function meHandler(req, res, next) {
  try {
    const user = await me(req.user.userId);
    res.status(200).json(user);
  } catch (err) {
    next(err);
  }
}

module.exports = { loginHandler, meHandler };
