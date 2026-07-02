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

router.post('/verify-otp',
  [body('email').isEmail(), body('otp').isLength({ min: 6, max: 6 }).isNumeric()],
  validate,
  ctrl.verifyOTP
);

router.post('/logout', adminAuth, ctrl.logout);

module.exports = router;
