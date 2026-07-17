const request = require('supertest');
const app = require('../backend/app');
const { connect, disconnect } = require('./dbConnect');
const User = require('../backend/models/User');
const Admin = require('../backend/models/Admin');
const Question = require('../backend/models/Question');
const SharedUserID = require('../backend/models/SharedUserID');
const QuestionSet = require('../backend/models/QuestionSet');
const AssessmentSession = require('../backend/models/AssessmentSession');

beforeAll(connect);
afterAll(disconnect);

const EMAIL = 'assessment-test-user@example.com';
let codeId;
let userToken;
let sessionId;
let allAnswers; // flattened [{ questionId, answerOptionId | answerOptionIds | orderedOptionIds }]
let totalQuestions;

function findOption(options, text) {
  const opt = options.find((o) => o.optionText === text);
  if (!opt) throw new Error(`Seed data changed — option "${text}" not found.`);
  return opt;
}

// The single "ideal" answer per question, built from the exact seed content
// in backend/scripts/seedData.js — every one of these achieves full marks,
// so the whole assessment should score 100%/Excellent.
function idealAnswerFor(q) {
  switch (q.questionType) {
    case 'LIKERT_SCALE':
    case undefined:
      return { answerOptionId: findOption(q.options, 'Strongly Agree')._id };
    case 'SITUATIONAL':
      return { answerOptionId: findOption(q.options, 'Listen calmly and solve the issue')._id };
    case 'NUMERICAL_ABILITY':
      return { answerOptionId: findOption(q.options, '16')._id };
    case 'PERCENTAGE_TYPE':
      return { answerOptionId: findOption(q.options, '₹1200')._id };
    case 'PUZZLE_TYPE':
      return { answerOptionId: findOption(q.options, '30')._id };
    case 'LOGICAL_ABILITY':
      return { answerOptionId: findOption(q.options, 'KLLA')._id };
    case 'VERBAL_ABILITY':
      return { answerOptionId: findOption(q.options, 'greater than those of any other')._id };
    case 'IMAGE_BASED':
      return { answerOptionId: findOption(q.options, '74')._id };
    case 'MULTI_SELECT':
      return {
        answerOptionIds: [
          findOption(q.options, 'Identifying market gaps')._id,
          findOption(q.options, 'Focusing on customer value creation')._id,
        ],
      };
    case 'RANKING':
      return {
        orderedOptionIds: [
          'Validate the idea with real customers',
          'Build a minimum viable product',
          'Set up a company logo and branding',
          'Print business cards',
        ].map((text) => findOption(q.options, text)._id),
      };
    default:
      throw new Error(`No ideal answer defined for questionType "${q.questionType}".`);
  }
}

