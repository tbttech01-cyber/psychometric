require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const mongoose = require('mongoose');
const QuestionType = require('../models/QuestionType');
const Question = require('../models/Question');
const AnswerOption = require('../models/AnswerOption');
const QuestionSet = require('../models/QuestionSet');

// ---------------------------------------------------------------------------
// Additive seed: gives the "Emotional Intelligence" and "Verbal Ability"
// dimensions real, graded questions.
//
// Why this exists: EI was being scored entirely off ONE answer option of a
// single SITUATIONAL question (its `dimensionScores`), so its dimension max was
// 5 and every candidate landed on either 0% or 100% — never anything between.
// Verbal Ability had no active questions at all. Both are declared dimensions
// (see Question.DIMENSIONS) but had no meaningful backing content.
//
// This seeder adds a small set of dedicated questions for each so the
// dimension percentage becomes a real graded score:
//   - Emotional Intelligence: 5 LIKERT_SCALE items (1..5 each) -> dim max 25.
//   - Verbal Ability: 5 VERBAL_ABILITY single-correct items (5 marks each)
//     -> dim max 25.
//
// Idempotent: questions are matched by exact text, so re-running never
// duplicates. Newly-created questions are appended to the "Default Set" (or, if
// that set is absent, to every active set) so candidates actually receive them.
// ---------------------------------------------------------------------------

const LIKERT = [
  { optionText: 'Strongly Disagree', score: 1, order: 1 },
  { optionText: 'Disagree', score: 2, order: 2 },
  { optionText: 'Neutral', score: 3, order: 3 },
  { optionText: 'Agree', score: 4, order: 4 },
  { optionText: 'Strongly Agree', score: 5, order: 5 },
];

// LIKERT items — a chosen option's `score` (1..5) IS the dimension contribution
// (see evaluationEngine.evaluateLikert); marks defaults to 5, matching the top
// option, so max per question is 5.
const EI_QUESTIONS = [
  'You are aware of your own emotions as they arise and can name what you are feeling.',
  'You stay calm and think clearly even when you feel stressed or under pressure.',
  'You can sense how other people are feeling from their tone, words, or body language.',
  'You handle criticism and conflict without becoming defensive or losing your temper.',
  'You bounce back quickly and stay motivated after a disappointment or setback.',
];

// Single-correct items (evaluateSingleCorrect): correct option -> full marks (5),
// anything else -> 0. Each contributes up to 5 to the Verbal Ability dimension.
const VERBAL_QUESTIONS = [
  {
    instructionText: 'Choose the word closest in meaning to the word in capitals.',
    text: 'ABUNDANT',
    options: [
      { optionText: 'Plentiful', isCorrect: true },
      { optionText: 'Scarce', isCorrect: false },
      { optionText: 'Fragile', isCorrect: false },
      { optionText: 'Hostile', isCorrect: false },
    ],
  },
  {
    instructionText: 'Choose the word most opposite in meaning to the word in capitals.',
    text: 'TRANSPARENT',
    options: [
      { optionText: 'Opaque', isCorrect: true },
      { optionText: 'Clear', isCorrect: false },
      { optionText: 'Visible', isCorrect: false },
      { optionText: 'Delicate', isCorrect: false },
    ],
  },
  {
    instructionText: 'Choose the correctly spelled word.',
    text: 'Which of the following is spelled correctly?',
    options: [
      { optionText: 'Accommodate', isCorrect: true },
      { optionText: 'Acommodate', isCorrect: false },
      { optionText: 'Accomodate', isCorrect: false },
      { optionText: 'Acomodate', isCorrect: false },
    ],
  },
  {
    instructionText: 'Choose the option that best fills the blank.',
    text: 'She has worked at the same firm ____ 2015.',
    options: [
      { optionText: 'since', isCorrect: true },
      { optionText: 'for', isCorrect: false },
      { optionText: 'from', isCorrect: false },
      { optionText: 'during', isCorrect: false },
    ],
  },
  {
    instructionText: 'Choose the word that best completes the sentence.',
    text: 'His argument was so ____ that no one in the room could refute it.',
    options: [
      { optionText: 'cogent', isCorrect: true },
      { optionText: 'vague', isCorrect: false },
      { optionText: 'feeble', isCorrect: false },
      { optionText: 'hollow', isCorrect: false },
    ],
  },
];

// Pick a category order for the new "Emotional Intelligence" question type,
// preferring 12 (the next slot after the 11 seeded categories) but stepping
// past anything already taken.
async function nextFreeTypeOrder(preferred = 12) {
  const taken = new Set((await QuestionType.find().select('order')).map((t) => t.order));
  let order = preferred;
  while (taken.has(order)) order++;
  return order;
}

// Question.order is globally unique. Hand out the lowest free integers from a
// base so new items sit tidily after the original seed rather than at absurd
// orders — while still guaranteeing uniqueness against every existing doc
// (active or soft-deleted).
async function makeOrderAllocator(base = 50) {
  const used = new Set((await Question.find().select('order')).map((q) => q.order));
  let cursor = base;
  return () => {
    while (used.has(cursor)) cursor++;
    used.add(cursor);
    return cursor++;
  };
}

