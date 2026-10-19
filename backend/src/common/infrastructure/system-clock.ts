import { Clock } from '../domain/clock';

export class SystemClock extends Clock {
  now(): string {
    return new Date().toISOString();
  }
}
