const router = require('express').Router();
const { body } = require('express-validator');
const { validate } = require('../middleware/validate');
const ctrl = require('../controllers/adminQuestionSetsController');
const adminAuth = require('../middleware/adminAuth');

router.use(adminAuth);

// Shared by create and update — a set's shape rules hold on every save. The
// questionIds array order IS the per-set question order, so reordering is
// just a PUT with the array in a new sequence (no separate reorder route).
const setValidators = [
  body('name').notEmpty().withMessage('Set name is required.').isLength({ max: 100 }).withMessage('Set name must be 100 characters or fewer.'),
  body('durationMinutes').isInt({ min: 1 }).withMessage('Duration must be a whole number of minutes (at least 1).'),
  body('questionIds').isArray({ min: 1 }).withMessage('Select at least one question for the set.'),
  body('questionIds.*').isMongoId().withMessage('Invalid question reference.'),
];

router.get('/question-sets', ctrl.listSets);
router.get('/question-sets/:id', ctrl.getSet);
router.post('/question-sets', setValidators, validate, ctrl.createSet);
router.put('/question-sets/:id', setValidators, validate, ctrl.updateSet);
router.delete('/question-sets/:id', ctrl.deleteSet);

module.exports = router;
