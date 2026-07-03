const router = require('express').Router();
const { body } = require('express-validator');
const { validate } = require('../middleware/validate');
const ctrl = require('../controllers/adminBusinessMatrixController');
const adminAuth = require('../middleware/adminAuth');

router.use(adminAuth);

router.get('/business-matrix', ctrl.getMatrix);
router.post('/business-matrix',
  [
    body('rowTypeId').notEmpty(),
    body('colTypeId').notEmpty(),
    body('businessName').notEmpty(),
    body('rating').isInt({ min: 1, max: 5 }),
  ],
  validate, ctrl.createCell
);
router.put('/business-matrix/:id', ctrl.updateCell);
router.delete('/business-matrix/:id', ctrl.deleteCell);

module.exports = router;
