const router = require('express').Router();
const { body } = require('express-validator');
const { validate } = require('../middleware/validate');
const ctrl = require('../controllers/assessmentController');
const userAuth = require('../middleware/userAuth');

router.get('/questions', userAuth, ctrl.getQuestions);
router.post('/start', userAuth, ctrl.startSession);

router.post('/submit',
  userAuth,
  [
    body('sessionId').notEmpty(),
    body('answers').isArray({ min: 1 }),
    body('answers.*.questionId').notEmpty(),
    body('answers.*.answerOptionId').notEmpty(),
  ],
  validate,
  ctrl.submitAssessment
);

router.get('/result', userAuth, ctrl.getResult);

module.exports = router;
