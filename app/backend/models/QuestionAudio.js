const mongoose = require('mongoose');

// Cached neural TTS audio for a question, generated once by
// scripts/generateQuestionAudio.js and served by GET
// /api/v1/assessment/questions/:id/audio. `textHash` records the text the audio
// was generated from, so stale audio (question text later edited) is detected
// and the candidate transparently falls back to browser speech until the script
// is re-run.
const questionAudioSchema = new mongoose.Schema({
  questionId:  { type: mongoose.Schema.Types.ObjectId, ref: 'Question', required: true, unique: true },
  textHash:    { type: String, required: true },
  voice:       { type: String, required: true },
  lang:        { type: String, required: true },
  contentType: { type: String, default: 'audio/mpeg' },
  audio:       { type: Buffer, required: true },
}, { timestamps: true });

module.exports = mongoose.model('QuestionAudio', questionAudioSchema);
