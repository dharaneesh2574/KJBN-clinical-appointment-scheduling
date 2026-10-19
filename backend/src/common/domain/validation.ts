export class DomainValidationError extends Error {
  readonly code = 'INVALID_DOMAIN_VALUE';

  constructor(readonly field: string) {
    super(`Invalid ${field}`);
    this.name = 'DomainValidationError';
  }
}

export function requireText(
  value: string,
  field: string,
  maxLength: number,
): string {
  const normalized = value.trim();
  if (!normalized || normalized.length > maxLength) {
    throw new DomainValidationError(field);
  }
  return normalized;
}

export function requireId(value: string): string {
  if (
    !/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(value)
  ) {
    throw new DomainValidationError('id');
  }
  return value;
}

export function requireLocalDate(value: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith('0000-')) {
    throw new DomainValidationError('local date');
  }
  const date = new Date(`${value}T00:00:00.000Z`);
  if (
    !Number.isFinite(date.getTime()) ||
    date.toISOString().slice(0, 10) !== value
  ) {
    throw new DomainValidationError('local date');
  }
  return value;
}

export function requireInstant(value: string): string {
  // Reject normalized invalid calendar dates and timestamps without an offset.
  if (
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?(Z|[+-]\d{2}:\d{2})$/.test(
      value,
    )
  ) {
    throw new DomainValidationError('instant');
  }
  requireLocalDate(value.slice(0, 10));
  const date = new Date(value);
  if (!Number.isFinite(date.getTime()) || Number(value.slice(11, 13)) > 23) {
    throw new DomainValidationError('instant');
  }
  return date.toISOString();
}

export type SlotMinutes = 15 | 30;

export function requireSlotMinutes(value: number): SlotMinutes {
  if (value !== 15 && value !== 30) {
    throw new DomainValidationError('slot minutes');
  }
  return value;
}
