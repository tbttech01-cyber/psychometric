const request = require('supertest');
const app = require('../backend/app');
const { connect, disconnect } = require('./dbConnect');
const User = require('../backend/models/User');

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

  it('verifies the correct OTP and issues a JWT', async () => {
    const user = await User.findOne({ email: EMAIL });
    const res = await request(app).post('/api/v1/user/verify-otp').send({ email: EMAIL, otp: user.otpCode });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeTruthy();
    userToken = res.body.token;
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
