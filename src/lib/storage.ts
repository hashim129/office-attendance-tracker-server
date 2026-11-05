import {
  AttendanceRecord,
  Employee,
  LeaveRequest,
  OfficeSettings,
  ShiftSchedule,
} from '../types';
import {
  calculateWorkedMinutes,
  getDayName,
  getTodayDateString,
  isLateArrival,
} from './attendanceCalculations';

const STORAGE_KEY_EMPLOYEES = 'office_attend_employees_v1';
const STORAGE_KEY_ATTENDANCE = 'office_attend_records_v1';
const STORAGE_KEY_SHIFTS = 'office_attend_shifts_v1';
const STORAGE_KEY_LEAVES = 'office_attend_leaves_v1';
const STORAGE_KEY_SETTINGS = 'office_attend_settings_v1';
const STORAGE_KEY_SESSION = 'office_attend_session_v1';
const STORAGE_KEY_MODE = 'office_attend_mode_v1';

export const INITIAL_SHIFTS: ShiftSchedule[] = [
  {
    id: 'shift-std',
    name: 'General Day Shift (09:00 - 17:00)',
    startTime: '09:00',
    endTime: '17:00',
    workDays: [1, 2, 3, 4, 5],
    graceMinutes: 15,
    expectedHours: 8,
    color: 'blue',
  },
  {
    id: 'shift-early',
    name: 'Early Bird Shift (08:00 - 16:00)',
    startTime: '08:00',
    endTime: '16:00',
    workDays: [1, 2, 3, 4, 5],
    graceMinutes: 10,
    expectedHours: 8,
    color: 'amber',
  },
  {
    id: 'shift-flex',
    name: 'Flexible Shift (10:00 - 18:00)',
    startTime: '10:00',
    endTime: '18:00',
    workDays: [1, 2, 3, 4, 5],
    graceMinutes: 20,
    expectedHours: 8,
    color: 'emerald',
  },
];

export const INITIAL_SETTINGS: OfficeSettings = {
  companyName: 'Apex Technologies Ltd.',
  companyAddress: 'Suite 400, Innovation Tower, Financial District',
  companyPhone: '+1 (555) 019-8321',
  companyEmail: 'hr@apextech.local',
  workDays: [1, 2, 3, 4, 5],
  defaultShiftId: 'shift-std',
  overtimeThresholdMinutes: 480, // 8 hours
  overtimeRateMultiplier: 1.5,
  kioskPinRequired: true,
  allowSelfClockOut: true,
  serverHostName: 'APEX-SRV-WIN11',
  serverPort: 3000,
  enforceOfficeIpLock: true,
  allowedOfficeIps: [
    {
      ip: '175.107.239.140',
      label: 'Office ISP Provider 1 (Cyber Internet Services) — All Extenders & LAN',
      addedAt: '2026-11-05',
    },
    {
      ip: '175.107.239.*',
      label: 'Office ISP Provider 1 Dynamic Subnet — All Extenders & LAN',
      addedAt: '2026-11-05',
    },
    {
      ip: '127.0.0.1',
      label: 'Local Server Host PC',
      addedAt: '2026-11-05',
    },
  ],
  allowedOfficeIsps: [
    {
      ispName: 'Cyber Internet Services',
      label: 'Office Primary ISP',
      addedAt: '2026-11-05',
    },
  ],
  allowAdminBypassIpLock: true,
};

