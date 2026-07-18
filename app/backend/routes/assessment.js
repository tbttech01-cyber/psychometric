const router = require('express').Router();
const { body } = require('express-validator');
const { validate } = require('../middleware/validate');
const ctrl = require('../controllers/assessmentController');
const userAuth = require('../middleware/userAuth');

router.get('/questions', userAuth, ctrl.getQuestions);
router.get('/questions/:id/audio', userAuth, ctrl.getQuestionAudio);
router.get('/questions/:id/explanation-audio', userAuth, ctrl.getExplanationAudio);
router.post('/start', userAuth, ctrl.startSession);

router.post('/submit',
  userAuth,
  [
    body('sessionId').notEmpty(),
    body('answers').isArray({ min: 1 }),
    body('answers.*.questionId').notEmpty(),
    // Exactly one of these three per answer, depending on question type —
    // answerOptionId (single-select), answerOptionIds (multi-select), or
    // orderedOptionIds (ranking). The controller re-validates which one is
    // actually required for that specific question's type.
    body('answers.*').custom((answer) => {
      // A timeout/skip marker (no option reference) is valid on its own —
      // it records that the candidate reached the question but didn't
      // answer it, rather than requiring a real selection.
      if (answer.status === 'timeout' || answer.status === 'skipped') return true;
      if (!answer.answerOptionId && !answer.answerOptionIds && !answer.orderedOptionIds)
        throw new Error('Each answer needs answerOptionId, answerOptionIds, orderedOptionIds, or a timeout/skipped status.');
      return true;
    }),
  ],
  validate,
  ctrl.submitAssessment
);

router.get('/result', userAuth, ctrl.getResult);
router.post('/retest/request', userAuth, ctrl.requestRetest);
router.get('/retest/my-request', userAuth, ctrl.getMyRetest);
router.get('/settings', userAuth, ctrl.getSettings);

module.exports = router;
