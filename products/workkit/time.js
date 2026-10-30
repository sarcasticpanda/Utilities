// Adapted from ClockMath's lib/timesheet.ts (MIT), commit d5d0c2b.
// Source: https://github.com/clockmath/clockmath/blob/d5d0c2b3143efdf03d24350e1362fa638bb500da/lib/timesheet.ts
export const toMinutes = (time) => {
  if (!time) return null;
  const [hours, minutes] = time.split(':').map((part) => Number.parseInt(part, 10));
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;
  return hours * 60 + minutes;
};

export const isOvernight = ({ start, end }) => {
  const startMinutes = toMinutes(start);
  const endMinutes = toMinutes(end);
  return startMinutes !== null && endMinutes !== null && endMinutes < startMinutes;
};

/** Clock minutes between two HH:MM values; an earlier end means next day. */
export const clockMinutes = ({ start, end }) => {
  const startMinutes = toMinutes(start);
  const endMinutes = toMinutes(end);
  if (startMinutes === null || endMinutes === null) return 0;
  let duration = endMinutes - startMinutes;
  if (duration < 0) duration += 1440;
  return duration;
};