export const INITIAL_EMPLOYEES: Employee[] = [
  {
    id: 'emp-101',
    employeeCode: 'EMP-101',
    name: 'Sarah Jenkins',
    email: 'admin@office.local',
    role: 'admin',
    pin: '1234',
    department: 'Human Resources',
    designation: 'HR Operations Lead & Admin',
    shiftId: 'shift-std',
    phone: '+1 (555) 234-5678',
    hourlyRate: 48.0,
    isActive: true,
    joinedDate: '2023-01-15',
    avatarSeed: 'sarah',
  },
  {
    id: 'emp-102',
    employeeCode: 'EMP-102',
    name: 'David Miller',
    email: 'david@office.local',
    role: 'admin',
    pin: '5555',
    department: 'Management',
    designation: 'Operations Director',
    shiftId: 'shift-std',
    phone: '+1 (555) 345-6789',
    hourlyRate: 55.0,
    isActive: true,
    joinedDate: '2022-06-01',
    avatarSeed: 'david',
  },
  {
    id: 'emp-103',
    employeeCode: 'EMP-103',
    name: 'Michael Chang',
    email: 'michael@office.local',
    role: 'employee',
    pin: '1001',
    department: 'Engineering',
    designation: 'Senior Software Engineer',
    shiftId: 'shift-std',
    phone: '+1 (555) 456-7890',
    hourlyRate: 42.5,
    isActive: true,
    joinedDate: '2023-03-20',
    avatarSeed: 'michael',
  },
  {
    id: 'emp-104',
    employeeCode: 'EMP-104',
    name: 'Emily Watson',
    email: 'emily@office.local',
    role: 'employee',
    pin: '1002',
    department: 'Product & Design',
    designation: 'Lead UI/UX Designer',
    shiftId: 'shift-std',
    phone: '+1 (555) 567-8901',
    hourlyRate: 40.0,
    isActive: true,
    joinedDate: '2023-05-10',
    avatarSeed: 'emily',
  },
  {
    id: 'emp-105',
    employeeCode: 'EMP-105',
    name: 'Robert Taylor',
    email: 'robert@office.local',
    role: 'employee',
    pin: '1003',
    department: 'Engineering',
    designation: 'Systems Infrastructure Engineer',
    shiftId: 'shift-early',
    phone: '+1 (555) 678-9012',
    hourlyRate: 44.0,
    isActive: true,
    joinedDate: '2023-08-01',
    avatarSeed: 'robert',
  },
  {
    id: 'emp-106',
    employeeCode: 'EMP-106',
    name: 'Priya Patel',
    email: 'priya@office.local',
    role: 'employee',
    pin: '1004',
    department: 'Quality Assurance',
    designation: 'QA Automation Lead',
    shiftId: 'shift-std',
    phone: '+1 (555) 789-0123',
    hourlyRate: 38.0,
    isActive: true,
    joinedDate: '2023-11-15',
    avatarSeed: 'priya',
  },
  {
    id: 'emp-107',
    employeeCode: 'EMP-107',
    name: 'Lucas Vance',
    email: 'lucas@office.local',
    role: 'employee',
    pin: '1005',
    department: 'Finance',
    designation: 'Corporate Financial Analyst',
    shiftId: 'shift-std',
    phone: '+1 (555) 890-1234',
    hourlyRate: 39.5,
    isActive: true,
    joinedDate: '2024-02-01',
    avatarSeed: 'lucas',
  },
  {
    id: 'emp-108',
    employeeCode: 'EMP-108',
    name: 'Jessica Brooks',
    email: 'jessica@office.local',
    role: 'employee',
    pin: '1006',
    department: 'Marketing',
    designation: 'Growth & Content Specialist',
    shiftId: 'shift-flex',
    phone: '+1 (555) 901-2345',
    hourlyRate: 36.0,
    isActive: true,
    joinedDate: '2024-04-12',
    avatarSeed: 'jessica',
  },
];

export const INITIAL_LEAVES: LeaveRequest[] = [
  {
    id: 'leave-1',
    employeeId: 'emp-103', // Michael
    leaveType: 'sick',
    startDate: '2026-10-20',
    endDate: '2026-10-21',
    totalDays: 2,
    reason: 'Severe seasonal flu with fever; medical rest recommended.',
    status: 'approved',
    appliedAt: '2026-10-19T18:30:00.000Z',
    reviewedBy: 'emp-101',
    reviewNote: 'Approved. Get well soon Michael.',
  },
  {
    id: 'leave-2',
    employeeId: 'emp-104', // Emily
    leaveType: 'annual',
    startDate: '2026-11-16',
    endDate: '2026-11-20',
    totalDays: 5,
    reason: 'Family vacation scheduled in advance; project handoff complete.',
    status: 'pending',
    appliedAt: '2026-11-01T10:15:00.000Z',
  },
  {
    id: 'leave-3',
    employeeId: 'emp-107', // Lucas
    leaveType: 'casual',
    startDate: '2026-11-10',
    endDate: '2026-11-10',
    totalDays: 1,
    reason: 'Personal administrative errand at municipal office.',
    status: 'pending',
    appliedAt: '2026-11-02T08:00:00.000Z',
  },
];

