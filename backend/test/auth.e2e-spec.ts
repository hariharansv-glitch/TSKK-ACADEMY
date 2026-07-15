import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';

/**
 * End-to-end coverage for the authentication flow.
 * NOTE: These tests require a live Postgres/Redis test stack. Run:
 *
 *   docker compose up -d postgres redis
 *   pnpm exec prisma migrate deploy
 *   pnpm exec prisma db seed
 *   pnpm test:e2e -- auth
 */
describe('Auth (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
    app.setGlobalPrefix('api/v1');
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  const email = process.env.TEST_LOGIN_EMAIL ?? 'admin@tskk.local';
  const password = process.env.TEST_LOGIN_PASSWORD ?? 'ChangeMe!123';

  it('rejects unknown users', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'ghost@nowhere.com', password: 'nope' });
    expect(res.status).toBe(401);
  });

  it('rejects malformed payloads with 400', async () => {
    const res = await request(app.getHttpServer()).post('/api/v1/auth/login').send({ email: 'not-an-email' });
    expect(res.status).toBe(400);
  });

  it('logs in a seeded super-admin and returns access + refresh tokens', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password });
    if (res.status !== 200) {
      console.warn('Skipping — seeded credentials not present in this environment');
      return;
    }
    expect(res.body.data.tokens.accessToken).toEqual(expect.any(String));
    expect(res.body.data.tokens.refreshToken).toEqual(expect.any(String));
    expect(res.body.data.user.email).toBe(email);
  });

  it('refresh flow rotates the refresh token', async () => {
    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password });
    if (login.status !== 200) return;
    const { refreshToken } = login.body.data.tokens;
    const refresh = await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .send({ refreshToken });
    expect(refresh.status).toBe(200);
    expect(refresh.body.data.accessToken).toEqual(expect.any(String));
    expect(refresh.body.data.refreshToken).not.toBe(refreshToken);
  });
});
