import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { RuleError } from '../domain/rule-error';
import { DomainValidationError } from '../domain/validation';
import { RequestContexts } from './request-context';

export interface ErrorEnvelope {
  readonly code: string;
  readonly message: string;
  readonly details?: Readonly<Record<string, unknown>>;
  readonly requestId: string;
}
function classify(error: unknown): {
  status: number;
  code: string;
  message: string;
  details?: Readonly<Record<string, unknown>>;
} {
  if (error instanceof DomainValidationError)
    return { status: 400, code: error.code, message: error.message };
  if (error instanceof RuleError)
    return {
      status:
        error.code === 'NOT_FOUND'
          ? 404
          : error.code === 'CLOCK_OVERRIDE_DISABLED'
            ? 403
            : 409,
      code: error.code,
      message: error.message,
      ...(error.appointmentIds.length
        ? { details: { appointmentIds: error.appointmentIds } }
        : {}),
    };
  if (error instanceof HttpException) {
    const status = error.getStatus();
    const response = error.getResponse();
    if (
      status === 400 &&
      typeof response === 'object' &&
      'code' in response &&
      response.code === 'VALIDATION_FAILED'
    )
      return {
        status,
        code: 'VALIDATION_FAILED',
        message: 'Request validation failed',
      };
    if (status >= 400 && status < 500)
      return {
        status,
        code:
          status === 404
            ? 'NOT_FOUND'
            : status === 413
              ? 'PAYLOAD_TOO_LARGE'
              : 'BAD_REQUEST',
        message:
          status === 404
            ? 'Resource not found'
            : status === 413
              ? 'Request body is too large'
              : 'Malformed request',
      };
  }
  return {
    status: 500,
    code: 'INTERNAL_ERROR',
    message: 'An unexpected error occurred',
  };
}
@Catch()
export class ApiErrorFilter implements ExceptionFilter {
  constructor(private readonly contexts: RequestContexts) {}
  catch(error: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();
    const failure = classify(error);
    this.contexts.fail(request, failure);
    const envelope: ErrorEnvelope = {
      code: failure.code,
      message: failure.message,
      ...(failure.details ? { details: failure.details } : {}),
      requestId: this.contexts.get(request).requestId,
    };
    response.status(failure.status).json(envelope);
  }
}