/**
 * Generate historical sample attendance data for past 10 working days plus today
 */
export function generateInitialAttendanceRecords(): AttendanceRecord[] {
  const records: AttendanceRecord[] = [];
  const today = new Date();

  // Create historical records for each employee across past 10 days
  for (let i = 10; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const dayOfWeek = d.getDay();

    // Skip Sundays (0) and Saturdays (6)
    if (dayOfWeek === 0 || dayOfWeek === 6) continue;

    const dateStr = d.toISOString().split('T')[0];
    const dayName = getDayName(d);

    INITIAL_EMPLOYEES.forEach((emp, empIdx) => {
      // Find shift
      const shift = INITIAL_SHIFTS.find((s) => s.id === emp.shiftId) || INITIAL_SHIFTS[0];

      if (i === 0) {
        // Today's attendance - simulate dynamic active states!
        // emp 101 (Sarah): Clocked In at 08:50 AM, no checkout yet
        // emp 103 (Michael): Clocked In at 09:05 AM, currently on lunch break
        // emp 104 (Emily): Clocked In at 09:22 AM (Late), no checkout yet
        // emp 105 (Robert): Clocked In at 07:55 AM, Clocked Out at 16:15 PM (completed shift)
        // emp 106 (Priya): Clocked In at 08:58 AM
        // emp 107 (Lucas): Absent/Not yet clocked in
        // emp 108 (Jessica): Clocked In at 09:55 AM (Flex)

        if (emp.id === 'emp-101') {
          records.push({
            id: `att-${dateStr}-${emp.id}`,
            employeeId: emp.id,
            date: dateStr,
            day: dayName,
            timeIn: '08:50:12',
            breaks: [],
            totalWorkedMinutes: 0,
            regularMinutes: 0,
            overtimeMinutes: 0,
            status: 'present',
            notes: 'On duty',
          });
        } else if (emp.id === 'emp-103') {
          records.push({
            id: `att-${dateStr}-${emp.id}`,
            employeeId: emp.id,
            date: dateStr,
            day: dayName,
            timeIn: '09:05:44',
            breaks: [{ id: 'b-today-1', start: '12:30:00', type: 'lunch' }],
            totalWorkedMinutes: 0,
            regularMinutes: 0,
            overtimeMinutes: 0,
            status: 'present',
            notes: 'Lunch break active',
          });
        } else if (emp.id === 'emp-104') {
          records.push({
            id: `att-${dateStr}-${emp.id}`,
            employeeId: emp.id,
            date: dateStr,
            day: dayName,
            timeIn: '09:24:18', // after 09:15 grace
            breaks: [],
            totalWorkedMinutes: 0,
            regularMinutes: 0,
            overtimeMinutes: 0,
            status: 'late',
            notes: 'Traffic delay on freeway',
          });
        } else if (emp.id === 'emp-105') {
          const worked = calculateWorkedMinutes('07:55:00', '16:15:00', [
            { id: 'b1', start: '12:00:00', end: '12:45:00', type: 'lunch' },
          ]);
          records.push({
            id: `att-${dateStr}-${emp.id}`,
            employeeId: emp.id,
            date: dateStr,
            day: dayName,
            timeIn: '07:55:00',
            timeOut: '16:15:00',
            breaks: [{ id: 'b1', start: '12:00:00', end: '12:45:00', type: 'lunch' }],
            totalWorkedMinutes: worked.totalWorkedMinutes,
            regularMinutes: worked.regularMinutes,
            overtimeMinutes: worked.overtimeMinutes,
            status: 'present',
          });
        } else if (emp.id === 'emp-106') {
          records.push({
            id: `att-${dateStr}-${emp.id}`,
            employeeId: emp.id,
            date: dateStr,
            day: dayName,
            timeIn: '08:58:30',
            breaks: [],
            totalWorkedMinutes: 0,
            regularMinutes: 0,
            overtimeMinutes: 0,
            status: 'present',
          });
        } else if (emp.id === 'emp-108') {
          records.push({
            id: `att-${dateStr}-${emp.id}`,
            employeeId: emp.id,
            date: dateStr,
            day: dayName,
            timeIn: '09:55:10',
            breaks: [],
            totalWorkedMinutes: 0,
            regularMinutes: 0,
            overtimeMinutes: 0,
            status: 'present',
          });
        }
        return;
      }

      // Past days
      // Randomize realistic arrival variation around shift time
      const isLate = (i + empIdx) % 7 === 0;
      let timeInHour = parseInt(shift.startTime.split(':')[0], 10);
      let timeInMin = isLate ? 25 : Math.floor((empIdx * 3 + i * 2) % 12);
      if (timeInMin < 0) timeInMin = 0;

      const timeInStr = `${timeInHour.toString().padStart(2, '0')}:${timeInMin.toString().padStart(2, '0')}:00`;

      // Departure around shift end (some with overtime)
      let timeOutHour = parseInt(shift.endTime.split(':')[0], 10);
      const hasOvertime = (i * 2 + empIdx) % 4 === 0;
      let timeOutMin = hasOvertime ? 45 : Math.floor((empIdx * 4) % 15);
      if (hasOvertime) timeOutHour += 1;

      const timeOutStr = `${timeOutHour.toString().padStart(2, '0')}:${timeOutMin.toString().padStart(2, '0')}:00`;

      const breaks = [
        {
          id: `b-${dateStr}-${emp.id}`,
          start: '12:30:00',
          end: '13:15:00',
          type: 'lunch' as const,
        },
      ];

      const worked = calculateWorkedMinutes(timeInStr, timeOutStr, breaks, shift.expectedHours);
      const late = isLateArrival(timeInStr, shift);

      records.push({
        id: `att-${dateStr}-${emp.id}`,
        employeeId: emp.id,
        date: dateStr,
        day: dayName,
        timeIn: timeInStr,
        timeOut: timeOutStr,
        breaks,
        totalWorkedMinutes: worked.totalWorkedMinutes,
        regularMinutes: worked.regularMinutes,
        overtimeMinutes: worked.overtimeMinutes,
        status: late ? 'late' : 'present',
        notes: hasOvertime ? 'Project sprint deployment' : undefined,
      });
    });
  }

  return records;
}

