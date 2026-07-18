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

// --- Autonomous language detection -----------------------------------------
// Romanized text is Tanglish (Tamil in English letters) or English? Both use
// the Latin alphabet, so we score Tamil signal words/suffixes/letter-patterns
// against common English stop-words. Heuristic and approximate by nature.
// NOTE: kept in sync with the copy in frontend/user/assessment.html.
const TANGLISH_LEX = new Set('unga ungal ungala ungaluku ungalukku ungaloda naan nee neenga ninga avan ava avanga avaru naanga naama namma namba idhu adhu ithu athu indha intha andha enna yaar yaaru eppadi epdi ippadi appadi panna pannu pannunga pannanum pandrom seyya seyyanum sollu sollavum solli sonna kelvi bathil pathil badhil romba konjam illa illai irukku iruku unda aana aanaal aanalum venum vendum theriyum puriyum padi padikka padichu padikkanum kooda mattum ellam ella ellaam oru rendu moonu naalu nalla seri sari vanakkam nandri anbu kashtam kashtamana moolam moolama mudiyum mudiyathu aagum aachu vaanga ponga irunga kudunga kaatunga ninaivu yosanai yosichu therinjukonga therinjukanum'.split(/\s+/));
const TANGLISH_SUFFIX = ['nga', 'kku', 'ku', 'nu', 'la', 'um', 'dhu', 'dham', 'aana', 'aachu', 'anum', 'avum', 'itten', 'ittu', 'kanum', 'kuthu'];
const ENGLISH_STOP = new Set('the a an is am are was were be been being to of in on at for and or but with you your yours i we they he she it this that these those how what why when where which who will would can could should shall may might must do does did done read each option pick closest handle customer complaint question checks check respond answer choose select following apply all best most from about into over under please note here there than then them their our have has had not no yes if else while because so such very more less first second third only also just like get got make made take give given use used word meaning sentence passage correct below'.split(/\s+/));

function detectTanglish(text) {
  const s = String(text || '').toLowerCase();
  if (!s.trim() || /[஀-௿]/.test(s)) return false; // empty or already Tamil script
  const words = s.split(/[^a-z]+/).filter((w) => w.length > 1);
  if (words.length < 2) return false;
  let ta = 0, en = 0;
  for (const w of words) {
    if (ENGLISH_STOP.has(w)) { en += 1; continue; }
    if (TANGLISH_LEX.has(w)) { ta += 2; continue; }
    if (TANGLISH_SUFFIX.some((suf) => w.length > suf.length + 1 && w.endsWith(suf))) { ta += 1; continue; }
    if (/zh|kk|tt|pp|nn|dh|ng|aa|oo/.test(w)) ta += 0.5;
  }
  return ta > en && ta >= words.length * 0.35;
}

// Is a question's spoken explanation Tamil (either way it should get a Tamil
// voice)? True when flagged Tanglish, when written in Tamil script, or when
// auto-detected as Tanglish.
function explanationIsTamil(question) {
  const raw = (question && question.explanationAudioText ? String(question.explanationAudioText) : '').trim();
  if (!raw) return false;
  if (/[஀-௿]/.test(raw)) return true;
  return !!(question.explanationIsTanglish) || detectTanglish(raw);
}

// The exact text a question's spoken explanation should be synthesized/spoken
// from: transliterated to Tamil when it's Tanglish (flagged OR auto-detected),
// otherwise as-is. Language/voice is thus assigned autonomously.
function explanationSpeechText(question) {
  const raw = (question && question.explanationAudioText ? String(question.explanationAudioText) : '').trim();
  if (!raw) return '';
  if (/[஀-௿]/.test(raw)) return raw; // already Tamil script
  const treatAsTanglish = !!(question.explanationIsTanglish) || detectTanglish(raw);
  return treatAsTanglish ? tanglishToTamil(raw) : raw;
}

module.exports = { tanglishToTamil, detectTanglish, explanationIsTamil, explanationSpeechText };
