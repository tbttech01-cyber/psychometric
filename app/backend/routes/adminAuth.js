const router = require('express').Router();
const { body } = require('express-validator');
const { validate } = require('../middleware/validate');
const ctrl = require('../controllers/adminAuthController');
const adminAuth = require('../middleware/adminAuth');

router.post('/login',
  [body('email').isEmail(), body('password').notEmpty()],
  validate,
  ctrl.login
);

router.post('/logout', adminAuth, ctrl.logout);
router.get('/profile', adminAuth, ctrl.getProfile);
router.post('/change-password',
  adminAuth,
  [body('currentPassword').notEmpty(), body('newPassword').isLength({ min: 6 })],
  validate,
  ctrl.changePassword
);

module.exports = router;
