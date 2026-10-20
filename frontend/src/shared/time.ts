export const clinicTimezone = "Asia/Kolkata";
export function clinicDate(instant: string | number = Date.now()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: clinicTimezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(instant));
  const part = (type: string) =>
    parts.find((p) => p.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}
export function time(instant: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: clinicTimezone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(instant));
}
export function dateLabel(date: string, full = false): string {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: clinicTimezone,
    weekday: full ? "long" : "short",
    day: "numeric",
    month: full ? "long" : "short",
    year: "numeric",
  }).format(new Date(`${date}T12:00:00+05:30`));
}
export function dateTime(instant: string): string {
  return `${dateLabel(clinicDate(instant))}, ${time(instant)} IST`;
}
export function shiftDate(date: string, days: number): string {
  return clinicDate(Date.parse(`${date}T12:00:00+05:30`) + days * 86400000);
}
export function minuteInput(minute: number): string {
  return `${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`;
}
export function minuteValue(value: string): number {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}
export function isReviewInstant(value: string): boolean {
  return (
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})$/.test(
      value,
    ) && Number.isFinite(Date.parse(value))
  );
}
