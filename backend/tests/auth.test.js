const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../server');

describe('Auth Endpoints', () => {
  beforeAll(async () => {
    // Wait for mongoose connection if needed, though supertest handles async starting
    // Just verify the DB connection
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  it('should fetch a CSRF token', async () => {
    const res = await request(app).get('/api/csrf-token');
    expect(res.statusCode).toEqual(200);
    expect(res.body).toHaveProperty('csrfToken');
  });

  it('should prevent access to protected routes without auth', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.statusCode).toEqual(401);
  });

  it('should fail login with invalid credentials', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'invalid@example.com',
        password: 'wrongpassword'
      });
    // Expected 401 Unauthorized or 400 Bad Request depending on implementation
    expect([400, 401, 403]).toContain(res.statusCode);
  });
});
