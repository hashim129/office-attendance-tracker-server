export type Role = 'admin' | 'employee' | 'accounts';

export type AttendanceStatus = 'present' | 'late' | 'half_day' | 'on_leave' | 'absent';

export type BreakType = 'lunch' | 'coffee' | 'short_break';

export interface BreakRecord {
  id: string;
  start: string; // HH:mm:ss or ISO
  end?: string;   // HH:mm:ss or ISO
  type: BreakType;
  durationMinutes?: number;
}

export interface VerificationInfo {
  verified: boolean;
  verifiedAt?: string;
  verifiedByName?: string;
  verifiedById?: string;
  note?: string;
}

export interface AttendanceRecord {
  id: string;
  employeeId: string;
  date: string; // YYYY-MM-DD
  day: string;  // Monday, Tuesday, etc.
  timeIn: string; // HH:mm:ss
  timeOut?: string; // HH:mm:ss
  breaks: BreakRecord[];
  totalWorkedMinutes: number;
  regularMinutes: number;
  overtimeMinutes: number;
  status: AttendanceStatus;
  notes?: string;
  isManuallyAdjusted?: boolean;
  adjustmentNote?: string;
  adjustedBy?: string;
  clientIp?: string;
  deviceId?: string;
  deviceName?: string;
  isAutoPunchedOut?: boolean;
  adminVerification?: VerificationInfo;
  accountsVerification?: VerificationInfo;
}

export interface ShiftSchedule {
  id: string;
  name: string;
  startTime: string; // "09:00"
  endTime: string;   // "17:00"
  workDays: number[]; // 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat, 0=Sun
  graceMinutes: number; // e.g. 15 mins
  expectedHours: number; // e.g. 8
  color: string;
  isActive?: boolean; // When false, shift cannot be assigned or selected
}

export interface Employee {
  id: string;
  employeeCode: string;
  name: string;
  email: string;
  role: Role;
  pin: string; // 4-digit PIN for Kiosk / quick access
  department: string;
  designation: string;
  shiftId: string;
  phone: string;
  hourlyRate: number;
  isActive: boolean;
  joinedDate: string;
  avatarSeed?: string;
  registeredDeviceId?: string; // Persistent device UUID bound to this employee
  registeredDeviceName?: string; // e.g. "Ahmed's Samsung Galaxy A54 (Android)"
  registeredAt?: string;
}

export type LeaveType = 'annual' | 'sick' | 'casual' | 'unpaid' | 'remote_work';

export type LeaveStatus = 'pending' | 'approved' | 'rejected';

export interface LeaveRequest {
  id: string;
  employeeId: string;
  leaveType: LeaveType;
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  totalDays: number;
  reason: string;
  status: LeaveStatus;
  appliedAt: string; // ISO
  reviewedBy?: string;
  reviewNote?: string;
}

export interface OfficeSettings {
  companyName: string;
  companyAddress: string;
  companyPhone: string;
  companyEmail: string;
  workDays: number[];
  defaultShiftId: string;
  overtimeThresholdMinutes: number; // default 480 mins (8h)
  overtimeRateMultiplier: number; // 1.5x
  kioskPinRequired: boolean;
  allowSelfClockOut: boolean;
  serverHostName: string;
  serverPort: number;
  enforceOfficeIpLock?: boolean;
  allowedOfficeIps?: { ip: string; label: string; addedAt: string }[];
  allowedOfficeIsps?: { ispName: string; label: string; addedAt: string }[];
  allowAdminBypassIpLock?: boolean;
  enforceDeviceBinding?: boolean; // Anti-proxy punching: 1 device per employee
  allowAdminBypassDeviceBinding?: boolean;
  allowKioskPunchWithoutDevice?: boolean;
}

export type AppMode = 'desktop' | 'kiosk';

export type ActiveDesktopTab =
  | 'clock'
  | 'my-attendance'
  | 'team-attendance'
  | 'employees'
  | 'shifts'
  | 'leaves'
  | 'reports'
  | 'settings';
