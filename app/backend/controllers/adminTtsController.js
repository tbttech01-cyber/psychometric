const Question = require('../models/Question');
const QuestionAudio = require('../models/QuestionAudio');
const ExplanationAudio = require('../models/ExplanationAudio');
const { synthesize, textHash, voiceForConfig, buildProsody, VOICES } = require('../utils/edgeTts');
const { explanationSpeechText } = require('../utils/tanglish');
const { getTtsConfig, setTtsConfig } = require('../utils/ttsSettings');

// GET current settings + the voice catalogue + how many questions have audio.
exports.getSettings = async (req, res, next) => {
  try {
    const config = await getTtsConfig();
    const total = await Question.countDocuments({ isActive: true });
    const withAudio = await QuestionAudio.countDocuments();
    res.json({ success: true, config, voices: VOICES, stats: { total, withAudio } });
  } catch (err) { next(err); }
};

// PUT settings (voice, speed, pitch, on/off). Only provided fields change.
exports.updateSettings = async (req, res, next) => {
  try {
    const { enabled, voiceEn, voiceTa, ratePct, pitchHz } = req.body;
    const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, Number(n)));
    const patch = {};
    if (enabled !== undefined) patch.enabled = !!enabled;
    if (voiceEn) patch.voiceEn = String(voiceEn);
    if (voiceTa) patch.voiceTa = String(voiceTa);
    if (ratePct !== undefined && !Number.isNaN(Number(ratePct))) patch.ratePct = clamp(ratePct, -50, 50);
    if (pitchHz !== undefined && !Number.isNaN(Number(pitchHz))) patch.pitchHz = clamp(pitchHz, -50, 50);
    const config = await setTtsConfig(patch);
    res.json({ success: true, config });
  } catch (err) { next(err); }
};

// GET per-question audio status: none | ready (fresh) | stale (text changed).
// Includes the SPOKEN EXPLANATION audio status for questions that have one.
exports.listStatus = async (req, res, next) => {
  try {
    const questions = await Question.find({ isActive: true }).select('_id text order explanationAudioText explanationIsTanglish').sort('order');
    const qIds = questions.map((q) => q._id);
    const [rows, exRows] = await Promise.all([
      QuestionAudio.find({ questionId: { $in: qIds } }).select('questionId textHash voice updatedAt'),
      ExplanationAudio.find({ questionId: { $in: qIds } }).select('questionId textHash voice'),
    ]);
    const byId = {}; rows.forEach((r) => { byId[r.questionId.toString()] = r; });
    const exById = {}; exRows.forEach((r) => { exById[r.questionId.toString()] = r; });
    const data = questions.map((q) => {
      const r = byId[q._id.toString()];
      const status = !r ? 'none' : (r.textHash === textHash(q.text) ? 'ready' : 'stale');
      const speech = explanationSpeechText(q);
      const er = exById[q._id.toString()];
      const explanationStatus = !speech ? null : (!er ? 'none' : (er.textHash === textHash(speech) ? 'ready' : 'stale'));
      return {
        _id: q._id, order: q.order, text: q.text, status, voice: r ? r.voice : null,
        hasExplanation: !!speech, explanationIsTanglish: !!q.explanationIsTanglish,
        explanationStatus, explanationVoice: er ? er.voice : null,
      };
    });
    res.json({ success: true, data });
  } catch (err) { next(err); }
};

// POST generate/regenerate one question's audio with the current settings.
exports.generateOne = async (req, res, next) => {
  try {
    const q = await Question.findById(req.params.id).select('_id text');
    if (!q) return res.status(404).json({ success: false, message: 'Question not found.' });
    const config = await getTtsConfig();
    const voice = voiceForConfig(q.text, config);
    const audio = await synthesize(q.text, voice, buildProsody(config));
    const hash = textHash(q.text);
    await QuestionAudio.findOneAndUpdate(
      { questionId: q._id },
      { questionId: q._id, textHash: hash, voice, lang: voice.slice(0, 5), contentType: 'audio/mpeg', audio },
      { upsert: true }
    );
    res.json({ success: true, voice, bytes: audio.length });
  } catch (err) {
    // A synthesis failure (unofficial endpoint hiccup) shouldn't 500 the admin UI.
    res.status(502).json({ success: false, message: `Voice generation failed: ${(err && err.message) || err}` });
  }
};

// GET the cached mp3 for admin preview.
exports.previewAudio = async (req, res, next) => {
  try {
    const cached = await QuestionAudio.findOne({ questionId: req.params.id }).select('audio contentType');
    if (!cached || !cached.audio) return res.status(404).json({ success: false, message: 'No audio generated yet.' });
    res.set('Content-Type', cached.contentType || 'audio/mpeg');
    res.set('Cache-Control', 'no-store');
    return res.send(cached.audio);
  } catch (err) { next(err); }
};

// DELETE a question's cached audio (revert it to browser speech).
exports.deleteOne = async (req, res, next) => {
  try {
    await QuestionAudio.deleteOne({ questionId: req.params.id });
    res.json({ success: true });
  } catch (err) { next(err); }
};

// POST generate/regenerate one question's SPOKEN EXPLANATION audio. Tanglish
// explanations are transliterated to Tamil first (explanationSpeechText), then
// synthesized — so a Tamil neural voice reads them correctly on every device,
// independent of the candidate's installed voices.
exports.generateExplanation = async (req, res, next) => {
  try {
    const q = await Question.findById(req.params.id).select('_id explanationAudioText explanationIsTanglish');
    if (!q) return res.status(404).json({ success: false, message: 'Question not found.' });
    const speech = explanationSpeechText(q);
    if (!speech) return res.status(400).json({ success: false, message: 'This question has no spoken explanation to generate.' });
    const config = await getTtsConfig();
    const voice = voiceForConfig(speech, config);
    const audio = await synthesize(speech, voice, buildProsody(config));
    await ExplanationAudio.findOneAndUpdate(
      { questionId: q._id },
      { questionId: q._id, textHash: textHash(speech), voice, lang: voice.slice(0, 5), contentType: 'audio/mpeg', audio },
      { upsert: true }
    );
    res.json({ success: true, voice, bytes: audio.length });
  } catch (err) {
    res.status(502).json({ success: false, message: `Voice generation failed: ${(err && err.message) || err}` });
  }
};

// GET the cached explanation mp3 for admin preview.
exports.previewExplanation = async (req, res, next) => {
  try {
    const cached = await ExplanationAudio.findOne({ questionId: req.params.id }).select('audio contentType');
    if (!cached || !cached.audio) return res.status(404).json({ success: false, message: 'No explanation audio generated yet.' });
    res.set('Content-Type', cached.contentType || 'audio/mpeg');
    res.set('Cache-Control', 'no-store');
    return res.send(cached.audio);
  } catch (err) { next(err); }
};

// DELETE a question's cached explanation audio (revert to browser speech).
exports.deleteExplanation = async (req, res, next) => {
  try {
    await ExplanationAudio.deleteOne({ questionId: req.params.id });
    res.json({ success: true });
  } catch (err) { next(err); }
};
