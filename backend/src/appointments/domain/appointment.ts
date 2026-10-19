import {
  DomainValidationError,
  requireId,
  requireInstant,
  requireSlotMinutes,
  requireText,
  SlotMinutes,
} from '../../common/domain/validation';

export type AppointmentStatus =
  'BOOKED' | 'COMPLETED' | 'CANCELLED' | 'LATE_CANCELLED' | 'NO_SHOW';

export interface Appointment {
  readonly id: string;
  readonly doctorId: string;
  readonly patientId: string;
  readonly startsAt: string;
  readonly endsAt: string;
  readonly slotMinutes: SlotMinutes;
  readonly status: AppointmentStatus;
  readonly reason: string;
  readonly cancelledAt: string | null;
  readonly depositAcknowledgedAt: string | null;
  readonly rescheduledFromId: string | null;
}

export interface AppointmentStatusEvent {
  readonly id: string;
  readonly appointmentId: string;
  readonly fromStatus: AppointmentStatus | null;
  readonly toStatus: AppointmentStatus;
  readonly occurredAt: string;
}

export function createAppointment(input: Appointment): Appointment {
  const startsAt = requireInstant(input.startsAt);
  const endsAt = requireInstant(input.endsAt);
  const slotMinutes = requireSlotMinutes(input.slotMinutes);
  if (Date.parse(endsAt) - Date.parse(startsAt) !== slotMinutes * 60000) {
    throw new DomainValidationError('appointment duration');
  }
  if (
    !['BOOKED', 'COMPLETED', 'CANCELLED', 'LATE_CANCELLED', 'NO_SHOW'].includes(
      input.status,
    )
  ) {
    throw new DomainValidationError('appointment status');
  }
  const cancelled =
    input.status === 'CANCELLED' || input.status === 'LATE_CANCELLED';
  if (cancelled !== (input.cancelledAt !== null)) {
    throw new DomainValidationError('cancellation timestamp');
  }
  if (input.rescheduledFromId === input.id) {
    throw new DomainValidationError('reschedule predecessor');
  }
  return {
    ...input,
    id: requireId(input.id),
    doctorId: requireId(input.doctorId),
    patientId: requireId(input.patientId),
    startsAt,
    endsAt,
    slotMinutes,
    reason: requireText(input.reason, 'appointment reason', 500),
    cancelledAt:
      input.cancelledAt === null ? null : requireInstant(input.cancelledAt),
    depositAcknowledgedAt:
      input.depositAcknowledgedAt === null
        ? null
        : requireInstant(input.depositAcknowledgedAt),
    rescheduledFromId:
      input.rescheduledFromId === null
        ? null
        : requireId(input.rescheduledFromId),
  };
}
