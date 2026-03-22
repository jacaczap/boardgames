function easterSunday(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function fmt(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function polishHolidays(year: number): Set<string> {
  const easter = easterSunday(year);
  const dates = [
    new Date(year, 0, 1),
    new Date(year, 0, 6),
    new Date(year, 4, 1),
    new Date(year, 4, 3),
    new Date(year, 7, 15),
    new Date(year, 10, 1),
    new Date(year, 10, 11),
    new Date(year, 11, 25),
    new Date(year, 11, 26),
    easter,
    addDays(easter, 1),
    addDays(easter, 49),
    addDays(easter, 60),
  ];
  return new Set(dates.map(fmt));
}

export function isPolishHoliday(dateStr: string): boolean {
  const year = parseInt(dateStr.substring(0, 4), 10);
  return polishHolidays(year).has(dateStr);
}
