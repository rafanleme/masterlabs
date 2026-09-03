const { Router } = require('express');
const authenticate = require('../../middlewares/authenticate');
const authorize = require('../../middlewares/authorize');
const validate = require('../../middlewares/validate');
const { createUserSchema, updateUserSchema } = require('./users.validation');
const ctrl = require('./users.controller');

const router = Router();

router.use(authenticate);
router.use(authorize('ADMIN'));

router.post(  '/',    validate(createUserSchema), ctrl.create);
router.get(   '/',                                ctrl.list);
router.get(   '/:id',                             ctrl.getById);
router.patch( '/:id', validate(updateUserSchema), ctrl.update);
router.delete('/:id',                             ctrl.remove);

module.exports = router;
