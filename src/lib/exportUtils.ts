import { AttendanceRecord, Employee, OfficeSettings, ShiftSchedule } from '../types';
import {
  calculateBreaksDuration,
  formatMinutesToDecimal,
  formatMinutesToHoursMinutes,
  formatTime12h,
} from './attendanceCalculations';

/**
 * Clean CSV cell to avoid delimiter injection and handle quotes/commas
 */
function escapeCsvCell(val: string | number | undefined | null): string {
  if (val === undefined || val === null) return '""';
  const str = String(val).replace(/"/g, '""');
  return `"${str}"`;
}

/**
 * Download a generated CSV file to user's device
 */
export function downloadCsvFile(content: string, filename: string): void {
  // UTF-8 BOM so Microsoft Excel on Windows renders UTF-8 correctly
  const blob = new Blob(['\uFEFF' + content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Generate CSV for Employee or Admin attendance records
 */
export function exportAttendanceToCsv({
  records,
  employees,
  shifts,
  settings,
  employeeFilter,
  startDate,
  endDate,
}: {
  records: AttendanceRecord[];
  employees: Employee[];
  shifts: ShiftSchedule[];
  settings: OfficeSettings;
  employeeFilter?: Employee;
  startDate?: string;
  endDate?: string;
}): void {
  const empMap = new Map(employees.map((e) => [e.id, e]));
  const shiftMap = new Map(shifts.map((s) => [s.id, s]));

  // Filter records
  let filtered = [...records];
  if (employeeFilter) {
    filtered = filtered.filter((r) => r.employeeId === employeeFilter.id);
  }
  if (startDate) {
    filtered = filtered.filter((r) => r.date >= startDate);
  }
  if (endDate) {
    filtered = filtered.filter((r) => r.date <= endDate);
  }

  // Sort by date descending, then employee code
  filtered.sort((a, b) => {
    if (a.date !== b.date) return b.date.localeCompare(a.date);
    const empA = empMap.get(a.employeeId)?.employeeCode || '';
    const empB = empMap.get(b.employeeId)?.employeeCode || '';
    return empA.localeCompare(empB);
  });

  const headers = [
    'Date',
    'Day',
    'Employee Code',
    'Employee Name',
    'Department',
    'Designation',
    'Shift Name',
    'Time In',
    'Time Out',
    'Break Duration (mins)',
    'Total Worked (hh:mm)',
    'Total Worked (Hours)',
    'Regular Hours',
    'Overtime Hours',
    'Status',
    'Admin Verification',
    'Accounts Verification',
    'Auto Closed (11:59 PM)',
    'Notes / Remarks',
  ];

  const rows = filtered.map((rec) => {
    const emp = empMap.get(rec.employeeId);
    const shift = emp ? shiftMap.get(emp.shiftId) : undefined;
    const breakMins = calculateBreaksDuration(rec.breaks);

    const adminVer = rec.adminVerification?.verified
      ? `Verified (${rec.adminVerification.verifiedByName || 'Admin'})`
      : 'Unverified';
    const accountsVer = rec.accountsVerification?.verified
      ? `Verified (${rec.accountsVerification.verifiedByName || 'Accounts'})`
      : 'Unverified';
    const autoOut = rec.isAutoPunchedOut ? 'Yes' : 'No';

    return [
      escapeCsvCell(rec.date),
      escapeCsvCell(rec.day),
      escapeCsvCell(emp?.employeeCode || 'N/A'),
      escapeCsvCell(emp?.name || 'Unknown'),
      escapeCsvCell(emp?.department || 'General'),
      escapeCsvCell(emp?.designation || ''),
      escapeCsvCell(shift?.name || 'Standard'),
      escapeCsvCell(formatTime12h(rec.timeIn)),
      escapeCsvCell(rec.timeOut ? formatTime12h(rec.timeOut) : 'Active / Pending'),
      escapeCsvCell(breakMins),
      escapeCsvCell(formatMinutesToHoursMinutes(rec.totalWorkedMinutes)),
      escapeCsvCell(formatMinutesToDecimal(rec.totalWorkedMinutes)),
      escapeCsvCell(formatMinutesToDecimal(rec.regularMinutes)),
      escapeCsvCell(formatMinutesToDecimal(rec.overtimeMinutes)),
      escapeCsvCell(rec.status.toUpperCase()),
      escapeCsvCell(adminVer),
      escapeCsvCell(accountsVer),
      escapeCsvCell(autoOut),
      escapeCsvCell(rec.notes || (rec.isManuallyAdjusted ? `Adjusted: ${rec.adjustmentNote}` : '')),
    ].join(',');
  });

  const titleRow = escapeCsvCell(`${settings.companyName} - Attendance Report`);
  const generatedRow = escapeCsvCell(`Generated on: ${new Date().toLocaleString()}`);
  const scopeRow = escapeCsvCell(
    employeeFilter
      ? `Employee: ${employeeFilter.name} (${employeeFilter.employeeCode})`
      : 'Scope: All Office Employees'
  );

  const csvContent = [
    titleRow,
    generatedRow,
    scopeRow,
    '',
    headers.join(','),
    ...rows,
  ].join('\r\n');

  const filePrefix = employeeFilter
    ? `attendance_${employeeFilter.employeeCode}_${employeeFilter.name.toLowerCase().replace(/\s+/g, '_')}`
    : 'office_attendance_report';
  const timestamp = new Date().toISOString().split('T')[0];

  downloadCsvFile(csvContent, `${filePrefix}_${timestamp}.csv`);
}
