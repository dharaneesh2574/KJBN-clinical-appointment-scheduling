import { requireInstant } from './validation';
import { RuleError } from './rule-error';

export abstract class Clock {
  abstract now(): string;
}

// The transport will create one of these per request in M3. No mutable global time.
export class FixedClock extends Clock {
  private readonly instant: string;
  constructor(instant: string) {
    super();
    this.instant = requireInstant(instant);
    Object.freeze(this);
  }
  now(): string {
    return this.instant;
  }
}

export function snapshotClock(
  source: Clock,
  reviewMode: boolean,
  override?: string,
): Clock {
  if (override !== undefined && !reviewMode) {
    throw new RuleError(
      'CLOCK_OVERRIDE_DISABLED',
      'Reviewer clock is disabled',
    );
  }
  return new FixedClock(override ?? source.now());
}
