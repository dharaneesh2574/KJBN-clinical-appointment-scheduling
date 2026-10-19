import { SchedulingUnitOfWork } from '../../appointments/domain/scheduling-store';
import { assertScheduleEdit } from '../../availability/domain/schedule-edit-policy';
import { createDoctor, Doctor } from '../domain/doctor';

export class UpdateDoctor {
  constructor(private readonly transactions: SchedulingUnitOfWork) {}

  async execute(input: Doctor): Promise<void> {
    const doctor = createDoctor(input);
    return this.transactions.run(async ({ schedules }) => {
      await schedules.doctor(doctor.id);
      assertScheduleEdit(
        doctor,
        await schedules.schedule(doctor.id),
        await schedules.doctorAppointments(doctor.id),
      );
      await schedules.updateDoctor(doctor);
    });
  }
}
