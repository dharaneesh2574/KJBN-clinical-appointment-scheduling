import { Appointment } from '../../appointments/domain/appointment';
import { occupies } from '../../appointments/domain/booking-policy';
import { Doctor } from '../../doctors/domain/doctor';
import { clinicDate } from '../../common/domain/clinic-time';
import { RuleError } from '../../common/domain/rule-error';
import { assertAvailable, DoctorSchedule } from './effective-availability';

export function assertScheduleEdit(
  doctor: Doctor,
  schedule: DoctorSchedule,
  appointments: readonly Appointment[],
): void {
  const occupied = appointments.filter(occupies);
  const counts = new Map<string, number>();
  for (const item of occupied) {
    const date = clinicDate(item.startsAt);
    counts.set(date, (counts.get(date) ?? 0) + 1);
  }
  const conflicts = occupied.filter((item) => {
    if (
      (!doctor.active && item.status === 'BOOKED') ||
      (counts.get(clinicDate(item.startsAt)) ?? 0) > doctor.dailyCap
    )
      return true;
    try {
      // Historical duration snapshots remain intact; starts must fit the new grid.
      assertAvailable(
        schedule,
        clinicDate(item.startsAt),
        item.startsAt,
        item.endsAt,
        doctor.slotMinutes,
      );
      return false;
    } catch (error) {
      if (!(error instanceof RuleError)) throw error;
      return true;
    }
  });
  if (conflicts.length)
    throw new RuleError(
      'SCHEDULE_CONFLICT',
      'Edit would invalidate occupied appointments',
      conflicts.map((item) => item.id),
    );
}
