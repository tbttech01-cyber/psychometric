// Rule-based Tanglish (romanized Tamil) -> Tamil script transliterator, used
// server-side when generating neural audio for a Tanglish spoken explanation so
// a Tamil neural voice can read it. Longest-match: consonant+vowel -> consonant
// letter + matra; a bare consonant gets pulli (்); a standalone vowel uses its
// independent letter; characters already in Tamil / punctuation pass through.
// Romanization is inherently ambiguous, so output is approximate by design.
// NOTE: kept byte-for-byte in sync with the copy in frontend/user/assessment.html
// (the browser has no module system to share it) — edit both together.
const VOWELS = [['au', 'ஔ', 'ௌ'], ['ai', 'ஐ', 'ை'], ['aa', 'ஆ', 'ா'], ['ee', 'ஏ', 'ே'], ['ii', 'ஈ', 'ீ'], ['oo', 'ஓ', 'ோ'], ['uu', 'ஊ', 'ூ'], ['a', 'அ', ''], ['i', 'இ', 'ி'], ['u', 'உ', 'ு'], ['e', 'எ', 'ெ'], ['o', 'ஒ', 'ொ']];
const CONS = [['ng', 'ங'], ['nj', 'ஞ'], ['ch', 'ச'], ['sh', 'ஷ'], ['zh', 'ழ'], ['th', 'த'], ['dh', 'த'], ['kh', 'க'], ['gh', 'க'], ['ph', 'ப'], ['bh', 'ப'], ['k', 'க'], ['g', 'க'], ['c', 'ச'], ['j', 'ஜ'], ['t', 'ட'], ['d', 'ட'], ['n', 'ந'], ['p', 'ப'], ['b', 'ப'], ['m', 'ம'], ['y', 'ய'], ['r', 'ர'], ['l', 'ல'], ['v', 'வ'], ['w', 'வ'], ['s', 'ஸ'], ['h', 'ஹ'], ['f', 'ஃப'], ['x', 'க்ஸ'], ['q', 'க']];
const PULLI = '்';

function tanglishToTamil(input) {
  const src = String(input || '');
  const s = src.toLowerCase();
  const isTa = (ch) => ch >= '஀' && ch <= '௿';
  const matchAt = (arr, pos) => { for (const e of arr) if (s.startsWith(e[0], pos)) return e; return null; };
  let out = '', i = 0;
  while (i < s.length) {
    if (isTa(src[i])) { out += src[i]; i++; continue; }
    const c = matchAt(CONS, i);
    if (c) { i += c[0].length; const v = matchAt(VOWELS, i); if (v) { out += c[1] + v[2]; i += v[0].length; } else out += c[1] + PULLI; continue; }
    const v = matchAt(VOWELS, i);
    if (v) { out += v[1]; i += v[0].length; continue; }
    out += src[i]; i++;
  }
  return out;
}

// The exact text a question's spoken explanation should be synthesized/spoken
// from: transliterated to Tamil when it's flagged Tanglish, otherwise as-is.
function explanationSpeechText(question) {
  const raw = (question && question.explanationAudioText ? String(question.explanationAudioText) : '').trim();
  if (!raw) return '';
  return question.explanationIsTanglish ? tanglishToTamil(raw) : raw;
}

module.exports = { tanglishToTamil, explanationSpeechText };
