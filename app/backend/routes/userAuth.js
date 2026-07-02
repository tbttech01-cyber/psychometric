const router = require('express').Router();
const { body } = require('express-validator');
const { validate } = require('../middleware/validate');
const ctrl = require('../controllers/userAuthController');
const userAuth = require('../middleware/userAuth');

router.post('/validate-code', [body('code').notEmpty()], validate, ctrl.validateCode);

router.post('/register',
  [
    body('codeId').notEmpty(),
    body('name').trim().notEmpty(),
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 6 }),
  ],
  validate,
  ctrl.register
);

router.post('/verify-otp',
  [body('email').isEmail(), body('otp').isLength({ min: 6, max: 6 }).isNumeric()],
  validate,
  ctrl.verifyOTP
);

router.post('/login',
  [body('email').isEmail(), body('password').notEmpty()],
  validate,
  ctrl.login
);

router.post('/resend-otp', [body('email').isEmail()], validate, ctrl.resendOTP);

router.post('/logout', userAuth, ctrl.logout);

module.exports = router;
