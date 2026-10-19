import {
  DomainValidationError,
  requireId,
  requireLocalDate,
  requireText,
} from '../../common/domain/validation';

export interface AvailabilityWindow {
  readonly startMinute: number;
  readonly endMinute: number;
}

export interface WeeklyAvailability extends AvailabilityWindow {
  readonly id: string;
  readonly doctorId: string;
  readonly weekday: number;
}

export interface DateOverride {
  readonly id: string;
  readonly doctorId: string;
  readonly date: string;
  readonly reason: string;
  readonly windows: readonly AvailabilityWindow[];
}

export function validateWindows(
  windows: readonly AvailabilityWindow[],
): readonly AvailabilityWindow[] {
  const sorted = windows
    .map((window) => ({ ...window }))
    .sort((a, b) => a.startMinute - b.startMinute);
  for (let index = 0; index < sorted.length; index += 1) {
    const window = sorted[index];
    if (
      !Number.isInteger(window.startMinute) ||
      !Number.isInteger(window.endMinute) ||
      window.startMinute < 0 ||
      window.endMinute > 1440 ||
      window.endMinute <= window.startMinute
    ) {
      throw new DomainValidationError('availability window');
    }
    if (index > 0 && sorted[index - 1].endMinute > window.startMinute) {
      throw new DomainValidationError('overlapping availability windows');
    }
  }
  return sorted;
}

export function createWeeklyAvailability(
  input: WeeklyAvailability,
): WeeklyAvailability {
  if (
    !Number.isInteger(input.weekday) ||
    input.weekday < 1 ||
    input.weekday > 7
  ) {
    throw new DomainValidationError('ISO weekday');
  }
  validateWindows([input]);
  return {
    ...input,
    id: requireId(input.id),
    doctorId: requireId(input.doctorId),
  };
}

export function createDateOverride(input: DateOverride): DateOverride {
  return {
    ...input,
    id: requireId(input.id),
    doctorId: requireId(input.doctorId),
    date: requireLocalDate(input.date),
    reason: requireText(input.reason, 'override reason', 500),
    windows: validateWindows(input.windows),
  };
}
