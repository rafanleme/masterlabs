const { Router } = require('express');
const authenticate = require('../../middlewares/authenticate');
const authorize    = require('../../middlewares/authorize');
const validate     = require('../../middlewares/validate');
const { createClientSchema, updateClientSchema } = require('./clients.validation');
const ctrl = require('./clients.controller');

const router = Router();

router.use(authenticate);

router.post(  '/',    authorize('ADMIN', 'ANALYST'), validate(createClientSchema), ctrl.create);
router.get(   '/',                                                                  ctrl.list);
router.get(   '/:id',                                                               ctrl.getById);
router.patch( '/:id', authorize('ADMIN', 'ANALYST'), validate(updateClientSchema), ctrl.update);
router.delete('/:id', authorize('ADMIN'),                                           ctrl.remove);

module.exports = router;
