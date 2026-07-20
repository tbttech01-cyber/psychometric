// Free neural text-to-speech via Microsoft Edge's read-aloud voices (msedge-tts).
// No API key / credit card — an unofficial Microsoft endpoint. We only ever call
// it from the offline generation script (scripts/generateQuestionAudio.js), NOT
// from the request path, and cache the result in the DB (QuestionAudio), so the
// serverless runtime never depends on it and generation happens once per text.
const crypto = require('crypto');

// msedge-tts (and its `ws` dependency) is heavy and only needed when actually
// synthesizing — which happens on the admin "Generate" action, never on a
// normal request. Load it lazily so it stays OFF the serverless cold-start path
// (requiring this module for VOICES/textHash/etc. must stay cheap).
let _msedge = null;
function loadMsEdge() {
  if (!_msedge) _msedge = require('msedge-tts');
  return _msedge;
}

// Warm, natural neural voices. Overridable via env if you prefer others.
const EN_VOICE = process.env.TTS_EN_VOICE || 'en-US-AriaNeural';
const TA_VOICE = process.env.TTS_TA_VOICE || 'ta-IN-PallaviNeural';

// Tamil text lives in the U+0B80–U+0BFF block; anything else reads as English.
const isTamil = (text) => /[஀-௿]/.test(text || '');
const voiceFor = (text) => (isTamil(text) ? TA_VOICE : EN_VOICE);
const textHash = (text) => crypto.createHash('sha256').update(String(text || '')).digest('hex');

// Synthesize `text` to an mp3 Buffer. A slightly slower rate reads calmer/clearer.
async function synthesize(text, voice, { rate = '-6%', pitch = '+0Hz' } = {}) {
  const { MsEdgeTTS, OUTPUT_FORMAT } = loadMsEdge();
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

// Curated free neural voices (Microsoft Edge) for the admin voice picker.
const VOICES = {
  en: [
    { id: 'en-US-AriaNeural', label: 'Aria — US female, warm' },
    { id: 'en-US-JennyNeural', label: 'Jenny — US female, friendly' },
    { id: 'en-US-AnaNeural', label: 'Ana — US female, soft' },
    { id: 'en-US-GuyNeural', label: 'Guy — US male' },
    { id: 'en-GB-SoniaNeural', label: 'Sonia — UK female' },
    { id: 'en-GB-RyanNeural', label: 'Ryan — UK male' },
    { id: 'en-IN-NeerjaNeural', label: 'Neerja — India female' },
    { id: 'en-IN-PrabhatNeural', label: 'Prabhat — India male' },
  ],
  ta: [
    { id: 'ta-IN-PallaviNeural', label: 'Pallavi — Tamil female' },
    { id: 'ta-IN-ValluvarNeural', label: 'Valluvar — Tamil male' },
    { id: 'ta-LK-SaranyaNeural', label: 'Saranya — Tamil (LK) female' },
    { id: 'ta-LK-KumarNeural', label: 'Kumar — Tamil (LK) male' },
  ],
};

// Format a numeric admin config into SSML prosody strings (e.g. -6 -> '-6%').
function buildProsody({ ratePct = -6, pitchHz = 0 } = {}) {
  const sign = (n) => (Number(n) >= 0 ? `+${Number(n)}` : String(Number(n)));
  return { rate: `${sign(ratePct)}%`, pitch: `${sign(pitchHz)}Hz` };
}

// Pick the configured voice for a piece of text by its language.
function voiceForConfig(text, config = {}) {
  return isTamil(text) ? (config.voiceTa || TA_VOICE) : (config.voiceEn || EN_VOICE);
}

// Voice for the SPOKEN EXPLANATION audio: a dedicated Tamil voice (admin-set)
// for Tamil/Tanglish explanations, the English voice for English ones.
function voiceForExplanation(text, config = {}) {
  return isTamil(text) ? (config.voiceExplanation || config.voiceTa || TA_VOICE) : (config.voiceEn || EN_VOICE);
}

module.exports = { voiceFor, voiceForConfig, voiceForExplanation, textHash, synthesize, buildProsody, isTamil, VOICES, EN_VOICE, TA_VOICE };