describe('User registration + OTP', () => {
  it('rejects an invalid access code', async () => {
    const res = await request(app).post('/api/v1/user/validate-code').send({ code: 'NOPE' });
    expect(res.status).toBe(404);
  });

  it('validates the seeded demo access code', async () => {
    const res = await request(app).post('/api/v1/user/validate-code').send({ code: 'TBT2024' });
    expect(res.status).toBe(200);
    expect(res.body.codeId).toBeTruthy();
    codeId = res.body.codeId;
  });

  it('registers a new user and stores a hashed OTP', async () => {
    const res = await request(app).post('/api/v1/user/register').send({
      codeId, name: 'Assessment Tester', email: EMAIL, password: 'Password123',
    });
    expect(res.status).toBe(201);

    const user = await User.findOne({ email: EMAIL });
    expect(user.otpCode).toMatch(/^\d{6}$/);
  });

  it('rejects an incorrect OTP', async () => {
    const res = await request(app).post('/api/v1/user/verify-otp').send({ email: EMAIL, otp: '000000' });
    expect(res.status).toBe(400);
  });

  it('re-registering an UNVERIFIED account updates the password (latest attempt wins)', async () => {
    const email = 'rereg-test-user@example.com';
    // First attempt with one password (stays unverified).
    await request(app).post('/api/v1/user/register').send({ codeId, name: 'First', email, password: 'FirstPass1' });
    // Second attempt with a DIFFERENT password before verifying.
    const second = await request(app).post('/api/v1/user/register').send({ codeId, name: 'Second', email, password: 'SecondPass2' });
    expect(second.status).toBe(200); // OTP resent

    // Verify with the latest OTP.
    const user = await User.findOne({ email });
    const verify = await request(app).post('/api/v1/user/verify-otp').send({ email, otp: user.otpCode });
    expect(verify.status).toBe(200);

    // The SECOND (latest) password must now log in...
    const good = await request(app).post('/api/v1/user/login').send({ email, password: 'SecondPass2' });
    expect(good.status).toBe(200);
    expect(good.body.token).toBeTruthy();
    // ...and the first, superseded password must NOT.
    const bad = await request(app).post('/api/v1/user/login').send({ email, password: 'FirstPass1' });
    expect(bad.status).toBe(401);
  });

  it('verifies the correct OTP and issues a JWT', async () => {
    const user = await User.findOne({ email: EMAIL });
    const res = await request(app).post('/api/v1/user/verify-otp').send({ email: EMAIL, otp: user.otpCode });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeTruthy();
    userToken = res.body.token;
  });

  it('selects the access code after login to unlock the assessment', async () => {
    const res = await request(app)
      .post('/api/v1/user/select-code')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ code: 'TBT2024' });
    expect(res.status).toBe(200);
    expect(res.body.codeId).toBeTruthy();
  });
});

describe('Assessment flow — all 10 question types', () => {
  it('fetches every seeded question across all categories, secrets stripped', async () => {
    const res = await request(app)
      .get('/api/v1/assessment/questions')
      .set('Authorization', `Bearer ${userToken}`);
    expect(res.status).toBe(200);
    // 8 original personality categories + 3 aptitude categories added for
    // the non-Likert question types (see seedData.js QUESTION_TYPES).
    expect(res.body.data.length).toBe(11);

    allAnswers = [];
    totalQuestions = 0;
    for (const type of res.body.data) {
      for (const q of type.questions) {
        totalQuestions++;
        // Scoring secrets must never reach the candidate, for any type.
        for (const opt of q.options) {
          expect(opt.score).toBeUndefined();
          expect(opt.isCorrect).toBeUndefined();
          expect(opt.dimensionScores).toBeUndefined();
        }
        allAnswers.push({ questionId: q._id, ...idealAnswerFor(q) });
      }
    }
    // 40 Likert questions (Phase 1) + 9 example questions, one per other type.
    expect(totalQuestions).toBe(49);
    expect(allAnswers.length).toBe(49);
  });

  it('starts an assessment session', async () => {
    const res = await request(app)
      .post('/api/v1/assessment/start')
      .set('Authorization', `Bearer ${userToken}`);
    expect(res.status).toBe(201);
    expect(res.body.sessionId).toBeTruthy();
    sessionId = res.body.sessionId;
  });

  it('rejects submission with fewer than all questions answered', async () => {
    const res = await request(app)
      .post('/api/v1/assessment/submit')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ sessionId, answers: allAnswers.slice(0, 5) });
    expect(res.status).toBe(400);
  });

  it('submits ideal answers for every question type and scores 100%/Excellent', async () => {
    const res = await request(app)
      .post('/api/v1/assessment/submit')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ sessionId, answers: allAnswers });
    expect(res.status).toBe(200);
    expect(res.body.resultId).toBeTruthy();

    const resultRes = await request(app)
      .get('/api/v1/assessment/result')
      .set('Authorization', `Bearer ${userToken}`);
    expect(resultRes.status).toBe(200);
    const r = resultRes.body.data;

    expect(r.percentage).toBe(100);
    expect(r.level).toBe('Excellent');
    expect(r.totalMarks).toBe(r.maxScore);
    expect(Object.keys(r.categoryScores).length).toBe(11);

    // Phase-2 fields: MULTI_SELECT and RANKING both contribute a real
    // isCorrect:true, alongside the 6 single-correct aptitude types.
    expect(r.correctCount).toBe(8);
    expect(r.wrongCount).toBe(0);
    expect(r.skippedCount).toBe(0);
    expect(r.businessReadinessPercent).toBe(100);
    expect(Object.keys(r.dimensionPercentages).length).toBeGreaterThan(0);
    expect(r.recommendations.length).toBeGreaterThan(0);
    expect(r.recommendations.length).toBeLessThanOrEqual(5);
    expect(Array.isArray(r.strongDimensions)).toBe(true);
    expect(Array.isArray(r.weakDimensions)).toBe(true);
    expect(typeof r.aptitudeScore).toBe('number');
    expect(typeof r.personalityScore).toBe('number');
    expect(typeof r.businessMindsetScore).toBe('number');
    expect(typeof r.financialAwarenessScore).toBe('number');
  });

  it('rejects re-submitting the same session', async () => {
    const res = await request(app)
      .post('/api/v1/assessment/submit')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ sessionId, answers: allAnswers });
    expect(res.status).toBe(400);
  });

  it('blocks starting a new session after completing the assessment', async () => {
    const res = await request(app)
      .post('/api/v1/assessment/start')
      .set('Authorization', `Bearer ${userToken}`);
    expect(res.status).toBe(403);
  });
});

