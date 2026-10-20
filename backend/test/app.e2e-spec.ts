import { configureHttp } from '../src/common/http/configure-http';
import { RequestLogger } from '../src/common/http/request-logger';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/prisma/prisma.service';
import { AppConfig } from './../src/common/config/app-config';
import { DatabaseReadiness } from '../src/health/database-readiness';

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;
  const database = { isReady: jest.fn<Promise<boolean>, []>() };

  beforeEach(async () => {
    database.isReady.mockReset().mockResolvedValue(true);
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(RequestLogger)
      .useValue({ write: () => undefined })
      .overrideProvider(PrismaService)
      .useValue({})
      .overrideProvider(DatabaseReadiness)
      .useValue(database)
      .overrideProvider(AppConfig)
      .useValue(
        AppConfig.fromEnvironment({
          DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
        }),
      )
      .compile();

    app = moduleFixture.createNestApplication();
    configureHttp(app);
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('/ (GET)', () => {
    return request(app.getHttpServer())
      .get('/')
      .expect(200)
      .expect('Hello World!');
  });

  it('liveness stays available without accessing the database', async () => {
    database.isReady.mockResolvedValue(false);
    await request(app.getHttpServer())
      .get('/health/live')
      .expect(200)
      .expect({ status: 'ok' });
    expect(database.isReady).not.toHaveBeenCalled();
  });

  it('readiness returns a safe correlated 503 when the database is down', async () => {
    database.isReady.mockResolvedValue(false);
    const response = await request(app.getHttpServer())
      .get('/health/ready')
      .expect(503);
    const requestId: unknown = response.headers['x-request-id'];
    expect(requestId).toEqual(expect.any(String));
    expect(response.body).toEqual({
      code: 'DATABASE_UNAVAILABLE',
      message: 'Database is temporarily unavailable',
      requestId,
    });
    expect(response.headers['cache-control']).toBe('no-store');
  });

  it('readiness recovers after the database is available', async () => {
    database.isReady.mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    await request(app.getHttpServer()).get('/health/ready').expect(503);
    await request(app.getHttpServer())
      .get('/health/ready')
      .expect(200)
      .expect({ status: 'ready' });
  });
});
