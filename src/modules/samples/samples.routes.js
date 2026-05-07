const { Router } = require('express');
const authenticate = require('../../middlewares/authenticate');
const authorize    = require('../../middlewares/authorize');
const validate     = require('../../middlewares/validate');
const { createSampleSchema, updateSampleSchema, sampleStatusSchema } = require('./samples.validation');
const ctrl = require('./samples.controller');

const router = Router();

router.use(authenticate);

router.post(  '/',           authorize('ADMIN', 'ANALYST'), validate(createSampleSchema), ctrl.create);
router.get(   '/',                                                                         ctrl.list);
router.get(   '/:id',                                                                      ctrl.getById);
router.patch( '/:id',        authorize('ADMIN', 'ANALYST'), validate(updateSampleSchema), ctrl.update);
router.patch( '/:id/status', authorize('ADMIN', 'ANALYST'), validate(sampleStatusSchema), ctrl.updateStatus);
router.delete('/:id',        authorize('ADMIN'),                                           ctrl.remove);

module.exports = router;
