const router = require('express').Router();
const { body, query } = require('express-validator');
const { validate } = require('../middleware/validate');
const ctrl = require('../controllers/adminCRUDController');
const adminAuth = require('../middleware/adminAuth');
const { QUESTION_TYPES, DIMENSIONS } = require('../models/Question');

const SINGLE_CORRECT_TYPES = ['NUMERICAL_ABILITY', 'PERCENTAGE_TYPE', 'PUZZLE_TYPE', 'LOGICAL_ABILITY', 'VERBAL_ABILITY', 'IMAGE_BASED'];

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
router.patch('/users/:id/verification',
  [body('isVerified').isBoolean().withMessage('isVerified must be true or false.').toBoolean()],
  validate, ctrl.setUserVerification
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
router.put('/shared-ids/:id',
  [body('questionSetId').optional({ checkFalsy: true }).isMongoId().withMessage('A valid question set is required.')],
  validate, ctrl.updateSharedID
);
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
// Shared by both create and update — a question's per-type shape rules must
// hold on every save, not just the first one.
const questionValidators = [
  body('typeId').notEmpty().withMessage('Category is required.'),
  body('text').notEmpty().withMessage('Question text is required.'),
  body('order').isInt({ min: 1 }).withMessage('Display order must be a positive number.'),
  body('questionType').isIn(QUESTION_TYPES).withMessage('A valid question type is required.'),
  body('dimension').isIn(DIMENSIONS).withMessage('A valid dimension is required.'),
  body('marks').isFloat({ gt: 0 }).withMessage('Marks must be a positive number.'),
  body('options').isArray({ min: 1 }).withMessage('At least one answer option is required.'),
  body('imageUrl').custom((imageUrl, { req }) => {
    if (req.body.questionType === 'IMAGE_BASED' && !imageUrl)
      throw new Error('Image-based questions require an image URL.');
    return true;
  }),
  // When Has Audio is on, an audio source (uploaded base64 data URI or a URL)
  // must be present. Bound the length so a runaway upload can't blow past the
  // 8mb JSON body limit — ~4.6M chars ≈ a ~3.4MB decoded file, matching the
  // client-side 3MB upload cap with headroom.
  body('audioUrl').custom((audioUrl, { req }) => {
    if (req.body.hasAudio && !audioUrl)
      throw new Error('Enable-audio questions need an uploaded audio file or URL.');
    if (audioUrl && audioUrl.length > 4_600_000)
      throw new Error('Audio file is too large. Please use a clip under 3 MB.');
    return true;
  }),
  body('options').custom((options, { req }) => {
    const type = req.body.questionType;
    if (type === 'LIKERT_SCALE' && options.length < 5)
      throw new Error('Likert-scale questions need at least 5 scored options.');

    if (SINGLE_CORRECT_TYPES.includes(type)) {
      const correctCount = options.filter((o) => o.isCorrect).length;
      if (correctCount !== 1)
        throw new Error('Select exactly one correct answer.');
    }

    if (type === 'SITUATIONAL' && !options.every((o) => o.dimensionScores && Object.keys(o.dimensionScores).length))
      throw new Error('Every situational option needs at least one dimension score.');

    if (type === 'MULTI_SELECT') {
      if (!['exact', 'partial'].includes(req.body.scoringMode))
        throw new Error('Select a scoring mode (exact or partial) for multi-select questions.');
      if (!options.some((o) => o.isCorrect))
        throw new Error('Select at least one correct answer.');
    }

    if (type === 'RANKING' && options.length < 2)
      throw new Error('Ranking questions need at least 2 items to order.');

    return true;
  }),
];

router.get('/questions', ctrl.listQuestions);
router.get('/questions/:id', ctrl.getQuestion);
router.post('/questions', questionValidators, validate, ctrl.createQuestion);
router.put('/questions/:id', questionValidators, validate, ctrl.updateQuestion);
router.delete('/questions/:id', ctrl.deleteQuestion);
router.post('/questions/reorder',
  [body('orders').isArray({ min: 1 }).withMessage('orders must be a non-empty array.')],
  validate, ctrl.reorderQuestions
);

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
