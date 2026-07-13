/**
 * Generates neural TTS audio (free, via Microsoft Edge voices) for every active
 * question and caches it in the QuestionAudio collection. Idempotent: a question
 * whose text is unchanged since its last generation is skipped, so re-running is
 * cheap and only (re)generates new or edited questions.
 *
 * Run locally against whatever DB you point MONGO_URI at:
 *   node backend/scripts/generateQuestionAudio.js
 * For production, run it once with the prod MONGO_URI (the deployed server then
 * just serves the cached rows — it never calls the TTS endpoint itself).
 *
 * Optional flags:
 *   --force   regenerate every question even if the text is unchanged
 */
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const mongoose = require('mongoose');
const Question = require('../models/Question');
const QuestionAudio = require('../models/QuestionAudio');
const { voiceForConfig, textHash, synthesize, buildProsody } = require('../utils/edgeTts');
const { getTtsConfig } = require('../utils/ttsSettings');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function run() {
  const force = process.argv.includes('--force');
  await mongoose.connect(process.env.MONGO_URI);
  const config = await getTtsConfig(); // use the admin-configured voice/speed
  const prosody = buildProsody(config);
  const questions = await Question.find({ isActive: true }).select('_id text').sort('order');
  console.log(`Found ${questions.length} active question(s). force=${force} voices=${config.voiceEn}/${config.voiceTa} rate=${prosody.rate}`);

  let generated = 0, upToDate = 0, failed = 0;
  for (const q of questions) {
    const hash = textHash(q.text);
    const existing = await QuestionAudio.findOne({ questionId: q._id }).select('textHash');
    if (!force && existing && existing.textHash === hash) { upToDate++; continue; }
    try {
      const voice = voiceForConfig(q.text, config);
      const audio = await synthesize(q.text, voice, prosody);
      await QuestionAudio.findOneAndUpdate(
        { questionId: q._id },
        { questionId: q._id, textHash: hash, voice, lang: voice.slice(0, 5), contentType: 'audio/mpeg', audio },
        { upsert: true }
      );
      generated++;
      console.log(`  ✓ ${q._id}  ${voice}  ${audio.length} bytes`);
      await sleep(250); // be gentle on the unofficial endpoint
    } catch (e) {
      failed++;
      console.log(`  ✗ ${q._id}  ${e.message}`);
    }
  }
  console.log(`Done. generated=${generated}, up-to-date=${upToDate}, failed=${failed}`);
  await mongoose.disconnect();
}
run().catch((e) => { console.error(e); process.exit(1); });
