const { Router } = require('express');
const validate = require('../../middlewares/validate');
const authenticate = require('../../middlewares/authenticate');
const { loginSchema } = require('./auth.validation');
const { loginHandler, meHandler } = require('./auth.controller');

const router = Router();

router.post('/login', validate(loginSchema), loginHandler);
router.get('/me', authenticate, meHandler);

module.exports = router;
