/** Local calendar day `YYYY-MM-DD` for `now` (device time zone). */
export function localDateKey(now: number): string {
  const d = new Date(now);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** 1 = Thứ hai (Monday) … 7 = Chủ nhật (Sunday), local time. */
export function weekdayOf(now: number): number {
  const day = new Date(now).getDay();
  return day === 0 ? 7 : day;
}

/** Minutes since local midnight. */
export function minuteOfDay(now: number): number {
  const d = new Date(now);
  return d.getHours() * 60 + d.getMinutes();
}

/** Local midnight (start of day) for `now`. */
export function startOfLocalDay(now: number): number {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}
