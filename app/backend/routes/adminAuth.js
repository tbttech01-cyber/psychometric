const router = require('express').Router();
const { body } = require('express-validator');
const { validate } = require('../middleware/validate');
const ctrl = require('../controllers/adminAuthController');
const adminAuth = require('../middleware/adminAuth');

router.post('/login',
  [
    body('email').isEmail().withMessage('A valid email address is required.'),
    body('password').notEmpty().withMessage('Password is required.'),
  ],
  validate,
  ctrl.login
);

router.post('/logout', adminAuth, ctrl.logout);
router.get('/profile', adminAuth, ctrl.getProfile);
router.post('/change-password',
  adminAuth,
  [
    body('currentPassword').notEmpty().withMessage('Current password is required.'),
    body('newPassword').isLength({ min: 6 }).withMessage('New password must be at least 6 characters.'),
  ],
  validate,
  ctrl.changePassword
);

module.exports = router;
