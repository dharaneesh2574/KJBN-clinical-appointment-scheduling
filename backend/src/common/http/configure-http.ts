import {
  BadRequestException,
  INestApplication,
  ValidationPipe,
} from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppConfig } from '../config/app-config';
import { ApiErrorFilter } from './api-error.filter';
import { RequestContexts } from './request-context';
import { logCompletedRequest, RequestLogger } from './request-logger';

export function configureHttp(app: INestApplication): void {
  const config = app.get(AppConfig);
  const contexts = app.get(RequestContexts);
  const logger = app.get(RequestLogger);
  app.use((request: Request, response: Response, next: NextFunction) => {
    const state = contexts.begin(request);
    response.setHeader('X-Request-Id', state.requestId);
    response.setHeader('Cache-Control', 'no-store');
    response.once('finish', () =>
      logCompletedRequest(contexts, logger, request, response),
    );
    next();
  });
  app.enableCors({
    origin: config.corsOrigins,
    allowedHeaders: ['Content-Type', 'X-Review-Now'],
    exposedHeaders: ['X-Request-Id'],
  });
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
      forbidUnknownValues: true,
      transformOptions: { enableImplicitConversion: false },
      validationError: { target: false, value: false },
      exceptionFactory: () =>
        new BadRequestException({ code: 'VALIDATION_FAILED' }),
    }),
  );
  app.useGlobalFilters(new ApiErrorFilter(contexts));
  const document = SwaggerModule.createDocument(
    app,
    new DocumentBuilder()
      .setTitle('KJBN Clinic Appointment Scheduler')
      .setDescription(
        'Problem 2 JSON API. Instants are UTC, calendar dates and local-minute availability use Asia/Kolkata. X-Review-Now accepts a timestamp with an explicit timezone only when REVIEW_MODE=true. All responses have a server-generated X-Request-Id. Free slots are advisory; booking rechecks every rule.',
      )
      .setVersion('0.3.0')
      .build(),
  );
  SwaggerModule.setup('docs', app, document, { jsonDocumentUrl: 'docs-json' });
}
