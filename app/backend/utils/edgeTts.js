// Free neural text-to-speech via Microsoft Edge's read-aloud voices (msedge-tts).
// No API key / credit card — an unofficial Microsoft endpoint. We only ever call
// it from the offline generation script (scripts/generateQuestionAudio.js), NOT
// from the request path, and cache the result in the DB (QuestionAudio), so the
// serverless runtime never depends on it and generation happens once per text.
const { MsEdgeTTS, OUTPUT_FORMAT } = require('msedge-tts');
const crypto = require('crypto');

// Warm, natural neural voices. Overridable via env if you prefer others.
const EN_VOICE = process.env.TTS_EN_VOICE || 'en-US-AriaNeural';
const TA_VOICE = process.env.TTS_TA_VOICE || 'ta-IN-PallaviNeural';

// Tamil text lives in the U+0B80–U+0BFF block; anything else reads as English.
const isTamil = (text) => /[஀-௿]/.test(text || '');
const voiceFor = (text) => (isTamil(text) ? TA_VOICE : EN_VOICE);
const textHash = (text) => crypto.createHash('sha256').update(String(text || '')).digest('hex');

// Synthesize `text` to an mp3 Buffer. A slightly slower rate reads calmer/clearer.
async function synthesize(text, voice, { rate = '-6%', pitch = '+0Hz' } = {}) {
  const tts = new MsEdgeTTS();
  await tts.setMetadata(voice, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);
  const { audioStream } = tts.toStream(text, { rate, pitch });
  const chunks = [];
  await new Promise((resolve, reject) => {
    audioStream.on('data', (c) => chunks.push(c));
    audioStream.on('end', resolve);
    audioStream.on('error', reject);
    setTimeout(() => reject(new Error('edge-tts timeout')), 20000);
  });
  return Buffer.concat(chunks);
}

module.exports = { voiceFor, textHash, synthesize, EN_VOICE, TA_VOICE };
