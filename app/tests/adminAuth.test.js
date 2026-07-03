const request = require('supertest');
const app = require('../backend/app');
const { connect, disconnect } = require('./dbConnect');
const Admin = require('../backend/models/Admin');

beforeAll(connect);
afterAll(disconnect);

const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

describe('Admin auth flow', () => {
  it('rejects login with wrong password', async () => {
    const res = await request(app)
      .post('/api/v1/admin/login')
      .send({ email: ADMIN_EMAIL, password: 'wrong-password' });
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('logs in with email and password and issues a JWT directly', async () => {
    const loginRes = await request(app)
      .post('/api/v1/admin/login')
      .send({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD });
    expect(loginRes.status).toBe(200);
    expect(loginRes.body.success).toBe(true);
    expect(loginRes.body.token).toBeTruthy();
    expect(loginRes.body.admin.email).toBe(ADMIN_EMAIL);

    const admin = await Admin.findOne({ email: ADMIN_EMAIL });
    expect(admin.activeToken).toBe(loginRes.body.token);
  });

  it('rejects protected routes without a token', async () => {
    const res = await request(app).get('/api/v1/admin/dashboard');
    expect(res.status).toBe(401);
  });
});
