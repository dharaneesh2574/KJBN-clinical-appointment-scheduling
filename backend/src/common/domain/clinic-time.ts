import { requireInstant, requireLocalDate } from './validation';

export const DAY_MS = 86400000;
const IST_OFFSET_MS = 330 * 60000;

// Asia/Kolkata has a fixed UTC+05:30 offset for this product's modern dates.
export function clinicDate(instant: string): string {
  return new Date(Date.parse(requireInstant(instant)) + IST_OFFSET_MS)
    .toISOString()
    .slice(0, 10);
}

export function dayStart(date: string): number {
  return Date.parse(`${requireLocalDate(date)}T00:00:00.000+05:30`);
}

export function isoWeekday(date: string): number {
  return new Date(`${requireLocalDate(date)}T00:00:00Z`).getUTCDay() || 7;
}