// Server Sync Helper (for standalone .exe and Express server)
let isSyncingFromServer = false;

const STORAGE_KEY_UPDATED_AT = 'office_attend_updated_at_v1';

export async function pushDatabaseToServer(): Promise<void> {
  if (isSyncingFromServer) return;
  try {
    const nowIso = new Date().toISOString();
    localStorage.setItem(STORAGE_KEY_UPDATED_AT, nowIso);
    const payload = {
      version: '1.0',
      updatedAt: nowIso,
      settings: JSON.parse(localStorage.getItem(STORAGE_KEY_SETTINGS) || 'null') || INITIAL_SETTINGS,
      shifts: JSON.parse(localStorage.getItem(STORAGE_KEY_SHIFTS) || 'null') || INITIAL_SHIFTS,
      employees: JSON.parse(localStorage.getItem(STORAGE_KEY_EMPLOYEES) || 'null') || INITIAL_EMPLOYEES,
      attendance: JSON.parse(localStorage.getItem(STORAGE_KEY_ATTENDANCE) || 'null') || generateInitialAttendanceRecords(),
      leaves: JSON.parse(localStorage.getItem(STORAGE_KEY_LEAVES) || 'null') || INITIAL_LEAVES,
    };
    await fetch(`/api/db?t=${Date.now()}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch {
    // Graceful fallback if running without backend API
  }
}

export async function syncDatabaseFromServer(forceAccept = false): Promise<boolean> {
  try {
    const res = await fetch(`/api/db?t=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) return false;
    const data = await res.json();
    if (data && Array.isArray(data.employees) && Array.isArray(data.attendance)) {
      const localUpdatedAt = localStorage.getItem(STORAGE_KEY_UPDATED_AT);
      // Always accept server data if forceAccept is true, or if local has no timestamp yet,
      // or if server updatedAt is newer/different
      if (
        !forceAccept &&
        localUpdatedAt &&
        data.updatedAt &&
        new Date(data.updatedAt).getTime() < new Date(localUpdatedAt).getTime()
      ) {
        return false;
      }

      isSyncingFromServer = true;
      if (data.updatedAt) {
        localStorage.setItem(STORAGE_KEY_UPDATED_AT, data.updatedAt);
      }
      if (data.settings) localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(data.settings));
      if (data.shifts) localStorage.setItem(STORAGE_KEY_SHIFTS, JSON.stringify(data.shifts));
      if (data.employees) localStorage.setItem(STORAGE_KEY_EMPLOYEES, JSON.stringify(data.employees));
      if (data.attendance) localStorage.setItem(STORAGE_KEY_ATTENDANCE, JSON.stringify(data.attendance));
      if (data.leaves) localStorage.setItem(STORAGE_KEY_LEAVES, JSON.stringify(data.leaves));
      isSyncingFromServer = false;
      return true;
    } else if (data && data.empty) {
      // Server has no database file yet; seed it with current local data
      await pushDatabaseToServer();
    }
    return false;
  } catch {
    isSyncingFromServer = false;
    return false;
  }
}

