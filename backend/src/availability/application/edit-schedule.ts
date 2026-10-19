import { SchedulingUnitOfWork } from '../../appointments/domain/scheduling-store';
import {
  AvailabilityWindow,
  createDateOverride,
  requireWeekday,
  DateOverride,
  validateWindows,
} from '../domain/availability';
import { assertScheduleEdit } from '../domain/schedule-edit-policy';
import { requireId, requireLocalDate } from '../../common/domain/validation';

export class EditSchedule {
  constructor(private readonly transactions: SchedulingUnitOfWork) {}

  async replaceWeekly(
    doctorId: string,
    weekday: number,
    input: readonly AvailabilityWindow[],
  ): Promise<void> {
    doctorId = requireId(doctorId);
    // Validate weekday even for leave (zero windows).
    requireWeekday(weekday);
    const windows = validateWindows(input);
    return this.transactions.run(async ({ schedules }) => {
      const doctor = await schedules.doctor(doctorId);
      const schedule = await schedules.schedule(doctorId);
      const weekly = [
        ...schedule.weekly.filter((item) => item.weekday !== weekday),
        ...windows.map((window) => ({
          ...window,
          id: doctorId,
          doctorId,
          weekday,
        })),
      ];
      assertScheduleEdit(
        doctor,
        { ...schedule, weekly },
        await schedules.doctorAppointments(doctorId),
      );
      await schedules.replaceWeekly(doctorId, weekday, windows);
    });
  }

  async putOverride(input: DateOverride): Promise<void> {
    const override = createDateOverride(input);
    return this.transactions.run(async ({ schedules }) => {
      const doctor = await schedules.doctor(override.doctorId);
      const schedule = await schedules.schedule(doctor.id);
      const overrides = [
        ...schedule.overrides.filter((item) => item.date !== override.date),
        override,
      ];
      assertScheduleEdit(
        doctor,
        { ...schedule, overrides },
        await schedules.doctorAppointments(doctor.id),
      );
      await schedules.putOverride(override);
    });
  }

  async removeOverride(doctorId: string, date: string): Promise<void> {
    doctorId = requireId(doctorId);
    requireLocalDate(date);
    return this.transactions.run(async ({ schedules }) => {
      const doctor = await schedules.doctor(doctorId);
      const schedule = await schedules.schedule(doctorId);
      const overrides = schedule.overrides.filter((item) => item.date !== date);
      assertScheduleEdit(
        doctor,
        { ...schedule, overrides },
        await schedules.doctorAppointments(doctorId),
      );
      await schedules.removeOverride(doctorId, date);
    });
  }
}
