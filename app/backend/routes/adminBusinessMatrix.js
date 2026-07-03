const router = require('express').Router();
const { body } = require('express-validator');
const { validate } = require('../middleware/validate');
const ctrl = require('../controllers/adminBusinessMatrixController');
const adminAuth = require('../middleware/adminAuth');

router.use(adminAuth);

router.get('/business-matrix', ctrl.getMatrix);
router.post('/business-matrix',
  [
    body('rowTypeId').notEmpty().withMessage('Row category is required.'),
    body('colTypeId').notEmpty().withMessage('Column category is required.'),
    body('businessName').notEmpty().withMessage('Business/role name is required.').isLength({ max: 80 }).withMessage('Business/role name must be 80 characters or fewer.'),
    body('rating').isInt({ min: 1, max: 5 }).withMessage('Rating must be a number from 1 to 5.'),
  ],
  validate, ctrl.createCell
);
router.put('/business-matrix/:id', ctrl.updateCell);
router.delete('/business-matrix/:id', ctrl.deleteCell);

module.exports = router;
