import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import type { Request } from 'express';
import { Clock, FixedClock, snapshotClock } from '../domain/clock';
import { DomainValidationError } from '../domain/validation';
import { RuleError } from '../domain/rule-error';
import { SystemClock } from '../infrastructure/system-clock';

export interface HttpFailure {
  readonly code: string;
  readonly status: number;
}
interface RequestState {
  readonly requestId: string;
  readonly startedAt: number;
  readonly arrival: string;
  clock?: Clock;
  failure?: HttpFailure;
}
@Injectable()
export class RequestContexts {
  private readonly states = new WeakMap<Request, RequestState>();
  constructor(private readonly systemClock: SystemClock) {}
  begin(request: Request): RequestState {
    const state = {
      requestId: randomUUID(),
      startedAt: performance.now(),
      arrival: this.systemClock.now(),
    };
    this.states.set(request, state);
    return state;
  }
  get(request: Request): RequestState {
    const state = this.states.get(request);
    if (!state) throw new Error('Request context was not initialized');
    return state;
  }
  clock(request: Request, reviewMode: boolean): Clock {
    const state = this.get(request);
    if (state.clock) return state.clock;
    const override = request.headers['x-review-now'];
    if (override !== undefined && !reviewMode)
      throw new RuleError(
        'CLOCK_OVERRIDE_DISABLED',
        'Reviewer clock is disabled',
      );
    if (override !== undefined && typeof override !== 'string')
      throw new DomainValidationError('reviewer clock header');
    state.clock = snapshotClock(
      new FixedClock(state.arrival),
      reviewMode,
      override,
    );
    return state.clock;
  }
  fail(request: Request, failure: HttpFailure): void {
    this.get(request).failure = failure;
  }
}
