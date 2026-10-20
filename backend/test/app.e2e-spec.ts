import { configureHttp } from '../src/common/http/configure-http';
import { RequestLogger } from '../src/common/http/request-logger';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/prisma/prisma.service';
import { AppConfig } from './../src/common/config/app-config';

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(RequestLogger)
      .useValue({ write: () => undefined })
      .overrideProvider(PrismaService)
      .useValue({})
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
});
