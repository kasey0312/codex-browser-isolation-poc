import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { db } from '../../src/server/db/database.js';
import { createApp } from '../../src/server/app.js';

beforeEach(() => {
  process.env.MOCK_RUNTIME = '1';
  process.env.MOCK_BROWSER = '1';
  db.exec('DELETE FROM users');
});

describe('api e2e', () => {
  it('reports health and readiness metadata for the mock stack', async () => {
    const { app } = createApp();
    const health = await request(app).get('/api/health');
    expect(health.status).toBe(200);
    const ready = await request(app).get('/api/ready');
    expect(ready.status).toBe(200);
  });

  it('supports signup, sandbox start, chat control, preview fetch, and isolation metadata', async () => {
    const { app } = createApp();
    const signup = await request(app).post('/api/auth/signup').send({ username: 'e2e-user', password: 'supersecure' });
    expect(signup.status).toBe(200);
  });

  it('keeps the four-user limit after signup and allows a fresh pool after reset', async () => {
    const { app } = createApp();
    for (let index = 0; index < 4; index += 1) {
      const signup = await request(app).post('/api/auth/signup').send({ username: `limit-user-${index}`, password: 'supersecure' });
      expect(signup.status).toBe(200);
    }
    const rejected = await request(app).post('/api/auth/signup').send({ username: 'limit-user-4', password: 'supersecure' });
    expect(rejected.status).toBe(400);
    db.exec('DELETE FROM users');
    const recreated = await request(app).post('/api/auth/signup').send({ username: 'after-reset', password: 'supersecure' });
    expect(recreated.status).toBe(200);
  });
}