// Local Storage Wrappers — NOTE: load* functions NEVER call pushDatabaseToServer()
// so a newly opened employee laptop never overwrites the server DB with dummy data!
export function loadEmployees(): Employee[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_EMPLOYEES);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY_EMPLOYEES, JSON.stringify(INITIAL_EMPLOYEES));
      return INITIAL_EMPLOYEES;
    }
    return JSON.parse(raw);
  } catch {
    return INITIAL_EMPLOYEES;
  }
}

export function saveEmployees(employees: Employee[]): void {
  try {
    localStorage.setItem(STORAGE_KEY_EMPLOYEES, JSON.stringify(employees));
    void pushDatabaseToServer();
  } catch (err) {
    console.error('Failed to save employees:', err);
  }
}

export function loadAttendanceRecords(): AttendanceRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_ATTENDANCE);
    if (!raw) {
      const initial = generateInitialAttendanceRecords();
      localStorage.setItem(STORAGE_KEY_ATTENDANCE, JSON.stringify(initial));
      return initial;
    }
    return JSON.parse(raw);
  } catch {
    return generateInitialAttendanceRecords();
  }
}

export function saveAttendanceRecords(records: AttendanceRecord[]): void {
  try {
    localStorage.setItem(STORAGE_KEY_ATTENDANCE, JSON.stringify(records));
    void pushDatabaseToServer();
  } catch (err) {
    console.error('Failed to save attendance records:', err);
  }
}

export function loadShifts(): ShiftSchedule[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_SHIFTS);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY_SHIFTS, JSON.stringify(INITIAL_SHIFTS));
      return INITIAL_SHIFTS;
    }
    return JSON.parse(raw);
  } catch {
    return INITIAL_SHIFTS;
  }
}

export function saveShifts(shifts: ShiftSchedule[]): void {
  try {
    localStorage.setItem(STORAGE_KEY_SHIFTS, JSON.stringify(shifts));
    void pushDatabaseToServer();
  } catch (err) {
    console.error('Failed to save shifts:', err);
  }
}

export function loadLeaves(): LeaveRequest[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_LEAVES);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY_LEAVES, JSON.stringify(INITIAL_LEAVES));
      return INITIAL_LEAVES;
    }
    return JSON.parse(raw);
  } catch {
    return INITIAL_LEAVES;
  }
}

export function saveLeaves(leaves: LeaveRequest[]): void {
  try {
    localStorage.setItem(STORAGE_KEY_LEAVES, JSON.stringify(leaves));
    void pushDatabaseToServer();
  } catch (err) {
    console.error('Failed to save leaves:', err);
  }
}

export function loadSettings(): OfficeSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_SETTINGS);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(INITIAL_SETTINGS));
      return INITIAL_SETTINGS;
    }
    const parsed: OfficeSettings = JSON.parse(raw);
    if (parsed.enforceOfficeIpLock === undefined) {
      const upgraded: OfficeSettings = {
        ...INITIAL_SETTINGS,
        ...parsed,
        enforceOfficeIpLock: INITIAL_SETTINGS.enforceOfficeIpLock,
        allowedOfficeIps:
          parsed.allowedOfficeIps && parsed.allowedOfficeIps.length > 0
            ? parsed.allowedOfficeIps
            : INITIAL_SETTINGS.allowedOfficeIps,
        allowedOfficeIsps:
          parsed.allowedOfficeIsps && parsed.allowedOfficeIsps.length > 0
            ? parsed.allowedOfficeIsps
            : INITIAL_SETTINGS.allowedOfficeIsps,
        allowAdminBypassIpLock: parsed.allowAdminBypassIpLock ?? true,
      };
      localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(upgraded));
      return upgraded;
    }
    return parsed;
  } catch {
    return INITIAL_SETTINGS;
  }
}

