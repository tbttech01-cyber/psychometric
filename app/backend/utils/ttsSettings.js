// Admin-configurable neural-TTS settings, stored as one Mixed value on the
// generic Setting store (key 'tts_config'). Kept dependency-free (no msedge-tts
// import) so the candidate request path can read `enabled` cheaply.
const Setting = require('../models/Setting');

const KEY = 'tts_config';
const DEFAULTS = {
  enabled: true,                    // neural voice on/off (off -> browser speech)
  voiceEn: 'en-US-AriaNeural',      // voice for English questions
  voiceTa: 'ta-IN-PallaviNeural',   // voice for Tamil questions
  ratePct: -6,                      // speaking speed, percent (negative = slower)
  pitchHz: 0,                       // pitch offset, Hz
  // Dedicated voice + speed for the SPOKEN EXPLANATION audio (the Tanglish/Tamil
  // "Play" clip), so admins can control it independently of the question voice.
  voiceExplanation: 'ta-IN-PallaviNeural', // Tamil voice used for explanation audio
  explanationRatePct: -6,           // explanation speaking speed, percent
};

async function getTtsConfig() {
  const row = await Setting.findOne({ key: KEY });
  return { ...DEFAULTS, ...(row && row.value && typeof row.value === 'object' ? row.value : {}) };
}

async function setTtsConfig(patch) {
  const next = { ...(await getTtsConfig()), ...patch };
  await Setting.findOneAndUpdate({ key: KEY }, { key: KEY, value: next }, { upsert: true });
  return next;
}

module.exports = { getTtsConfig, setTtsConfig, DEFAULTS };
