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
let allQuestions; // flattened [{ questionId, answerOptionId }]

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

describe('Assessment flow', () => {
  it('fetches all 40 seeded questions across 8 categories', async () => {
    const res = await request(app)
      .get('/api/v1/assessment/questions')
      .set('Authorization', `Bearer ${userToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(8);

    allQuestions = [];
    for (const type of res.body.data) {
      expect(type.questions.length).toBe(5);
      for (const q of type.questions) {
        const opt = q.options.find(o => o.label === 'Strongly Agree');
        expect(opt).toBeTruthy();
        // marks must never be exposed to the user-facing endpoint
        expect(opt.marks).toBeUndefined();
        allQuestions.push({ questionId: q._id, answerOptionId: opt._id });
      }
    }
    expect(allQuestions.length).toBe(40);
  });

  it('starts an assessment session', async () => {
    const res = await request(app)
      .post('/api/v1/assessment/start')
      .set('Authorization', `Bearer ${userToken}`);
    expect(res.status).toBe(201);
    expect(res.body.sessionId).toBeTruthy();
    sessionId = res.body.sessionId;
  });

  it('rejects submission with fewer than 40 answers', async () => {
    const res = await request(app)
      .post('/api/v1/assessment/submit')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ sessionId, answers: allQuestions.slice(0, 5) });
    expect(res.status).toBe(400);
  });

  it('submits all 40 answers ("Strongly Agree") and scores 100%/Excellent', async () => {
    const res = await request(app)
      .post('/api/v1/assessment/submit')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ sessionId, answers: allQuestions });
    expect(res.status).toBe(200);
    expect(res.body.resultId).toBeTruthy();

    const resultRes = await request(app)
      .get('/api/v1/assessment/result')
      .set('Authorization', `Bearer ${userToken}`);
    expect(resultRes.status).toBe(200);
    expect(resultRes.body.data.totalMarks).toBe(200);
    expect(resultRes.body.data.percentage).toBe(100);
    expect(resultRes.body.data.level).toBe('Excellent');
    expect(Object.keys(resultRes.body.data.categoryScores).length).toBe(8);
  });

  it('rejects re-submitting the same session', async () => {
    const res = await request(app)
      .post('/api/v1/assessment/submit')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ sessionId, answers: allQuestions });
    expect(res.status).toBe(400);
  });

  it('blocks starting a new session after completing the assessment', async () => {
    const res = await request(app)
      .post('/api/v1/assessment/start')
      .set('Authorization', `Bearer ${userToken}`);
    expect(res.status).toBe(403);
  });
});
