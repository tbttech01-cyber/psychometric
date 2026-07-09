const request = require('supertest');
const app = require('../backend/app');
const { connect, disconnect } = require('./dbConnect');
const Admin = require('../backend/models/Admin');
const jwt = require('jsonwebtoken');

beforeAll(connect);
afterAll(disconnect);

let token;
let questionIds;

beforeAll(async () => {
  const admin = await Admin.findOne({ email: process.env.ADMIN_EMAIL });
  token = jwt.sign({ id: admin._id, role: 'admin' }, process.env.JWT_SECRET, { expiresIn: '1h' });
  admin.activeToken = token;
  await admin.save();

  const res = await request(app).get('/api/v1/admin/questions').set({ Authorization: `Bearer ${token}` });
  questionIds = res.body.data.map((q) => q._id);
});

const auth = () => ({ Authorization: `Bearer ${token}` });

describe('Admin CRUD: question sets', () => {
  let setId;

  it('lists question sets including the seeded Default Set', async () => {
    const res = await request(app).get('/api/v1/admin/question-sets').set(auth());
    expect(res.status).toBe(200);
    expect(res.body.data.some((s) => s.name === 'Default Set')).toBe(true);
    const def = res.body.data.find((s) => s.name === 'Default Set');
    // Computed fields the list endpoint adds.
    expect(def.questionCount).toBeGreaterThan(0);
    expect(def.assignedCodeCount).toBeGreaterThanOrEqual(1); // TBT2024
  });

  it('creates a question set', async () => {
    const res = await request(app).post('/api/v1/admin/question-sets').set(auth()).send({
      name: 'QSet Test A', description: 'first three questions', durationMinutes: 15,
      questionIds: questionIds.slice(0, 3),
    });
    expect(res.status).toBe(201);
    expect(res.body.data.durationMinutes).toBe(15);
    expect(res.body.data.questionIds.length).toBe(3);
    setId = res.body.data._id;
  });

  it('rejects an empty questionIds array', async () => {
    const res = await request(app).post('/api/v1/admin/question-sets').set(auth())
      .send({ name: 'QSet Empty', durationMinutes: 10, questionIds: [] });
    expect(res.status).toBe(400);
  });

  it('rejects a duration below 1 minute', async () => {
    const res = await request(app).post('/api/v1/admin/question-sets').set(auth())
      .send({ name: 'QSet Zero', durationMinutes: 0, questionIds: questionIds.slice(0, 1) });
    expect(res.status).toBe(400);
  });

  it('rejects a duplicate set name', async () => {
    const res = await request(app).post('/api/v1/admin/question-sets').set(auth())
      .send({ name: 'QSet Test A', durationMinutes: 10, questionIds: questionIds.slice(0, 1) });
    expect(res.status).toBe(409);
  });

  it('gets a set with populated questions', async () => {
    const res = await request(app).get(`/api/v1/admin/question-sets/${setId}`).set(auth());
    expect(res.status).toBe(200);
    expect(res.body.data.questionIds.length).toBe(3);
    // Populated docs carry `text`, not just an id string.
    expect(typeof res.body.data.questionIds[0].text).toBe('string');
  });

  it('updates a set and reorders questions via the new array order', async () => {
    const reordered = [questionIds[2], questionIds[0], questionIds[1]];
    const res = await request(app).put(`/api/v1/admin/question-sets/${setId}`).set(auth())
      .send({ name: 'QSet Test A', durationMinutes: 20, questionIds: reordered });
    expect(res.status).toBe(200);
    expect(res.body.data.durationMinutes).toBe(20);
    expect(res.body.data.questionIds.map(String)).toEqual(reordered.map(String));
  });

  it('dedupes repeated question ids on save', async () => {
    const dupes = [questionIds[0], questionIds[0], questionIds[1]];
    const res = await request(app).put(`/api/v1/admin/question-sets/${setId}`).set(auth())
      .send({ name: 'QSet Test A', durationMinutes: 20, questionIds: dupes });
    expect(res.status).toBe(200);
    expect(res.body.data.questionIds.length).toBe(2);
  });

  it('assigns a set to an access code and reads it back', async () => {
    const codeRes = await request(app).post('/api/v1/admin/shared-ids').set(auth())
      .send({ code: 'QSETCODE1', label: 'QSet Cohort', questionSetId: setId });
    expect(codeRes.status).toBe(201);

    const listRes = await request(app).get('/api/v1/admin/shared-ids?search=QSETCODE1').set(auth());
    const row = listRes.body.data.find((r) => r.code === 'QSETCODE1');
    expect(row.questionSetId._id).toBe(setId);
    expect(row.questionSetId.name).toBe('QSet Test A');
  });

  it('blocks deleting a set that is still assigned to a code', async () => {
    const res = await request(app).delete(`/api/v1/admin/question-sets/${setId}`).set(auth());
    expect(res.status).toBe(409);
    expect(res.body.codes).toContain('QSETCODE1');
  });

  it('deletes the set after the code is unassigned', async () => {
    const listRes = await request(app).get('/api/v1/admin/shared-ids?search=QSETCODE1').set(auth());
    const codeId = listRes.body.data.find((r) => r.code === 'QSETCODE1')._id;
    await request(app).put(`/api/v1/admin/shared-ids/${codeId}`).set(auth()).send({ questionSetId: '' });

    const res = await request(app).delete(`/api/v1/admin/question-sets/${setId}`).set(auth());
    expect(res.status).toBe(200);
  });
});
