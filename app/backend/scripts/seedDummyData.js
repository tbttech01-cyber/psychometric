/**
 * Populates the database with realistic-looking demo data so the admin
 * dashboard, users, shared IDs, and results pages don't look empty.
 * Safe to re-run: skips if dummy data already exists.
 */
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const Admin = require('../models/Admin');
const SharedUserID = require('../models/SharedUserID');
const User = require('../models/User');
const QuestionType = require('../models/QuestionType');
const Question = require('../models/Question');
const AnswerOption = require('../models/AnswerOption');
const AssessmentSession = require('../models/AssessmentSession');
const UserAnswer = require('../models/UserAnswer');
const Result = require('../models/Result');
const { calculateResult, computeQuestionMaxes } = require('../utils/scoreCalculator');
const { evaluateAnswer } = require('../utils/evaluationEngine');

const SHARED_IDS = [
  { code: 'CHN2026A', label: 'Chennai Cohort - Q1 2026' },
  { code: 'CBE2025B', label: 'Coimbatore Business Meet' },
  { code: 'MDU2025',  label: 'Madurai Entrepreneurs Batch' },
  { code: 'WEBQ1',    label: 'Online Webinar - March 2026' },
  { code: 'TVSPART',  label: 'Corporate Partner - TVS Group' },
  { code: 'SWCHN',    label: 'Startup Weekend Chennai' },
  { code: 'WOMEN26',  label: 'Women Entrepreneurs Program' },
  { code: 'TRZBIZ',   label: 'Trichy Business Summit' },
  { code: 'ALUMNI25', label: 'Alumni Founders Network', isActive: false },
  { code: 'PILOT24',  label: 'Pilot Batch 2024', isActive: false },
];

const NAMES = [
  'Arun Kumar', 'Priya Raman', 'Karthik Subramaniam', 'Lakshmi Narayanan', 'Vijay Anand',
  'Divya Shankar', 'Rajesh Pillai', 'Meena Krishnan', 'Suresh Babu', 'Kavya Iyer',
  'Manoj Sundaram', 'Deepa Venkat', 'Ashwin Raj', 'Nithya Prakash', 'Bala Murugan',
  'Sangeetha Ravi', 'Gopal Krishnan', 'Anitha Selvam', 'Karthik Raja', 'Priyanka Muthu',
  'Senthil Kumar', 'Revathi Ganesh', 'Dinesh Chandran', 'Swathi Mohan', 'Prakash Elango',
  'Aishwarya Kumar', 'Ramesh Nathan', 'Kalyani Devi', 'Vignesh Rathnam', 'Bhavana Rajan',
  'Mohan Das', 'Shalini Varma', 'Naveen Kumar', 'Pavithra Selvi', 'Arjun Balasubramanian',
];

const BATCHES = ['BATCH-2025-A', 'BATCH-2025-B', 'BATCH-2026-Q1', 'BATCH-2026-Q2', null];

function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function pick(arr) { return arr[randInt(0, arr.length - 1)]; }
function daysAgo(n) { const d = new Date(); d.setDate(d.getDate() - n); return d; }

