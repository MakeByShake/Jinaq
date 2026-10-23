import {
  addDays, addMonths, addWeeks, addYears, differenceInCalendarDays, endOfMonth, format, parseISO,
  startOfMonth,
} from 'date-fns';
import type { Frequency } from './types';

/** Local calendar date as YYYY-MM-DD (never UTC-shifted). */
export function toDay(d: Date = new Date()): string {
  return format(d, 'yyyy-MM-dd');
}

export function todayISO(): string {
  return toDay(new Date());
}

export function parseDay(day: string): Date {
  // Accept both "YYYY-MM-DD" and full ISO strings from older data.
  return day.length > 10 ? new Date(day) : parseISO(day);
}

export function nextOccurrence(day: string, freq: Frequency): string {
  const d = parseDay(day);
  const next = freq === 'weekly' ? addWeeks(d, 1) : freq === 'yearly' ? addYears(d, 1) : addMonths(d, 1);
  return toDay(next);
}

export function daysUntil(day: string, from: Date = new Date()): number {
  return differenceInCalendarDays(parseDay(day), from);
}

export interface DayRange {
  from: string; // inclusive
  to: string; // inclusive
}

export function monthRange(offset = 0, base: Date = new Date()): DayRange {
  const m = addMonths(base, offset);
  return { from: toDay(startOfMonth(m)), to: toDay(endOfMonth(m)) };
}

export function lastNDays(n: number, base: Date = new Date()): DayRange {
  return { from: toDay(addDays(base, -(n - 1))), to: toDay(base) };
}

export function inRange(day: string, r: DayRange): boolean {
  const d = day.slice(0, 10);
  return d >= r.from && d <= r.to;
}

/** Same-length range immediately before `r`. */
export function previousRange(r: DayRange): DayRange {
  const len = differenceInCalendarDays(parseDay(r.to), parseDay(r.from)) + 1;
  const to = addDays(parseDay(r.from), -1);
  return { from: toDay(addDays(to, -(len - 1))), to: toDay(to) };
}

export function daysLeftInMonth(base: Date = new Date()): number {
  return differenceInCalendarDays(endOfMonth(base), base) + 1;
}