export function saveSettings(settings: OfficeSettings): void {
  try {
    localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(settings));
    void pushDatabaseToServer();
  } catch (err) {
    console.error('Failed to save settings:', err);
  }
}

// Session Management
export interface UserSession {
  userId: string;
  keepLoggedIn: boolean;
  loginTimestamp: number;
}

export function loadSession(): UserSession | null {
  try {
    // Check localStorage (for keepLoggedIn: true)
    const stored = localStorage.getItem(STORAGE_KEY_SESSION);
    if (stored) return JSON.parse(stored);

    // Check sessionStorage (for current window only)
    const sessionOnly = sessionStorage.getItem(STORAGE_KEY_SESSION);
    if (sessionOnly) return JSON.parse(sessionOnly);

    return null;
  } catch {
    return null;
  }
}

export function saveSession(userId: string, keepLoggedIn: boolean): void {
  const session: UserSession = {
    userId,
    keepLoggedIn,
    loginTimestamp: Date.now(),
  };

  if (keepLoggedIn) {
    localStorage.setItem(STORAGE_KEY_SESSION, JSON.stringify(session));
    sessionStorage.removeItem(STORAGE_KEY_SESSION);
  } else {
    sessionStorage.setItem(STORAGE_KEY_SESSION, JSON.stringify(session));
    localStorage.removeItem(STORAGE_KEY_SESSION);
  }
}

export function clearSession(): void {
  localStorage.removeItem(STORAGE_KEY_SESSION);
  sessionStorage.removeItem(STORAGE_KEY_SESSION);
}

// App Mode (Desktop vs Lobby Kiosk)
export function loadSavedMode(): 'desktop' | 'kiosk' {
  try {
    const mode = localStorage.getItem(STORAGE_KEY_MODE);
    return mode === 'kiosk' ? 'kiosk' : 'desktop';
  } catch {
    return 'desktop';
  }
}

export function saveMode(mode: 'desktop' | 'kiosk'): void {
  try {
    localStorage.setItem(STORAGE_KEY_MODE, mode);
  } catch {
    // ignore
  }
}

// Full Database Backup Export & Restore
export function exportDatabaseBackup(): string {
  const data = {
    version: '1.0',
    exportedAt: new Date().toISOString(),
    settings: loadSettings(),
    shifts: loadShifts(),
    employees: loadEmployees(),
    attendance: loadAttendanceRecords(),
    leaves: loadLeaves(),
  };
  return JSON.stringify(data, null, 2);
}

export function importDatabaseBackup(jsonString: string): boolean {
  try {
    const data = JSON.parse(jsonString);
    if (!data.employees || !data.attendance) {
      throw new Error('Invalid database backup structure');
    }
    if (data.settings) saveSettings(data.settings);
    if (data.shifts) saveShifts(data.shifts);
    if (data.employees) saveEmployees(data.employees);
    if (data.attendance) saveAttendanceRecords(data.attendance);
    if (data.leaves) saveLeaves(data.leaves);
    return true;
  } catch (err) {
    console.error('Failed to import database backup:', err);
    return false;
  }
}

export function resetToFactoryDefaults(): void {
  localStorage.removeItem(STORAGE_KEY_EMPLOYEES);
  localStorage.removeItem(STORAGE_KEY_ATTENDANCE);
  localStorage.removeItem(STORAGE_KEY_SHIFTS);
  localStorage.removeItem(STORAGE_KEY_LEAVES);
  localStorage.removeItem(STORAGE_KEY_SETTINGS);
  localStorage.removeItem(STORAGE_KEY_SESSION);
  sessionStorage.removeItem(STORAGE_KEY_SESSION);
}
