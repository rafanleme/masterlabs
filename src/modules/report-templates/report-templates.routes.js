const { Router } = require('express');
const authenticate = require('../../middlewares/authenticate');
const authorize    = require('../../middlewares/authorize');
const validate     = require('../../middlewares/validate');
const { createReportTemplateSchema, updateReportTemplateSchema } = require('./report-templates.validation');
const ctrl = require('./report-templates.controller');

const router = Router();

router.use(authenticate);

router.post(  '/',    authorize('ADMIN', 'ANALYST'), validate(createReportTemplateSchema), ctrl.create);
router.get(   '/',                                                                          ctrl.list);
router.get(   '/:id',                                                                       ctrl.getById);
router.patch( '/:id', authorize('ADMIN', 'ANALYST'), validate(updateReportTemplateSchema), ctrl.update);
router.delete('/:id', authorize('ADMIN'),                                                   ctrl.remove);

module.exports = router;