describe('Question Set — cohort assignment and per-set timer', () => {
  // Full register→OTP→verify flow (email is mocked) to get a candidate token
  // for a freshly-created cohort code.
  async function tokenForCode(code, email) {
    const vc = await request(app).post('/api/v1/user/validate-code').send({ code });
    const codeId = vc.body.codeId;
    await request(app).post('/api/v1/user/register').send({ codeId, name: 'Cohort Tester', email, password: 'Password123' });
    const user = await User.findOne({ email });
    const res = await request(app).post('/api/v1/user/verify-otp').send({ email, otp: user.otpCode });
    const token = res.body.token;
    // Complete the post-login Access Code step so the assessment unlocks.
    await request(app).post('/api/v1/user/select-code').set('Authorization', `Bearer ${token}`).send({ code });
    return token;
  }

  it('blocks the access-code step when the cohort has no question set assigned', async () => {
    const admin = await Admin.findOne();
    await SharedUserID.create({ code: 'NOSETCODE', label: 'No set cohort', createdBy: admin._id, questionSetId: null });

    // Register + verify without selecting a code (tokenForCode would fail the
    // select step here, which is exactly what this test asserts).
    const vc = await request(app).post('/api/v1/user/validate-code').send({ code: 'NOSETCODE' });
    await request(app).post('/api/v1/user/register').send({ codeId: vc.body.codeId, name: 'No Set Tester', email: 'noset-user@example.com', password: 'Password123' });
    const user = await User.findOne({ email: 'noset-user@example.com' });
    const verify = await request(app).post('/api/v1/user/verify-otp').send({ email: 'noset-user@example.com', otp: user.otpCode });
    const token = verify.body.token;

    // The block now surfaces at the access-code step: a valid code with no
    // assessment assigned is rejected before it can be selected.
    const sel = await request(app).post('/api/v1/user/select-code').set('Authorization', `Bearer ${token}`).send({ code: 'NOSETCODE' });
    expect(sel.status).toBe(409);
    expect(sel.body.message).toMatch(/no assessment has been assigned/i);

    // And /start stays blocked because the access-code gate was never passed.
    const res = await request(app).post('/api/v1/assessment/start').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('CODE_REQUIRED');
  });

  it('sizes the session timer from the assigned set, not the global default', async () => {
    const admin = await Admin.findOne();
    const qIds = (await Question.find({ isActive: true }).sort('order').limit(3).select('_id')).map((q) => q._id);
    const set = await QuestionSet.create({ name: 'Timer Set 5min', durationMinutes: 5, questionIds: qIds, createdBy: admin._id });
    await SharedUserID.create({ code: 'TIMER5CODE', label: '5 min cohort', createdBy: admin._id, questionSetId: set._id });
    const token = await tokenForCode('TIMER5CODE', 'timer5-user@example.com');

    const res = await request(app).post('/api/v1/assessment/start').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(201);
    const minutes = Math.round((new Date(res.body.expiresAt) - new Date(res.body.startedAt)) / 60000);
    expect(minutes).toBe(5);

    // The candidate only sees the set's 3 questions, not all seeded ones.
    const qRes = await request(app).get('/api/v1/assessment/questions').set('Authorization', `Bearer ${token}`);
    const shown = qRes.body.data.reduce((n, type) => n + type.questions.length, 0);
    expect(shown).toBe(3);
  });
});

