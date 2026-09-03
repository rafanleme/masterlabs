const { Router } = require('express');
const authenticate = require('../../middlewares/authenticate');
const ctrl = require('./stats.controller');

const router = Router();

router.use(authenticate);

router.get('/overview', ctrl.overview);

module.exports = router;
