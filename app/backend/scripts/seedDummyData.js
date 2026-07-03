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
const { calculateResult } = require('../utils/scoreCalculator');

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
  for (const q of questions) {
    const type = types.find(t => t._id.equals(q.typeId));
    typeNameByQuestion[q._id.toString()] = type ? type.name : '';
  }

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
      const opts = (optionsByQuestion[q._id.toString()] || []).slice().sort((a, b) => a.marks - b.marks);
      if (!opts.length) continue;
      // Weighted pick biased by ability: higher ability -> more likely to pick higher marks.
      // Small jitter per-question for realism, but ability stays the dominant driver.
      const roll = Math.max(0, Math.min(1, ability + (Math.random() - 0.5) * 0.25));
      const idx = Math.max(0, Math.min(opts.length - 1, Math.round(roll * (opts.length - 1))));
      const chosen = opts[idx];
      answers.push({
        sessionId: session._id, userId: user._id, questionId: q._id,
        answerOptionId: chosen._id, marks: chosen.marks, questionOrder: q.order,
        answeredAt: startedAt,
      });
    }
    await UserAnswer.insertMany(answers);

    const calc = calculateResult(answers, typeNameByQuestion);
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