describe('Access Code gate — assessment locked until a code is selected', () => {
  const GATE_EMAIL = 'gate-test-user@example.com';
  let token;

  it('registers + verifies a user who has not yet selected a code', async () => {
    const vc = await request(app).post('/api/v1/user/validate-code').send({ code: 'TBT2024' });
    await request(app).post('/api/v1/user/register').send({ codeId: vc.body.codeId, name: 'Gate Tester', email: GATE_EMAIL, password: 'Password123' });
    const user = await User.findOne({ email: GATE_EMAIL });
    const res = await request(app).post('/api/v1/user/verify-otp').send({ email: GATE_EMAIL, otp: user.otpCode });
    token = res.body.token;
    expect(token).toBeTruthy();
  });

  it('blocks /questions and /start until the access-code step runs (cannot be skipped)', async () => {
    const q = await request(app).get('/api/v1/assessment/questions').set('Authorization', `Bearer ${token}`);
    expect(q.status).toBe(403);
    expect(q.body.code).toBe('CODE_REQUIRED');

    const s = await request(app).post('/api/v1/assessment/start').set('Authorization', `Bearer ${token}`);
    expect(s.status).toBe(403);
    expect(s.body.code).toBe('CODE_REQUIRED');
  });

  it('unlocks the assessment once a valid access code is selected', async () => {
    const sel = await request(app).post('/api/v1/user/select-code').set('Authorization', `Bearer ${token}`).send({ code: 'TBT2024' });
    expect(sel.status).toBe(200);

    const q = await request(app).get('/api/v1/assessment/questions').set('Authorization', `Bearer ${token}`);
    expect(q.status).toBe(200);
  });
});

describe('Assessment timing — server-authoritative expiry', () => {
  const TIMING_EMAIL = 'timing-test-user@example.com';
  let token, sessionId;

  it('sets up a fresh in-progress session', async () => {
    const vc = await request(app).post('/api/v1/user/validate-code').send({ code: 'TBT2024' });
    await request(app).post('/api/v1/user/register').send({ codeId: vc.body.codeId, name: 'Timing Tester', email: TIMING_EMAIL, password: 'Password123' });
    const user = await User.findOne({ email: TIMING_EMAIL });
    const verify = await request(app).post('/api/v1/user/verify-otp').send({ email: TIMING_EMAIL, otp: user.otpCode });
    token = verify.body.token;
    await request(app).post('/api/v1/user/select-code').set('Authorization', `Bearer ${token}`).send({ code: 'TBT2024' });
    const start = await request(app).post('/api/v1/assessment/start').set('Authorization', `Bearer ${token}`);
    expect(start.status).toBe(201);
    sessionId = start.body.sessionId;
  });

  it('rejects a submit past the grace window even with a forged autoSubmitted flag', async () => {
    // Force the session well past expiry + grace, then try to submit with the
    // client claiming autoSubmitted:true — the server must ignore that flag.
    await AssessmentSession.updateOne({ _id: sessionId }, { expiresAt: new Date(Date.now() - 5 * 60 * 1000) });
    const res = await request(app)
      .post('/api/v1/assessment/submit')
      .set('Authorization', `Bearer ${token}`)
      .send({ sessionId, answers: [{ questionId: '000000000000000000000000', status: 'skipped' }], autoSubmitted: true });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/time has expired/i);

    // Session stays in-progress (the late submit was rejected, not consumed).
    const session = await AssessmentSession.findById(sessionId);
    expect(session.status).toBe('in-progress');
  });

  it('auto-retires an expired abandoned session so the candidate can start fresh', async () => {
    // The session above is expired past grace. A new start must NOT 409 forever
    // — it retires the dead session and issues a fresh attempt.
    const res = await request(app).post('/api/v1/assessment/start').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(201);
    expect(res.body.sessionId).not.toBe(sessionId);
    const old = await AssessmentSession.findById(sessionId);
    expect(old.status).toBe('expired');
  });
});

