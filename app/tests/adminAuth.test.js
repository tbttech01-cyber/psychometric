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

  it('logs in and issues an OTP, then verifies it for a JWT', async () => {
    const loginRes = await request(app)
      .post('/api/v1/admin/login')
      .send({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD });
    expect(loginRes.status).toBe(200);
    expect(loginRes.body.success).toBe(true);

    const admin = await Admin.findOne({ email: ADMIN_EMAIL });
    expect(admin.otpCode).toMatch(/^\d{6}$/);

    const badOtp = await request(app)
      .post('/api/v1/admin/verify-otp')
      .send({ email: ADMIN_EMAIL, otp: '000000' });
    expect(badOtp.status).toBe(400);

    const verifyRes = await request(app)
      .post('/api/v1/admin/verify-otp')
      .send({ email: ADMIN_EMAIL, otp: admin.otpCode });
    expect(verifyRes.status).toBe(200);
    expect(verifyRes.body.token).toBeTruthy();
    expect(verifyRes.body.admin.email).toBe(ADMIN_EMAIL);
  });

  it('rejects protected routes without a token', async () => {
    const res = await request(app).get('/api/v1/admin/dashboard');
    expect(res.status).toBe(401);
  });
});
