import { Injectable } from '@nestjs/common';
import type { Request, Response } from 'express';
import { RequestContexts } from './request-context';

export interface RequestLog {
  readonly timestamp: string;
  readonly level: 'info' | 'warn' | 'error';
  readonly requestId: string;
  readonly operation: string;
  readonly status: number;
  readonly elapsedMs: number;
  readonly code?: string;
  readonly ids: Readonly<Record<string, string>>;
}
@Injectable()
export class RequestLogger {
  write(record: RequestLog): void {
    process.stdout.write(`${JSON.stringify(record)}\n`);
  }
}
function routeOperation(request: Request): string {
  const route: unknown = request.route;
  const path =
    typeof route === 'object' &&
    route !== null &&
    'path' in route &&
    typeof route.path === 'string'
      ? route.path
      : '<unmatched>';
  const method = [
    'GET',
    'POST',
    'PUT',
    'PATCH',
    'DELETE',
    'OPTIONS',
    'HEAD',
  ].includes(request.method)
    ? request.method
    : '<unknown>';
  return `${method} ${path}`;
}
function safeIds(request: Request): Readonly<Record<string, string>> {
  const ids: Record<string, string> = {};
  for (const field of ['id', 'doctorId', 'patientId']) {
    const value: unknown = request.params[field];
    if (
      typeof value === 'string' &&
      /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(value)
    )
      ids[field] = value.toLowerCase();
  }
  return ids;
}
export function logCompletedRequest(
  contexts: RequestContexts,
  logger: RequestLogger,
  request: Request,
  response: Response,
): void {
  const state = contexts.get(request);
  const status = response.statusCode;
  logger.write({
    timestamp: new Date().toISOString(),
    level: status >= 500 ? 'error' : status >= 400 ? 'warn' : 'info',
    requestId: state.requestId,
    operation: routeOperation(request),
    status,
    elapsedMs: Math.round((performance.now() - state.startedAt) * 100) / 100,
    code: state.failure?.code,
    ids: safeIds(request),
  });
}