describe('Assessment audio — candidate /questions payload', () => {
  const AUDIO_URI = 'data:audio/mpeg;base64,SGVsbG8gYXVkaW8=';
  let touchedIds = [];

  async function tokenForCode(code, email) {
    const vc = await request(app).post('/api/v1/user/validate-code').send({ code });
    await request(app).post('/api/v1/user/register').send({ codeId: vc.body.codeId, name: 'Audio Tester', email, password: 'Password123' });
    const user = await User.findOne({ email });
    const res = await request(app).post('/api/v1/user/verify-otp').send({ email, otp: user.otpCode });
    const token = res.body.token;
    await request(app).post('/api/v1/user/select-code').set('Authorization', `Bearer ${token}`).send({ code });
    return token;
  }

  // Reset the borrowed questions so the audio flags don't leak into other suites.
  afterAll(async () => {
    if (touchedIds.length) await Question.updateMany({ _id: { $in: touchedIds } }, { hasAudio: false, audioUrl: '' });
  });

  it('exposes audio fields for a valid clip, omits them for no-audio, and treats blank-URL as no-audio', async () => {
    const admin = await Admin.findOne();
    const qs = await Question.find({ isActive: true }).sort('order').limit(3);
    const [withAudio, noAudio, blankAudio] = qs;
    touchedIds = qs.map((q) => q._id);

    // A real clip; a plain no-audio question; and a misconfigured one (hasAudio
    // set but the URL blank/whitespace) which MUST surface as no-audio so the
    // candidate never renders a broken/empty player.
    await Question.updateOne({ _id: withAudio._id }, { hasAudio: true, audioUrl: AUDIO_URI });
    await Question.updateOne({ _id: noAudio._id }, { hasAudio: false, audioUrl: '' });
    await Question.updateOne({ _id: blankAudio._id }, { hasAudio: true, audioUrl: '   ' });

    const set = await QuestionSet.create({ name: 'Audio Set', durationMinutes: 10, questionIds: qs.map((q) => q._id), createdBy: admin._id });
    await SharedUserID.create({ code: 'AUDIOCODE', label: 'Audio cohort', createdBy: admin._id, questionSetId: set._id });
    const token = await tokenForCode('AUDIOCODE', 'audio-user@example.com');

    const res = await request(app).get('/api/v1/assessment/questions').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);

    const flat = res.body.data.flatMap((t) => t.questions);
    const a = flat.find((q) => q._id === String(withAudio._id));
    const n = flat.find((q) => q._id === String(noAudio._id));
    const b = flat.find((q) => q._id === String(blankAudio._id));

    expect(a.hasAudio).toBe(true);
    expect(a.audioUrl).toBe(AUDIO_URI);

    expect(n.hasAudio).toBe(false);
    expect(n.audioUrl).toBeUndefined();

    expect(b.hasAudio).toBe(false);
    expect(b.audioUrl).toBeUndefined();
  });
});

