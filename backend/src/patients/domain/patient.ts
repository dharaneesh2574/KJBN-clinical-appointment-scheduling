import {
  DomainValidationError,
  requireId,
  requireLocalDate,
  requireText,
} from '../../common/domain/validation';

export type PatientFlag = 'MOBILITY_ASSISTANCE' | 'INTERPRETER_REQUIRED';

export interface Patient {
  readonly id: string;
  readonly name: string;
  readonly phone: string;
  readonly dateOfBirth: string;
  readonly flags: readonly PatientFlag[];
}

export function normalizePhone(phone: string): string {
  if (typeof phone !== 'string')
    throw new DomainValidationError('international phone');
  const normalized = phone.replace(/[\s().-]/g, '');
  if (!/^\+[1-9]\d{7,14}$/.test(normalized)) {
    throw new DomainValidationError('international phone');
  }
  return normalized;
}

export function createPatient(input: Patient, today: string): Patient {
  const dateOfBirth = requireLocalDate(input.dateOfBirth);
  if (dateOfBirth > requireLocalDate(today)) {
    throw new DomainValidationError('future date of birth');
  }
  if (!Array.isArray(input.flags))
    throw new DomainValidationError('patient flags');
  if (
    input.flags.some(
      (flag: PatientFlag) =>
        flag !== 'MOBILITY_ASSISTANCE' && flag !== 'INTERPRETER_REQUIRED',
    )
  ) {
    throw new DomainValidationError('patient flags');
  }
  return {
    id: requireId(input.id),
    name: requireText(input.name, 'patient name', 120),
    phone: normalizePhone(input.phone),
    dateOfBirth,
    flags: [...new Set(input.flags)],
  };
}
