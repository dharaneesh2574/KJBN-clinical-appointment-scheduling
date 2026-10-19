import {
  DomainValidationError,
  requireId,
  requireSlotMinutes,
  requireText,
  SlotMinutes,
} from '../../common/domain/validation';

export interface Doctor {
  readonly id: string;
  readonly name: string;
  readonly speciality: string;
  readonly slotMinutes: SlotMinutes;
  readonly dailyCap: number;
  readonly active: boolean;
}

export function createDoctor(
  input: Omit<Doctor, 'slotMinutes'> & { readonly slotMinutes: number },
): Doctor {
  if (typeof input.active !== 'boolean')
    throw new DomainValidationError('doctor active');
  if (
    !Number.isSafeInteger(input.dailyCap) ||
    input.dailyCap < 1 ||
    input.dailyCap > 2147483647
  ) {
    throw new DomainValidationError('daily cap');
  }
  return {
    active: input.active,
    dailyCap: input.dailyCap,
    id: requireId(input.id),
    name: requireText(input.name, 'doctor name', 120),
    speciality: requireText(input.speciality, 'speciality', 120),
    slotMinutes: requireSlotMinutes(input.slotMinutes),
  };
}
