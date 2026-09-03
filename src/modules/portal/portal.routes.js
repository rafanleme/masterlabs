const { Router } = require('express');
const validate = require('../../middlewares/validate');
const authenticatePortal = require('../../middlewares/authenticatePortal');
const { authLimiter } = require('../../middlewares/rateLimiters');
const { requestCodeSchema, verifyCodeSchema } = require('./portal.validation');
const ctrl = require('./portal.controller');

const router = Router();

router.post('/auth/request-code', authLimiter, validate(requestCodeSchema), ctrl.requestCode);
router.post('/auth/verify',       authLimiter, validate(verifyCodeSchema),  ctrl.verifyCode);

router.get('/me',              authenticatePortal, ctrl.me);
router.get('/reports',         authenticatePortal, ctrl.listReports);
router.get('/reports/:id/pdf', authenticatePortal, ctrl.downloadPdf);

module.exports = router;
