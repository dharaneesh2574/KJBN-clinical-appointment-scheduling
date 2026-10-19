import { Appointment } from './appointment';
import { Doctor } from '../../doctors/domain/doctor';
import { clinicDate, DAY_MS } from '../../common/domain/clinic-time';
import { RuleError } from '../../common/domain/rule-error';
import { requireInstant } from '../../common/domain/validation';

export function occupies(appointment: Appointment): boolean {
  return (
    appointment.status === 'BOOKED' ||
    appointment.status === 'COMPLETED' ||
    appointment.status === 'NO_SHOW'
  );
}

export function overlaps(
  a: Pick<Appointment, 'startsAt' | 'endsAt'>,
  b: Pick<Appointment, 'startsAt' | 'endsAt'>,
): boolean {
  return (
    Date.parse(a.startsAt) < Date.parse(b.endsAt) &&
    Date.parse(b.startsAt) < Date.parse(a.endsAt)
  );
}

export function assertHorizon(startsAt: string, now: string): void {
  const start = Date.parse(requireInstant(startsAt));
  const time = Date.parse(requireInstant(now));
  if (start < time || start > time + 60 * DAY_MS) {
    throw new RuleError(
      'BOOKING_HORIZON',
      'Booking must start between now and 60 elapsed days ahead',
    );
  }
}

export function assertCapacity(
  doctor: Doctor,
  candidate: Pick<Appointment, 'startsAt' | 'endsAt'>,
  doctorAppointments: readonly Appointment[],
  patientAppointments: readonly Appointment[],
): void {
  if (!doctor.active)
    throw new RuleError('DOCTOR_INACTIVE', 'Doctor is inactive');
  if (
    doctorAppointments.some(
      (item) => occupies(item) && overlaps(item, candidate),
    )
  ) {
    throw new RuleError(
      'DOCTOR_OVERLAP',
      'Doctor already has an overlapping appointment',
    );
  }
  if (
    patientAppointments.some(
      (item) => occupies(item) && overlaps(item, candidate),
    )
  ) {
    throw new RuleError(
      'PATIENT_OVERLAP',
      'Patient already has an overlapping appointment',
    );
  }
  const count = doctorAppointments.filter(
    (item) =>
      occupies(item) &&
      clinicDate(item.startsAt) === clinicDate(candidate.startsAt),
  ).length;
  if (count >= doctor.dailyCap)
    throw new RuleError(
      'DAILY_CAP_REACHED',
      'Doctor daily appointment cap reached',
    );
}
