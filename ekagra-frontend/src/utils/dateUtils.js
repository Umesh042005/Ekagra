import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(relativeTime);

// Single source of truth for the application timezone
export const APP_TIMEZONE = 'Asia/Kolkata';

/**
 * Returns a dayjs object converted to the app's timezone (IST).
 * Accepts ISO string, Date object, or timestamp.
 */
export function toAppTime(val) {
  if (!val) return null;
  return dayjs.utc(val).tz(APP_TIMEZONE);
}

/**
 * Format date for display, e.g. "28 Sep 2026"
 */
export function formatDate(isoString, formatStr = 'D MMM YYYY') {
  if (!isoString) return '';
  const d = toAppTime(isoString);
  return d ? d.format(formatStr) : '';
}

/**
 * Format full weekday name, e.g. "Monday"
 */
export function formatWeekday(isoString) {
  if (!isoString) return '';
  const d = toAppTime(isoString);
  return d ? d.format('dddd') : '';
}

/**
 * Format time for display, e.g. "8:00 AM"
 */
export function formatTime(isoString, formatStr = 'h:mm A') {
  if (!isoString) return '';
  const d = toAppTime(isoString);
  return d ? d.format(formatStr) : '';
}

/**
 * Returns date and day strings for session cards
 * { dateStr: "28 Sep 2026", dayStr: "Monday" }
 */
export function formatDateDetails(isoString) {
  if (!isoString) return { dateStr: '', dayStr: '' };
  const d = toAppTime(isoString);
  if (!d) return { dateStr: '', dayStr: '' };
  return {
    dateStr: d.format('D MMM YYYY'),
    dayStr: d.format('dddd'),
  };
}

/**
 * Returns formatted start/end time and duration string
 * { timeStr: "8:00 AM – 8:45 AM", durationStr: "45 mins" }
 */
export function formatTimeDetails(isoString, durationMin = 45) {
  if (!isoString) return { timeStr: '', durationStr: `${durationMin} mins` };
  const d = toAppTime(isoString);
  if (!d) return { timeStr: '', durationStr: `${durationMin} mins` };
  const endD = d.add(durationMin, 'minute');
  return {
    timeStr: `${d.format('h:mm A')} – ${endD.format('h:mm A')}`,
    durationStr: `${durationMin} mins`,
  };
}

/**
 * Smart relative or friendly timestamp for notifications
 */
export function formatNotificationTime(isoString) {
  if (!isoString) return '';
  const d = toAppTime(isoString);
  if (!d) return '';

  const now = dayjs().tz(APP_TIMEZONE);
  const diffMinutes = now.diff(d, 'minute');

  if (diffMinutes < 1) return 'Just now';
  if (diffMinutes < 60) return `${diffMinutes}m ago`;

  const isToday = d.format('YYYY-MM-DD') === now.format('YYYY-MM-DD');
  if (isToday) return `Today, ${d.format('h:mm A')}`;

  const isYesterday = d.format('YYYY-MM-DD') === now.subtract(1, 'day').format('YYYY-MM-DD');
  if (isYesterday) return `Yesterday, ${d.format('h:mm A')}`;

  return d.format('D MMM, h:mm A');
}

/**
 * Returns current hour in IST (0-23) for morning/afternoon/evening greetings
 */
export function getGreetingHour() {
  return dayjs().tz(APP_TIMEZONE).hour();
}

/**
 * Converts a datetime-local input string (representing IST) to UTC ISO string
 * e.g. "2026-09-28T08:00" -> "2026-09-28T02:30:00.000Z"
 */
export function toUtcIsoFromLocal(localDateTimeString) {
  if (!localDateTimeString) return '';
  // Parse as IST then convert to UTC ISO
  return dayjs.tz(localDateTimeString, APP_TIMEZONE).utc().toISOString();
}

/**
 * Converts a UTC ISO timestamp to local "YYYY-MM-DDTHH:mm" for <input type="datetime-local" />
 */
export function toLocalDatetimeInput(isoString) {
  if (!isoString) return '';
  const d = toAppTime(isoString);
  return d ? d.format('YYYY-MM-DDTHH:mm') : '';
}

/**
 * Returns "YYYY-MM-DD" key in IST for a session's scheduled_at
 */
export function getSessionDateKey(scheduledAtIso) {
  if (!scheduledAtIso) return '';
  const d = toAppTime(scheduledAtIso);
  return d ? d.format('YYYY-MM-DD') : '';
}

/**
 * Get current date parts in IST
 */
export function getTodayInAppTime() {
  const now = dayjs().tz(APP_TIMEZONE);
  return {
    year: now.year(),
    month: now.month() + 1, // 1-indexed (1-12)
    day: now.date(),
  };
}

/**
 * Given year, month (1-12), day, and HH:mm in IST, returns:
 * - startMs, endMs (epoch timestamps)
 * - isPast (boolean, minimum 30 min buffer)
 * - localIso (for prefilling datetime-local input)
 */
export function getSlotBounds(year, month, day, timeStr, durationMin = 45) {
  const pad = (n) => String(n).padStart(2, '0');
  const dateStr = `${year}-${pad(month)}-${pad(day)} ${timeStr}`;
  const slotStart = dayjs.tz(dateStr, APP_TIMEZONE);
  const slotEnd = slotStart.add(durationMin, 'minute');

  const now = dayjs().tz(APP_TIMEZONE);
  const isPast = slotStart.valueOf() < now.valueOf() + 29 * 60 * 1000;

  return {
    startMs: slotStart.valueOf(),
    endMs: slotEnd.valueOf(),
    isPast,
    localIso: `${year}-${pad(month)}-${pad(day)}T${timeStr}`,
  };
}

/**
 * Interval overlap check between slot window [slotStartMs, slotEndMs)
 * and a booked session
 */
export function checkSlotOverlap(slotStartMs, slotEndMs, session) {
  if (!session || !session.scheduled_at) return false;
  const bStart = dayjs.utc(session.scheduled_at).valueOf();
  const bDuration = (session.duration_minutes || 45) * 60 * 1000;
  const bEnd = bStart + bDuration;

  return slotStartMs < bEnd && bStart < slotEndMs;
}

export default dayjs;