// Picks a plausible userAnswerValue (single id, array of ids, or an ordering)
// for a question, biased by `ability` (0-1) so scores actually spread across
// levels instead of clustering — shape and bias logic differ per
// questionType since evaluateAnswer expects a different value per type.
function pickAnswerValue(q, opts, ability) {
  const roll = () => Math.max(0, Math.min(1, ability + (Math.random() - 0.5) * 0.25));

  if (q.questionType === 'LIKERT_SCALE') {
    const sorted = opts.slice().sort((a, b) => a.score - b.score);
    const idx = Math.round(roll() * (sorted.length - 1));
    return sorted[idx]._id;
  }
  if (q.questionType === 'SITUATIONAL') {
    const sumScores = (o) => Object.values(o.dimensionScores || {}).reduce((a, b) => a + b, 0);
    const sorted = opts.slice().sort((a, b) => sumScores(a) - sumScores(b));
    const idx = Math.round(roll() * (sorted.length - 1));
    return sorted[idx]._id;
  }
  if (q.questionType === 'MULTI_SELECT') {
    const correctIds = new Set((q.correctOptionIds || []).map((id) => id.toString()));
    const picked = opts.filter((o) => correctIds.has(o._id.toString())
      ? Math.random() < (0.4 + ability * 0.6)
      : Math.random() < (0.3 - ability * 0.25));
    return (picked.length ? picked : [pick(opts)]).map((o) => o._id);
  }
  if (q.questionType === 'RANKING') {
    const ideal = (q.idealOrder && q.idealOrder.length ? q.idealOrder : opts.map((o) => o._id)).map((id) => id.toString());
    const order = [...ideal];
    // Higher ability -> fewer random swaps away from the ideal order.
    const swaps = Math.round((1 - ability) * order.length);
    for (let s = 0; s < swaps; s++) {
      const i = randInt(0, order.length - 1), j = randInt(0, order.length - 1);
      [order[i], order[j]] = [order[j], order[i]];
    }
    return order;
  }
  // Single-correct aptitude family (NUMERICAL_ABILITY, PERCENTAGE_TYPE,
  // PUZZLE_TYPE, LOGICAL_ABILITY, VERBAL_ABILITY, IMAGE_BASED).
  const correct = opts.find((o) => q.correctOptionId && o._id.toString() === q.correctOptionId.toString());
  if (correct && Math.random() < ability) return correct._id;
  const wrongs = opts.filter((o) => !correct || o._id.toString() !== correct._id.toString());
  return (wrongs.length ? pick(wrongs) : opts[0])._id;
}

