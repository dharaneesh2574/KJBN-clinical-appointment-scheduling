export type RuleCode =
  | 'PHONE_ALREADY_EXISTS'
  | 'NOT_FOUND'
  | 'DOCTOR_INACTIVE'
  | 'OUTSIDE_AVAILABILITY'
  | 'OFF_GRID'
  | 'DOCTOR_OVERLAP'
  | 'PATIENT_OVERLAP'
  | 'DAILY_CAP_REACHED'
  | 'DEPOSIT_REQUIRED'
  | 'INVALID_TRANSITION'
  | 'BOOKING_HORIZON'
  | 'SCHEDULE_CONFLICT'
  | 'CLOCK_OVERRIDE_DISABLED'
  | 'CONCURRENT_MODIFICATION';

export class RuleError extends Error {
  constructor(
    readonly code: RuleCode,
    message: string,
    readonly appointmentIds: readonly string[] = [],
  ) {
    super(message);
    this.name = 'RuleError';
  }
}
