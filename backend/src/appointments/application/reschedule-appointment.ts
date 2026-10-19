import { Appointment } from '../domain/appointment';
import { SchedulingUnitOfWork } from '../domain/scheduling-store';
import { assertBooked, cancelAppointment } from '../domain/lifecycle-policy';
import { Clock } from '../../common/domain/clock';
import { requireId, requireInstant } from '../../common/domain/validation';
import {
  BookInput,
  bookInTransaction,
  validateBookInput,
} from './book-appointment';

export type RescheduleInput = Omit<BookInput, 'patientId'>;

export class RescheduleAppointment {
  constructor(
    private readonly transactions: SchedulingUnitOfWork,
    private readonly clock: Clock,
  ) {}
  async execute(id: string, input: RescheduleInput): Promise<Appointment> {
    id = requireId(id);
    const now = requireInstant(this.clock.now());
    return this.transactions.run(async ({ booking }) => {
      const original = await booking.appointment(id);
      assertBooked(original);
      const replacement = validateBookInput({
        ...input,
        patientId: original.patientId,
      });
      await booking.updateAppointment(cancelAppointment(original, now), now);
      // History now includes the original's late penalty. Rejection rolls it back.
      return bookInTransaction(booking, replacement, now, original.id);
    });
  }
}
