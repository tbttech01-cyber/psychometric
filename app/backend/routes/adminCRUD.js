const router = require('express').Router();
const { body, query } = require('express-validator');
const { validate } = require('../middleware/validate');
const ctrl = require('../controllers/adminCRUDController');
const adminAuth = require('../middleware/adminAuth');

router.use(adminAuth);

// Users
router.get('/users', ctrl.listUsers);
router.get('/users/generate-candidate-id', ctrl.generateCandidateId);
router.post('/users',
  [
    body('name').notEmpty().withMessage('Name is required.'),
    body('email').isEmail().withMessage('A valid email address is required.'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters.'),
    body('sharedCode').notEmpty().withMessage('Access code is required.'),
  ],
  validate, ctrl.createUser
);
router.delete('/users/:id', ctrl.deleteUser);

// Shared User IDs
router.get('/shared-ids', ctrl.listSharedIDs);
router.post('/shared-ids',
  [body('code').notEmpty().isAlphanumeric(), body('label').notEmpty()],
  validate, ctrl.createSharedID
);
router.put('/shared-ids/:id', ctrl.updateSharedID);
router.delete('/shared-ids/:id', ctrl.deleteSharedID);
router.get('/shared-ids/:id/stats', ctrl.sharedIDStats);

// Question Types
router.get('/question-types', ctrl.listQuestionTypes);
router.post('/question-types',
  [
    body('name').notEmpty().withMessage('Category name is required.'),
    body('order').isInt({ min: 1, max: 8 }).withMessage('Display order must be a number from 1 to 8.'),
  ],
  validate, ctrl.createQuestionType
);
router.put('/question-types/:id', ctrl.updateQuestionType);
router.delete('/question-types/:id', ctrl.deleteQuestionType);

// Questions
router.get('/questions', ctrl.listQuestions);
router.get('/questions/:id', ctrl.getQuestion);
router.post('/questions',
  [body('typeId').notEmpty(), body('text').notEmpty(), body('order').isInt({ min: 1, max: 40 })],
  validate, ctrl.createQuestion
);
router.put('/questions/:id', ctrl.updateQuestion);
router.delete('/questions/:id', ctrl.deleteQuestion);

// Answer Options
router.get('/answer-options', [query('questionId').notEmpty()], validate, ctrl.listAnswerOptions);
router.post('/answer-options',
  [
    body('questionId').notEmpty(),
    body('label').notEmpty(),
    body('marks').isInt({ min: 1, max: 5 }),
    body('order').isInt({ min: 1, max: 5 }),
  ],
  validate, ctrl.createAnswerOption
);
router.put('/answer-options/:id', ctrl.updateAnswerOption);
router.delete('/answer-options/:id', ctrl.deleteAnswerOption);

module.exports = router;
