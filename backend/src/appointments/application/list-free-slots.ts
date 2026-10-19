import { SchedulingUnitOfWork } from '../domain/scheduling-store';
import { assertCapacity } from '../domain/booking-policy';
import { effectiveWindows } from '../../availability/domain/effective-availability';
import { dayStart } from '../../common/domain/clinic-time';
import { Clock } from '../../common/domain/clock';
import {
  requireId,
  requireInstant,
  requireLocalDate,
} from '../../common/domain/validation';
import { RuleError } from '../../common/domain/rule-error';
import { assertHorizon } from '../domain/booking-policy';

export interface FreeSlot {
  readonly startsAt: string;
  readonly endsAt: string;
}

export class ListFreeSlots {
  constructor(
    private readonly transactions: SchedulingUnitOfWork,
    private readonly clock: Clock,
  ) {}
  async execute(doctorId: string, date: string): Promise<readonly FreeSlot[]> {
    doctorId = requireId(doctorId);
    requireLocalDate(date);
    const now = requireInstant(this.clock.now());
    return this.transactions.run(async ({ booking }) => {
      const doctor = await booking.doctor(doctorId);
      const schedule = await booking.schedule(doctorId);
      const appointments = await booking.doctorAppointments(doctorId);
      const slots: FreeSlot[] = [];
      for (const window of effectiveWindows(schedule, date)) {
        for (
          let minute = window.startMinute;
          minute + doctor.slotMinutes <= window.endMinute;
          minute += doctor.slotMinutes
        ) {
          const startsAt = new Date(
            dayStart(date) + minute * 60000,
          ).toISOString();
          const endsAt = new Date(
            Date.parse(startsAt) + doctor.slotMinutes * 60000,
          ).toISOString();
          try {
            assertHorizon(startsAt, now);
            assertCapacity(doctor, { startsAt, endsAt }, appointments, []);
            slots.push({ startsAt, endsAt });
          } catch (error) {
            if (
              !(error instanceof RuleError) ||
              ![
                'BOOKING_HORIZON',
                'DOCTOR_INACTIVE',
                'DOCTOR_OVERLAP',
                'DAILY_CAP_REACHED',
              ].includes(error.code)
            )
              throw error;
          }
        }
      }
      return slots;
    });
  }
}