async function seedEmotionalVerbal({ log = () => {} } = {}) {
  const summary = { eiCreated: 0, eiExisting: 0, verbalCreated: 0, verbalExisting: 0, addedToSets: [] };

  // 1. Category for Emotional Intelligence (Verbal Ability already has one).
  let eiType = await QuestionType.findOne({ name: 'Emotional Intelligence' });
  if (!eiType) {
    eiType = await QuestionType.create({
      name: 'Emotional Intelligence',
      description: 'Self-awareness, empathy, and regulation of one\'s own emotions',
      icon: '❤️', color: '#DB2777', order: await nextFreeTypeOrder(12),
    });
    log(`Created question type "Emotional Intelligence" (order ${eiType.order}).`);
  } else {
    log('Question type "Emotional Intelligence" already exists.');
  }

  const verbalType = await QuestionType.findOne({ name: 'Verbal Ability' });
  if (!verbalType) throw new Error('Expected a "Verbal Ability" question type from the base seed — run `npm run seed` first.');
  // The candidate question feed only groups questions under ACTIVE categories
  // (assessmentController.getQuestions filters QuestionType.isActive), while the
  // set snapshot counts them by Question.isActive. If the Verbal Ability
  // category is inactive, its questions would be in the set (and required at
  // submit) yet hidden from the candidate — an unsubmittable attempt. Ensure
  // it's active so the questions we add are actually shown.
  if (verbalType.isActive === false) {
    verbalType.isActive = true;
    await verbalType.save();
    log('Reactivated the "Verbal Ability" category so its questions are shown to candidates.');
  }

  const nextOrder = await makeOrderAllocator(50);
  const createdIds = [];

  // 2. Emotional Intelligence — LIKERT.
  for (const text of EI_QUESTIONS) {
    const existing = await Question.findOne({ text });
    if (existing) { summary.eiExisting++; createdIds.push(existing._id); continue; }
    const doc = await Question.create({
      typeId: eiType._id, text, order: nextOrder(),
      questionType: 'LIKERT_SCALE', dimension: 'Emotional Intelligence', marks: 5,
    });
    await AnswerOption.insertMany(LIKERT.map((l) => ({ questionId: doc._id, ...l })));
    createdIds.push(doc._id);
    summary.eiCreated++;
  }

  // 3. Verbal Ability — single-correct.
  for (const q of VERBAL_QUESTIONS) {
    const existing = await Question.findOne({ text: q.text, dimension: 'Verbal Ability' });
    if (existing) { summary.verbalExisting++; createdIds.push(existing._id); continue; }
    const doc = await Question.create({
      typeId: verbalType._id, text: q.text, instructionText: q.instructionText || '',
      order: nextOrder(), questionType: 'VERBAL_ABILITY', dimension: 'Verbal Ability', marks: 5,
    });
    const saved = await AnswerOption.insertMany(
      q.options.map((o, i) => ({ questionId: doc._id, optionText: o.optionText, isCorrect: !!o.isCorrect, score: o.isCorrect ? 5 : 0, order: i + 1 }))
    );
    const correct = saved.find((o) => o.isCorrect);
    doc.correctOptionId = correct ? correct._id : null;
    await doc.save();
    createdIds.push(doc._id);
    summary.verbalCreated++;
  }

  log(`Emotional Intelligence: ${summary.eiCreated} created, ${summary.eiExisting} already present.`);
  log(`Verbal Ability: ${summary.verbalCreated} created, ${summary.verbalExisting} already present.`);

  // 4. Make sure candidates actually receive them: append to the Default Set,
  //    or every active set if there is no Default Set. Only add ids not already
  //    present, preserving existing order.
  const targetSets = await (async () => {
    const def = await QuestionSet.findOne({ name: 'Default Set' });
    return def ? [def] : QuestionSet.find({ isActive: true });
  })();
  for (const set of targetSets) {
    const have = new Set(set.questionIds.map((id) => id.toString()));
    const toAdd = createdIds.filter((id) => !have.has(id.toString()));
    if (!toAdd.length) continue;
    set.questionIds = [...set.questionIds, ...toAdd];
    await set.save();
    summary.addedToSets.push({ name: set.name, added: toAdd.length, total: set.questionIds.length });
    log(`Added ${toAdd.length} question(s) to set "${set.name}" (now ${set.questionIds.length}).`);
  }

  return summary;
}

module.exports = { seedEmotionalVerbal, EI_QUESTIONS, VERBAL_QUESTIONS, LIKERT };

// CLI entrypoint: run with the target DB's MONGO_URI, e.g.
//   MONGO_URI="<prod-uri>" node backend/scripts/seedEmotionalVerbal.js
if (require.main === module) {
  (async () => {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB.');
    const summary = await seedEmotionalVerbal({ log: (m) => console.log('  ' + m) });
    console.log('Done:', JSON.stringify(summary));
    await mongoose.disconnect();
    process.exit(0);
  })().catch((err) => { console.error(err); process.exit(1); });
}