describe('Retest request → admin approval → attempt #2 (history preserved)', () => {
  // Runs after the main flow, where `userToken`'s user completed attempt #1.
  let adminToken, retestId, retestSessionId;

  it('result page shows attempt #1 and allows a retest request', async () => {
    const res = await request(app).get('/api/v1/assessment/result').set('Authorization', `Bearer ${userToken}`);
    expect(res.status).toBe(200);
    expect(res.body.attemptNumber).toBe(1);
    expect(res.body.history.length).toBe(1);
    expect(res.body.retest.canRequest).toBe(true);
  });

  it('a completed candidate can request a retest', async () => {
    const res = await request(app).post('/api/v1/assessment/retest/request').set('Authorization', `Bearer ${userToken}`);
    expect(res.status).toBe(200);
  });

  it('blocks a duplicate request', async () => {
    const res = await request(app).post('/api/v1/assessment/retest/request').set('Authorization', `Bearer ${userToken}`);
    expect(res.status).toBe(409);
  });

  it('start stays blocked until an admin approves', async () => {
    const res = await request(app).post('/api/v1/assessment/start').set('Authorization', `Bearer ${userToken}`);
    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/already completed/i);
  });

  it('admin sees the pending request (attempt #2) and approves it', async () => {
    const login = await request(app).post('/api/v1/admin/login').send({ email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD });
    adminToken = login.body.token;

    const list = await request(app).get('/api/v1/admin/retest-requests?status=pending').set('Authorization', `Bearer ${adminToken}`);
    expect(list.status).toBe(200);
    const target = list.body.data.find((r) => r.userEmail === EMAIL);
    expect(target).toBeTruthy();
    expect(target.attemptNumber).toBe(2);
    retestId = target._id;

    const approve = await request(app).post(`/api/v1/admin/retest-requests/${retestId}/approve`).set('Authorization', `Bearer ${adminToken}`);
    expect(approve.status).toBe(200);
  });

  it('an approved retest starts FRESH at a new session, retiring any lingering in-progress attempt', async () => {
    // Simulate a stale, still-live in-progress attempt (e.g. a retest the
    // candidate opened, half-answered, then abandoned without submitting).
    const user = await User.findOne({ email: EMAIL });
    const stale = await AssessmentSession.create({
      userId: user._id,
      startedAt: new Date(),
      expiresAt: new Date(Date.now() + 30 * 60 * 1000), // well within the timer — NOT dead
      status: 'in-progress',
      attemptNumber: 2,
    });

    // Pressing "Start Retest" must NOT 409-resume the stale attempt — it must
    // open a brand-new session (question 1, fresh timer) and retire the old one.
    const start = await request(app).post('/api/v1/assessment/start').set('Authorization', `Bearer ${userToken}`);
    expect(start.status).toBe(201);
    expect(start.body.attemptNumber).toBe(2);
    expect(start.body.sessionId).not.toBe(String(stale._id));
    retestSessionId = start.body.sessionId;

    const retired = await AssessmentSession.findById(stale._id);
    expect(retired.status).toBe('expired');
  });

  it('submits attempt #2, preserving attempt #1 and its history', async () => {
    const submit = await request(app).post('/api/v1/assessment/submit')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ sessionId: retestSessionId, answers: allAnswers });
    expect(submit.status).toBe(200);

    const res = await request(app).get('/api/v1/assessment/result').set('Authorization', `Bearer ${userToken}`);
    expect(res.body.attemptNumber).toBe(2);
    expect(res.body.history.length).toBe(2);
    expect(res.body.history.map((h) => h.attemptNumber).sort()).toEqual([1, 2]);
  });

  it('the approval expired after one use; a further start needs a new request', async () => {
    const start = await request(app).post('/api/v1/assessment/start').set('Authorization', `Bearer ${userToken}`);
    expect(start.status).toBe(403);
    const reReq = await request(app).post('/api/v1/assessment/retest/request').set('Authorization', `Bearer ${userToken}`);
    expect(reReq.status).toBe(200);
  });
});
