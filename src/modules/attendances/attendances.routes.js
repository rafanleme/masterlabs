const { Router } = require('express');
const authenticate = require('../../middlewares/authenticate');
const authorize    = require('../../middlewares/authorize');
const validate     = require('../../middlewares/validate');
const { createAttendanceSchema, updateAttendanceSchema, attendanceStatusSchema } = require('./attendances.validation');
const ctrl = require('./attendances.controller');

const router = Router();

router.use(authenticate);

router.post(  '/',           authorize('ADMIN', 'ANALYST'), validate(createAttendanceSchema), ctrl.create);
router.get(   '/',                                                                             ctrl.list);
router.get(   '/:id',                                                                          ctrl.getById);
router.patch( '/:id',        authorize('ADMIN', 'ANALYST'), validate(updateAttendanceSchema), ctrl.update);
router.patch( '/:id/status', authorize('ADMIN', 'ANALYST'), validate(attendanceStatusSchema), ctrl.updateStatus);
router.delete('/:id',        authorize('ADMIN'),                                               ctrl.remove);

module.exports = router;
