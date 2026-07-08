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
