import { Appointment } from '../domain/appointment';
import { SchedulingUnitOfWork } from '../domain/scheduling-store';
import {
  cancelAppointment,
  finishAppointment,
} from '../domain/lifecycle-policy';
import { Clock } from '../../common/domain/clock';
import { requireId, requireInstant } from '../../common/domain/validation';

export class CancelAppointment {
  constructor(
    private readonly transactions: SchedulingUnitOfWork,
    private readonly clock: Clock,
  ) {}
  async execute(id: string): Promise<Appointment> {
    id = requireId(id);
    const now = requireInstant(this.clock.now());
    return this.transactions.run(async ({ booking }) => {
      const original = await booking.appointment(id);
      const cancelled = cancelAppointment(original, now);
      return cancelled === original
        ? original
        : booking.updateAppointment(cancelled, now);
    });
  }
}

export class FinishAppointment {
  constructor(
    private readonly transactions: SchedulingUnitOfWork,
    private readonly clock: Clock,
  ) {}
  async execute(
    id: string,
    status: 'COMPLETED' | 'NO_SHOW',
  ): Promise<Appointment> {
    id = requireId(id);
    const now = requireInstant(this.clock.now());
    return this.transactions.run(async ({ booking }) =>
      booking.updateAppointment(
        finishAppointment(await booking.appointment(id), status, now),
        now,
      ),
    );
  }
}
