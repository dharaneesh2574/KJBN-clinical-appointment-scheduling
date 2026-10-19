import {
  AvailabilityWindow,
  DateOverride,
  WeeklyAvailability,
} from './availability';
import { dayStart, isoWeekday } from '../../common/domain/clinic-time';
import { RuleError } from '../../common/domain/rule-error';

export interface DoctorSchedule {
  readonly weekly: readonly WeeklyAvailability[];
  readonly overrides: readonly DateOverride[];
}

export function effectiveWindows(
  schedule: DoctorSchedule,
  date: string,
): readonly AvailabilityWindow[] {
  const override = schedule.overrides.find((item) => item.date === date);
  return override
    ? override.windows
    : schedule.weekly.filter((item) => item.weekday === isoWeekday(date));
}

export function assertAvailable(
  schedule: DoctorSchedule,
  date: string,
  startsAt: string,
  endsAt: string,
  slotMinutes: number,
): void {
  const start = Date.parse(startsAt);
  const end = Date.parse(endsAt);
  const midnight = dayStart(date);
  const window = effectiveWindows(schedule, date).find(
    (item) =>
      start >= midnight + item.startMinute * 60000 &&
      end <= midnight + item.endMinute * 60000,
  );
  if (!window)
    throw new RuleError(
      'OUTSIDE_AVAILABILITY',
      'Appointment must fit effective availability',
    );
  if (
    (start - midnight - window.startMinute * 60000) % (slotMinutes * 60000) !==
    0
  ) {
    throw new RuleError(
      'OFF_GRID',
      'Appointment start must align to the window slot grid',
    );
  }
}
