const { Router } = require('express');
const authenticate = require('../../middlewares/authenticate');
const authorize    = require('../../middlewares/authorize');
const validate     = require('../../middlewares/validate');
const {
  createReportSchema, updateReportSchema,
  updateReportItemSchema, reportStatusSchema,
} = require('./reports.validation');
const ctrl    = require('./reports.controller');
const pdfCtrl = require('./pdf/pdf.controller');

const router = Router();

router.use(authenticate);

router.post(  '/',                        authorize('ADMIN', 'ANALYST'), validate(createReportSchema),     ctrl.create);
router.get(   '/',                                                                                          ctrl.list);
router.get(   '/:id',                                                                                       ctrl.getById);
router.patch( '/:id',                     authorize('ADMIN', 'ANALYST'), validate(updateReportSchema),     ctrl.update);
router.patch( '/:id/items/:assayId',      authorize('ADMIN', 'ANALYST'), validate(updateReportItemSchema), ctrl.updateItem);
router.patch( '/:id/status',              authorize('ADMIN', 'ANALYST'), validate(reportStatusSchema),     ctrl.updateStatus);
router.delete('/:id',                     authorize('ADMIN'),                                               ctrl.remove);

router.post(  '/:id/pdf',                 authorize('ADMIN', 'ANALYST'),                                    pdfCtrl.generate);
router.get(   '/:id/pdf-artifacts',                                                                         pdfCtrl.listVersions);
router.get(   '/:id/pdf',                                                                                   pdfCtrl.download);

module.exports = router;
