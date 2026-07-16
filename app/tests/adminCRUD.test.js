const request = require('supertest');
const app = require('../backend/app');
const { connect, disconnect } = require('./dbConnect');
const Admin = require('../backend/models/Admin');
const jwt = require('jsonwebtoken');

beforeAll(connect);
afterAll(disconnect);

let token;

beforeAll(async () => {
  const admin = await Admin.findOne({ email: process.env.ADMIN_EMAIL });
  token = jwt.sign({ id: admin._id, role: 'admin' }, process.env.JWT_SECRET, { expiresIn: '1h' });
  admin.activeToken = token;
  await admin.save();
});

const auth = () => ({ Authorization: `Bearer ${token}` });

describe('Admin CRUD: shared IDs', () => {
  let createdId;

  it('lists shared IDs including the seeded demo code', async () => {
    const res = await request(app).get('/api/v1/admin/shared-ids').set(auth());
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.some(s => s.code === 'TBT2024')).toBe(true);
  });

  it('creates a new shared ID', async () => {
    const res = await request(app)
      .post('/api/v1/admin/shared-ids')
      .set(auth())
      .send({ code: 'CRUDTEST1', label: 'CRUD Test Cohort' });
    expect(res.status).toBe(201);
    expect(res.body.data.code).toBe('CRUDTEST1');
    createdId = res.body.data._id;
  });

  it('rejects creating a shared ID with invalid payload', async () => {
    const res = await request(app)
      .post('/api/v1/admin/shared-ids')
      .set(auth())
      .send({ code: '', label: '' });
    expect(res.status).toBe(400);
  });

  it('updates the created shared ID', async () => {
    const res = await request(app)
      .put(`/api/v1/admin/shared-ids/${createdId}`)
      .set(auth())
      .send({ label: 'Updated Label' });
    expect(res.status).toBe(200);
    expect(res.body.data.label).toBe('Updated Label');
  });

  it('deletes the created shared ID', async () => {
    const res = await request(app).delete(`/api/v1/admin/shared-ids/${createdId}`).set(auth());
    expect(res.status).toBe(200);
  });
});

describe('Admin CRUD: question types', () => {
  it('lists all seeded question types (8 personality categories + 3 aptitude categories)', async () => {
    const res = await request(app).get('/api/v1/admin/question-types').set(auth());
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(11);
  });
});

describe('Admin CRUD: question audio', () => {
  let typeId;
  const dataUri = 'data:audio/mpeg;base64,SGVsbG8gYXVkaW8=';
  const basePayload = (over = {}) => ({
    typeId, order: 9990, text: 'Listen and answer.', questionType: 'LIKERT_SCALE',
    dimension: 'Communication', marks: 5,
    options: [1, 2, 3, 4, 5].map((n) => ({ optionText: `opt${n}`, score: n, order: n })),
    ...over,
  });

  beforeAll(async () => {
    const res = await request(app).get('/api/v1/admin/question-types').set(auth());
    typeId = res.body.data[0]._id;
  });

  it('rejects Has-Audio without an audio source', async () => {
    const res = await request(app).post('/api/v1/admin/questions').set(auth()).send(basePayload({ hasAudio: true }));
    expect(res.status).toBe(400);
  });

  it('stores an uploaded base64 audio data URI, omits it from the list, returns it on detail', async () => {
    const res = await request(app).post('/api/v1/admin/questions').set(auth())
      .send(basePayload({ hasAudio: true, audioUrl: dataUri }));
    expect(res.status).toBe(201);
    const id = res.body.data._id;

    const one = await request(app).get(`/api/v1/admin/questions/${id}`).set(auth());
    expect(one.body.data.audioUrl).toBe(dataUri);

    const list = await request(app).get('/api/v1/admin/questions').set(auth());
    const row = list.body.data.find((q) => q._id === id);
    expect(row.hasAudio).toBe(true);
    expect(row.audioUrl).toBeUndefined();

    await request(app).delete(`/api/v1/admin/questions/${id}`).set(auth());
  });

  it('rejects an oversized audio payload', async () => {
    const huge = 'data:audio/mpeg;base64,' + 'A'.repeat(4_700_000);
    const res = await request(app).post('/api/v1/admin/questions').set(auth())
      .send(basePayload({ order: 9991, hasAudio: true, audioUrl: huge }));
    expect(res.status).toBe(400);
  });
});

describe('Admin CRUD: question reorder', () => {
  let typeId;
  const mk = (order, text) => ({
    typeId, order, text, questionType: 'LIKERT_SCALE', dimension: 'Communication', marks: 5,
    options: [1, 2, 3, 4, 5].map((n) => ({ optionText: `opt${n}`, score: n, order: n })),
  });

  beforeAll(async () => {
    const res = await request(app).get('/api/v1/admin/question-types').set(auth());
    typeId = res.body.data[0]._id;
  });

  it('swaps two questions\' orders and NEVER leaves a negative sentinel order', async () => {
    const a = (await request(app).post('/api/v1/admin/questions').set(auth()).send(mk(9971, 'reorder A'))).body.data;
    const b = (await request(app).post('/api/v1/admin/questions').set(auth()).send(mk(9972, 'reorder B'))).body.data;

    const res = await request(app).post('/api/v1/admin/questions/reorder').set(auth())
      .send({ orders: [{ id: a._id, order: 9972 }, { id: b._id, order: 9971 }] });
    expect(res.status).toBe(200);

    const list = await request(app).get('/api/v1/admin/questions').set(auth());
    const rowA = list.body.data.find((q) => q._id === a._id);
    const rowB = list.body.data.find((q) => q._id === b._id);
    // Orders were swapped...
    expect(rowA.order).toBe(9972);
    expect(rowB.order).toBe(9971);
    // ...and no ACTIVE question is left with a negative sentinel order (a
    // soft-deleted question may legitimately carry one; a live one must not).
    expect(list.body.data.filter((q) => q.isActive).every((q) => q.order >= 0)).toBe(true);

    await request(app).delete(`/api/v1/admin/questions/${a._id}`).set(auth());
    await request(app).delete(`/api/v1/admin/questions/${b._id}`).set(auth());
  });
});

describe('Admin dashboard + export', () => {
  it('returns dashboard stats', async () => {
    const res = await request(app).get('/api/v1/admin/dashboard').set(auth());
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.cards).toBeDefined();
  });

  it('exports results as CSV', async () => {
    const res = await request(app).get('/api/v1/admin/export/csv').set(auth());
    expect(res.status).toBe(200);
  });

  it('exports results as PDF', async () => {
    const res = await request(app).get('/api/v1/admin/export/pdf').set(auth());
    expect(res.status).toBe(200);
  });
});
