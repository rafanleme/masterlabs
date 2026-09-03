const { Router } = require('express');
const authenticate = require('../../middlewares/authenticate');
const authorize = require('../../middlewares/authorize');
const ctrl = require('./audit.controller');

const router = Router();

router.use(authenticate);
router.use(authorize('ADMIN'));

router.get('/', ctrl.list);

module.exports = router;