async function generateCandidateId() {
  let id, exists = true;
  while (exists) {
    id = `TBT-ID-${randInt(1000, 9999)}`;
    exists = await User.exists({ candidateId: id });
  }
  return id;
}

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to MongoDB.');

  const already = await User.findOne({ email: 'arun.kumar1@example.com' });
  if (already) {
    console.log('Dummy data already seeded — skipping. (Found arun.kumar1@example.com)');
    await mongoose.disconnect();
    return;
  }

  const admin = await Admin.findOne();
  if (!admin) throw new Error('No admin found — run `npm run seed` first.');

  // ── Shared IDs ──────────────────────────────────────────────────────────
  const sharedDocs = [];
  for (const s of SHARED_IDS) {
    let doc = await SharedUserID.findOne({ code: s.code });
    if (!doc) {
      doc = await SharedUserID.create({
        code: s.code, label: s.label, createdBy: admin._id,
        isActive: s.isActive !== false,
      });
    }
    sharedDocs.push(doc);
  }
  console.log(`Shared IDs ready: ${sharedDocs.length}`);

  // ── Question bank (for generating realistic answers) ───────────────────
  const types = await QuestionType.find().sort('order');
  const questions = await Question.find().sort('order');
  const options = await AnswerOption.find();
  const optionsByQuestion = {};
  for (const o of options) {
    const key = o.questionId.toString();
    if (!optionsByQuestion[key]) optionsByQuestion[key] = [];
    optionsByQuestion[key].push(o);
  }
  const typeNameByQuestion = {};
  const typeMap = {};
  for (const q of questions) {
    const type = types.find(t => t._id.equals(q.typeId));
    typeNameByQuestion[q._id.toString()] = type ? type.name : '';
    if (type) typeMap[type._id.toString()] = type.name;
  }
  // Computed once, identical to how the real submit flow scores an
  // assessment (see assessmentController.submitAssessment) — same helper,
  // so dummy results aggregate exactly like real ones.
  const situationalOptsByQ = {};
  for (const q of questions) {
    if (q.questionType === 'SITUATIONAL') situationalOptsByQ[q._id.toString()] = optionsByQuestion[q._id.toString()] || [];
  }
  const { categoryQuestionMax, dimensionQuestionMax } = computeQuestionMaxes(questions, typeMap, situationalOptsByQ);

  // ── Users + Sessions + Results ──────────────────────────────────────────
  let usersCreated = 0, resultsCreated = 0;
  const usageCounts = {};

  for (let i = 0; i < NAMES.length; i++) {
    const name = NAMES[i];
    const emailBase = name.toLowerCase().replace(/[^a-z]+/g, '.').replace(/\.+$/, '');
    const email = `${emailBase}${i + 1}@example.com`;
    const shared = pick(sharedDocs.filter(s => s.isActive));
    const registeredDaysAgo = randInt(1, 45);
    const willComplete = i < 28; // ~80% complete an assessment
    const isVerified = willComplete || Math.random() < 0.6;

    const passwordHash = await bcrypt.hash('Demo@1234', 10);
    const user = await User.create({
      name, email, passwordHash,
      sharedUserID: shared._id, sharedCode: shared.code,
      isVerified,
      hasCompletedAssessment: willComplete,
      phone: Math.random() < 0.7 ? `+91 9${randInt(100000000, 999999999)}` : undefined,
      candidateId: await generateCandidateId(),
      batch: pick(BATCHES) || undefined,
      accessExpiry: Math.random() < 0.5 ? daysAgo(-randInt(10, 90)) : undefined,
      restrictedAccess: Math.random() < 0.15,
      createdAt: daysAgo(registeredDaysAgo),
      updatedAt: daysAgo(registeredDaysAgo),
    });
    usersCreated++;
    usageCounts[shared._id.toString()] = (usageCounts[shared._id.toString()] || 0) + 1;

    if (!willComplete) continue;

    // Ability bucketed by index so scores actually spread across all 4 levels,
    // instead of regressing to the middle (Good/Average) like a pure random blend would.
    const bucket = i % 4; // 0=Needs Improvement, 1=Average, 2=Good, 3=Excellent
    const bucketRanges = [[0.03, 0.22], [0.28, 0.48], [0.52, 0.74], [0.78, 0.98]];
    const [lo, hi] = bucketRanges[bucket];
    const ability = lo + Math.random() * (hi - lo);
    const submittedDaysAgo = randInt(0, Math.min(registeredDaysAgo, 30));
    const startedAt = daysAgo(submittedDaysAgo + 1);
    const submittedAt = daysAgo(submittedDaysAgo);

    const session = await AssessmentSession.create({
      userId: user._id,
      startedAt,
      submittedAt,
      expiresAt: new Date(startedAt.getTime() + 45 * 60 * 1000),
      status: 'submitted',
      totalAnswered: questions.length,
      createdAt: startedAt,
    });

    const answers = [];
    for (const q of questions) {
      const opts = optionsByQuestion[q._id.toString()] || [];
      if (!opts.length) continue;
      const userAnswerValue = pickAnswerValue(q, opts, ability);
      let evalResult;
      try {
        evalResult = evaluateAnswer(q, opts, userAnswerValue);
      } catch {
        continue; // malformed dummy pick for this question — skip rather than crash the whole seed run
      }
      answers.push({
        sessionId: session._id, userId: user._id, questionId: q._id,
        answerOptionId: q.questionType === 'MULTI_SELECT' || q.questionType === 'RANKING' ? undefined : userAnswerValue,
        selectedOptionIds: q.questionType === 'MULTI_SELECT' ? userAnswerValue : undefined,
        rankingOrder: q.questionType === 'RANKING' ? userAnswerValue : undefined,
        score: evalResult.score, maxScore: evalResult.maxScore, isCorrect: evalResult.isCorrect,
        dimension: q.dimension, dimensionScores: evalResult.dimensionScores,
        questionOrder: q.order, answeredAt: startedAt, status: 'answered',
      });
    }
    await UserAnswer.insertMany(answers);

    const calc = calculateResult(answers, typeNameByQuestion, categoryQuestionMax, dimensionQuestionMax, questions.length);
    await Result.create({
      userId: user._id, sessionId: session._id,
      ...calc,
      createdAt: submittedAt,
      updatedAt: submittedAt,
    });
    resultsCreated++;
  }

  for (const [id, count] of Object.entries(usageCounts)) {
    await SharedUserID.findByIdAndUpdate(id, { $inc: { usageCount: count } });
  }

  console.log(`Users created: ${usersCreated}`);
  console.log(`Results created: ${resultsCreated}`);
  console.log('Dummy data seed complete!');
  await mongoose.disconnect();
}

run().catch(err => { console.error(err); process.exit(1); });
