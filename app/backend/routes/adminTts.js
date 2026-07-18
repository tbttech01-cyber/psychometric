const router = require('express').Router();
const adminAuth = require('../middleware/adminAuth');
const ctrl = require('../controllers/adminTtsController');

// Neural-TTS voice management (admin only).
router.get('/tts/settings', adminAuth, ctrl.getSettings);
router.put('/tts/settings', adminAuth, ctrl.updateSettings);
router.get('/tts/status', adminAuth, ctrl.listStatus);
router.post('/tts/questions/:id/generate', adminAuth, ctrl.generateOne);
router.get('/tts/questions/:id/preview', adminAuth, ctrl.previewAudio);
router.delete('/tts/questions/:id', adminAuth, ctrl.deleteOne);
// Spoken-explanation neural audio (the Tanglish/Tamil "Play" fix).
router.post('/tts/questions/:id/generate-explanation', adminAuth, ctrl.generateExplanation);
router.get('/tts/questions/:id/preview-explanation', adminAuth, ctrl.previewExplanation);
router.delete('/tts/questions/:id/explanation', adminAuth, ctrl.deleteExplanation);

module.exports = router;
