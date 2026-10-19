import { Appointment } from '../domain/appointment';
import { BookingStore, SchedulingUnitOfWork } from '../domain/scheduling-store';
import { assertCapacity, assertHorizon } from '../domain/booking-policy';
import { assertDeposit } from '../domain/lifecycle-policy';
import { assertAvailable } from '../../availability/domain/effective-availability';
import { clinicDate } from '../../common/domain/clinic-time';
import { Clock } from '../../common/domain/clock';
import {
  DomainValidationError,
  requireId,
  requireInstant,
  requireText,
} from '../../common/domain/validation';

export interface BookInput {
  readonly doctorId: string;
  readonly patientId: string;
  readonly startsAt: string;
  readonly reason: string;
  readonly depositAcknowledged: boolean;
}

export function validateBookInput(input: BookInput): BookInput {
  if (typeof input.depositAcknowledged !== 'boolean')
    throw new DomainValidationError('deposit acknowledgement');
  return {
    doctorId: requireId(input.doctorId),
    patientId: requireId(input.patientId),
    startsAt: requireInstant(input.startsAt),
    reason: requireText(input.reason, 'appointment reason', 500),
    depositAcknowledged: input.depositAcknowledged,
  };
}

// Shared by booking and atomic rescheduling; never opens its own transaction.
export async function bookInTransaction(
  store: BookingStore,
  input: BookInput,
  now: string,
  predecessor: string | null = null,
): Promise<Appointment> {
  assertHorizon(input.startsAt, now);
  const doctor = await store.doctor(input.doctorId);
  await store.patientExists(input.patientId);
  const endsAt = new Date(
    Date.parse(input.startsAt) + doctor.slotMinutes * 60000,
  ).toISOString();
  const schedule = await store.schedule(doctor.id);
  assertAvailable(
    schedule,
    clinicDate(input.startsAt),
    input.startsAt,
    endsAt,
    doctor.slotMinutes,
  );
  const history = await store.patientHistory(input.patientId);
  assertCapacity(
    doctor,
    { startsAt: input.startsAt, endsAt },
    await store.doctorAppointments(doctor.id),
    history,
  );
  assertDeposit(history, now, input.depositAcknowledged);
  return store.insertAppointment(
    {
      doctorId: doctor.id,
      patientId: input.patientId,
      startsAt: input.startsAt,
      endsAt,
      slotMinutes: doctor.slotMinutes,
      status: 'BOOKED',
      reason: input.reason,
      cancelledAt: null,
      depositAcknowledgedAt: input.depositAcknowledged ? now : null,
      rescheduledFromId: predecessor,
    },
    now,
  );
}

export class BookAppointment {
  constructor(
    private readonly transactions: SchedulingUnitOfWork,
    private readonly clock: Clock,
  ) {}
  async execute(raw: BookInput): Promise<Appointment> {
    const input = validateBookInput(raw);
    const now = requireInstant(this.clock.now());
    return this.transactions.run(({ booking }) =>
      bookInTransaction(booking, input, now),
    );
  }
}
