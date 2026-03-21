export function parseDateOnly(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

export function formatDateOnly(value: Date) {
  return value.toISOString().slice(0, 10);
}

export function addHours(value: Date, hours: number) {
  return new Date(value.getTime() + hours * 60 * 60 * 1000);
}

export function isWithinDateWindow(target: Date, from: Date, to: Date) {
  return target >= from && target <= to;
}

export function addDays(value: Date, days: number) {
  return new Date(value.getTime() + days * 24 * 60 * 60 * 1000);
}

