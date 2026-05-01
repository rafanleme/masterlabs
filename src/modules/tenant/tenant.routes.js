const { Router } = require('express');
const validate = require('../../middlewares/validate');
const { registerSchema } = require('./tenant.validation');
const { register } = require('./tenant.controller');

const router = Router();

router.post('/register', validate(registerSchema), register);

module.exports = router;
