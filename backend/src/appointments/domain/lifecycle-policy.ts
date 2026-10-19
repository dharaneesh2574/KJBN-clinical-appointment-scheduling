import { Appointment, AppointmentStatus } from './appointment';
import { DAY_MS } from '../../common/domain/clinic-time';
import { RuleError } from '../../common/domain/rule-error';

export function penaltyCount(
  history: readonly Appointment[],
  now: string,
): number {
  const time = Date.parse(now);
  return history.filter((item) => {
    const event =
      item.status === 'NO_SHOW'
        ? item.startsAt
        : item.status === 'LATE_CANCELLED'
          ? item.cancelledAt
          : null;
    if (event === null) return false;
    const instant = Date.parse(event);
    return instant > time - 30 * DAY_MS && instant <= time;
  }).length;
}

export function assertDeposit(
  history: readonly Appointment[],
  now: string,
  acknowledged: boolean,
): void {
  if (penaltyCount(history, now) >= 2 && !acknowledged) {
    throw new RuleError(
      'DEPOSIT_REQUIRED',
      'At least two recent penalties require deposit acknowledgement',
    );
  }
}

export function cancelAppointment(
  appointment: Appointment,
  now: string,
): Appointment {
  if (
    appointment.status === 'CANCELLED' ||
    appointment.status === 'LATE_CANCELLED'
  )
    return appointment;
  assertBooked(appointment);
  const status =
    Date.parse(appointment.startsAt) - Date.parse(now) >= 2 * 3600000
      ? 'CANCELLED'
      : 'LATE_CANCELLED';
  return { ...appointment, status, cancelledAt: now };
}

export function assertBooked(appointment: Appointment): void {
  if (appointment.status !== 'BOOKED')
    throw new RuleError(
      'INVALID_TRANSITION',
      'Only a booked appointment can change status',
    );
}

export function finishAppointment(
  appointment: Appointment,
  status: Extract<AppointmentStatus, 'COMPLETED' | 'NO_SHOW'>,
  now: string,
): Appointment {
  assertBooked(appointment);
  if (status !== 'COMPLETED' && status !== 'NO_SHOW')
    throw new RuleError('INVALID_TRANSITION', 'Unsupported final status');
  if (Date.parse(now) < Date.parse(appointment.endsAt))
    throw new RuleError(
      'INVALID_TRANSITION',
      'Completion and no-show require the appointment to have ended',
    );
  return { ...appointment, status };
}
