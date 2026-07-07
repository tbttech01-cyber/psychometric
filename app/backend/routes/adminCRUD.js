const router = require('express').Router();
const { body, query } = require('express-validator');
const { validate } = require('../middleware/validate');
const ctrl = require('../controllers/adminCRUDController');
const adminAuth = require('../middleware/adminAuth');
const { QUESTION_TYPES, DIMENSIONS } = require('../models/Question');

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
  [
    body('code').notEmpty().withMessage('Code is required.').isAlphanumeric().withMessage('Code must contain only letters and numbers.'),
    body('label').notEmpty().withMessage('Label is required.'),
  ],
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
    body('order').isInt({ min: 1 }).withMessage('Display order must be a positive number.'),
  ],
  validate, ctrl.createQuestionType
);
router.put('/question-types/:id', ctrl.updateQuestionType);
router.delete('/question-types/:id', ctrl.deleteQuestionType);

// Questions
router.get('/questions', ctrl.listQuestions);
router.get('/questions/:id', ctrl.getQuestion);
router.post('/questions',
  [
    body('typeId').notEmpty().withMessage('Category is required.'),
    body('text').notEmpty().withMessage('Question text is required.'),
    body('order').isInt({ min: 1 }).withMessage('Display order must be a positive number.'),
    body('questionType').isIn(QUESTION_TYPES).withMessage('A valid question type is required.'),
    body('dimension').isIn(DIMENSIONS).withMessage('A valid dimension is required.'),
    body('marks').isFloat({ gt: 0 }).withMessage('Marks must be a positive number.'),
    body('options').isArray({ min: 1 }).withMessage('At least one answer option is required.'),
    body('options').custom((options, { req }) => {
      const type = req.body.questionType;
      if (type === 'LIKERT_SCALE' && options.length < 5)
        throw new Error('Likert-scale questions need at least 5 scored options.');
      if (type === 'NUMERICAL_ABILITY') {
        const correctCount = options.filter((o) => o.isCorrect).length;
        if (correctCount !== 1)
          throw new Error('Select exactly one correct answer.');
      }
      return true;
    }),
  ],
  validate, ctrl.createQuestion
);
router.put('/questions/:id', ctrl.updateQuestion);
router.delete('/questions/:id', ctrl.deleteQuestion);

// Answer Options
router.get('/answer-options', [query('questionId').notEmpty()], validate, ctrl.listAnswerOptions);
router.post('/answer-options',
  [
    body('questionId').notEmpty().withMessage('Question is required.'),
    body('optionText').notEmpty().withMessage('Option text is required.'),
    body('score').isFloat().withMessage('Score must be a number.'),
    body('order').isInt({ min: 1 }).withMessage('Order must be a positive number.'),
  ],
  validate, ctrl.createAnswerOption
);
router.put('/answer-options/:id', ctrl.updateAnswerOption);
router.delete('/answer-options/:id', ctrl.deleteAnswerOption);

module.exports = router;
