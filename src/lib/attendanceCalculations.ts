import { AttendanceRecord, ShiftSchedule } from '../types';

/**
 * Format total minutes into human readable "Xh Ym" or "0m"
 */
export function formatMinutesToHoursMinutes(totalMinutes: number): string {
  if (!totalMinutes || totalMinutes <= 0) return '0h 00m';
  const hours = Math.floor(totalMinutes / 60);
  const minutes = Math.round(totalMinutes % 60);
  return `${hours}h ${minutes.toString().padStart(2, '0')}m`;
}

/**
 * Format minutes into decimal hours e.g. 8.25
 */
export function formatMinutesToDecimal(totalMinutes: number): string {
  if (!totalMinutes || totalMinutes <= 0) return '0.00';
  return (totalMinutes / 60).toFixed(2);
}

/**
 * Parse "HH:mm" or "HH:mm:ss" string to minutes from midnight
 */
export function parseTimeToMinutes(timeStr: string): number {
  if (!timeStr) return 0;
  const parts = timeStr.split(':').map((p) => parseInt(p, 10));
  const hours = parts[0] || 0;
  const minutes = parts[1] || 0;
  return hours * 60 + minutes;
}

/**
 * Get current local date in YYYY-MM-DD format
 */
export function getTodayDateString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = (now.getMonth() + 1).toString().padStart(2, '0');
  const day = now.getDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Get weekday name from date string or Date
 */
export function getDayName(dateInput: string | Date): string {
  const date = typeof dateInput === 'string' ? new Date(dateInput + 'T00:00:00') : dateInput;
  return date.toLocaleDateString('en-US', { weekday: 'long' });
}

/**
 * Get current time string in HH:mm:ss format
 */
export function getCurrentTimeString(): string {
  const now = new Date();
  return now.toTimeString().split(' ')[0]; // "09:15:30"
}

/**
 * Calculate total break duration in minutes
 */
export function calculateBreaksDuration(breaks: AttendanceRecord['breaks']): number {
  if (!breaks || breaks.length === 0) return 0;
  return breaks.reduce((total, b) => {
    if (!b.end) return total;
    const startMins = parseTimeToMinutes(b.start);
    const endMins = parseTimeToMinutes(b.end);
    const diff = endMins >= startMins ? endMins - startMins : 24 * 60 - startMins + endMins;
    return total + Math.max(0, diff);
  }, 0);
}

/**
 * Calculate net worked minutes, regular minutes, and overtime minutes
 */
export function calculateWorkedMinutes(
  timeIn: string,
  timeOut: string | undefined,
  breaks: AttendanceRecord['breaks'],
  expectedShiftHours: number = 8
): { totalWorkedMinutes: number; regularMinutes: number; overtimeMinutes: number } {
  if (!timeIn || !timeOut) {
    return { totalWorkedMinutes: 0, regularMinutes: 0, overtimeMinutes: 0 };
  }

  const inMins = parseTimeToMinutes(timeIn);
  const outMins = parseTimeToMinutes(timeOut);
  const rawDiff = outMins >= inMins ? outMins - inMins : 24 * 60 - inMins + outMins;
  const breakMins = calculateBreaksDuration(breaks);
  const netWorked = Math.max(0, rawDiff - breakMins);

  const regularThreshold = expectedShiftHours * 60;
  const regular = Math.min(netWorked, regularThreshold);
  const overtime = Math.max(0, netWorked - regularThreshold);

  return {
    totalWorkedMinutes: netWorked,
    regularMinutes: regular,
    overtimeMinutes: overtime,
  };
}

/**
 * Determine if arrival is late compared to shift schedule
 */
export function isLateArrival(timeIn: string, shift: ShiftSchedule): boolean {
  if (!timeIn || !shift) return false;
  const punchMins = parseTimeToMinutes(timeIn);
  const shiftStartMins = parseTimeToMinutes(shift.startTime);
  const graceLimit = shiftStartMins + (shift.graceMinutes || 0);
  return punchMins > graceLimit;
}

/**
 * Format time to 12-hour AM/PM string
 */
export function formatTime12h(timeStr?: string): string {
  if (!timeStr) return '--:--';
  const parts = timeStr.split(':');
  if (parts.length < 2) return timeStr;
  let hours = parseInt(parts[0], 10);
  const mins = parts[1];
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12; // 0 is 12
  return `${hours}:${mins} ${ampm}`;
}

/**
 * Web Audio synthetic chime for positive feedback on punch
 */
export function playPunchSound(type: 'in' | 'out' | 'break') {
  try {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(ctx.destination);

    if (type === 'in') {
      // Ascending pleasant chord
      osc.type = 'sine';
      osc.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
      osc.frequency.exponentialRampToValueAtTime(659.25, ctx.currentTime + 0.1); // E5
      osc.frequency.exponentialRampToValueAtTime(783.99, ctx.currentTime + 0.2); // G5
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.35);
    } else if (type === 'out') {
      // Descending completion tone
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(783.99, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(523.25, ctx.currentTime + 0.2);
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.35);
    } else {
      // Soft double chime for break
      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, ctx.currentTime);
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.2);
    }
  } catch {
    // Audio autoplay restrictions or headless env
  }
}
