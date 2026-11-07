import React, { useState, useMemo } from 'react';
import {
  Calendar,
  Clock,
  Edit3,
  Filter,
  Search,
  Users,
  CheckCircle2,
  Coffee,
  AlertTriangle,
  UserX,
  FileSpreadsheet,
  ShieldCheck,
  CheckCheck,
  Check,
} from 'lucide-react';
import {
  AttendanceRecord,
  Employee,
  OfficeSettings,
  ShiftSchedule,
} from '../../types';
import {
  calculateWorkedMinutes,
  formatMinutesToHoursMinutes,
  formatTime12h,
  getDayName,
  getTodayDateString,
  isLateArrival,
} from '../../lib/attendanceCalculations';
import { exportAttendanceToCsv } from '../../lib/exportUtils';
import { Modal } from '../common/Modal';

interface TeamAttendanceTabProps {
  employees: Employee[];
  records: AttendanceRecord[];
  shifts: ShiftSchedule[];
  settings: OfficeSettings;
  onUpdateRecord: (updated: AttendanceRecord) => void;
  adminUser: Employee;
  currentUser?: Employee;
}

export const TeamAttendanceTab: React.FC<TeamAttendanceTabProps> = ({
  employees,
  records,
  shifts,
  settings,
  onUpdateRecord,
  adminUser,
  currentUser,
}) => {
  const effectiveUser = currentUser || adminUser;
  const isAdmin = effectiveUser.role === 'admin';
  const isAccountsOfficer = effectiveUser.role === 'accounts';

  const [selectedDate, setSelectedDate] = useState<string>(getTodayDateString());
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [departmentFilter, setDepartmentFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Adjustment Modal State
  const [editingRecord, setEditingRecord] = useState<AttendanceRecord | null>(null);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [editTimeIn, setEditTimeIn] = useState<string>('');
  const [editTimeOut, setEditTimeOut] = useState<string>('');
  const [editAuditReason, setEditAuditReason] = useState<string>('');
  const [editStatus, setEditStatus] = useState<AttendanceRecord['status']>('present');

  const departments = useMemo(() => {
    return Array.from(new Set(employees.map((e) => e.department))).sort();
  }, [employees]);

  const empMap = useMemo(() => new Map(employees.map((e) => [e.id, e])), [employees]);
  const shiftMap = useMemo(() => new Map(shifts.map((s) => [s.id, s])), [shifts]);

  // Records for the selected date
  const dateRecords = useMemo(() => {
    return records.filter((r) => r.date === selectedDate);
  }, [records, selectedDate]);

  const dateRecordMap = useMemo(() => {
    return new Map(dateRecords.map((r) => [r.employeeId, r]));
  }, [dateRecords]);

  // Verification Handlers
  const handleToggleAdminVerify = (record: AttendanceRecord) => {
    const isCurrentlyVerified = !!record.adminVerification?.verified;
    const updated: AttendanceRecord = {
      ...record,
      adminVerification: {
        verified: !isCurrentlyVerified,
        verifiedAt: !isCurrentlyVerified ? new Date().toISOString() : undefined,
        verifiedByName: !isCurrentlyVerified ? effectiveUser.name : undefined,
        verifiedById: !isCurrentlyVerified ? effectiveUser.id : undefined,
      },
    };
    onUpdateRecord(updated);
  };

  const handleToggleAccountsVerify = (record: AttendanceRecord) => {
    const isCurrentlyVerified = !!record.accountsVerification?.verified;
    const updated: AttendanceRecord = {
      ...record,
      accountsVerification: {
        verified: !isCurrentlyVerified,
        verifiedAt: !isCurrentlyVerified ? new Date().toISOString() : undefined,
        verifiedByName: !isCurrentlyVerified ? effectiveUser.name : undefined,
        verifiedById: !isCurrentlyVerified ? effectiveUser.id : undefined,
      },
    };
    onUpdateRecord(updated);
  };

  const handleBatchVerifyToday = (roleType: 'admin' | 'accounts') => {
    const targetKey = roleType === 'admin' ? 'adminVerification' : 'accountsVerification';
    const roleLabel = roleType === 'admin' ? 'Admin' : 'Accounts Officer';
    let verifiedCount = 0;

    dateRecords.forEach((rec) => {
      if (rec.timeIn && (!rec[targetKey] || !rec[targetKey]?.verified)) {
        verifiedCount++;
        const updated: AttendanceRecord = {
          ...rec,
          [targetKey]: {
            verified: true,
            verifiedAt: new Date().toISOString(),
            verifiedByName: effectiveUser.name,
            verifiedById: effectiveUser.id,
          },
        };
        onUpdateRecord(updated);
      }
    });

    if (verifiedCount === 0) {
      alert(`All attendance records for ${selectedDate} are already verified by ${roleLabel}.`);
    }
  };

  // Combine active employees with their record on selectedDate
  const teamRoster = useMemo(() => {
    return employees
      .filter((emp) => emp.isActive)
      .map((emp) => {
        const record = dateRecordMap.get(emp.id);
        const shift = shiftMap.get(emp.shiftId) || shifts[0];
        const isClockedIn = !!record && !!record.timeIn && !record.timeOut;
        const activeBreak = record?.breaks?.find((b) => !b.end);
        const isOnBreak = !!activeBreak;
        const isCompleted = !!record && !!record.timeOut;
        const isAbsent = !record;

        let derivedStatus: 'in' | 'break' | 'out' | 'absent' = 'absent';
        if (isOnBreak) derivedStatus = 'break';
        else if (isClockedIn) derivedStatus = 'in';
        else if (isCompleted) derivedStatus = 'out';

        return {
          employee: emp,
          record,
          shift,
          derivedStatus,
          isClockedIn,
          isOnBreak,
          isCompleted,
          isAbsent,
        };
      })
      .filter((item) => {
        if (departmentFilter !== 'all' && item.employee.department !== departmentFilter) {
          return false;
        }
        if (statusFilter !== 'all') {
          if (statusFilter === 'in' && item.derivedStatus !== 'in') return false;
          if (statusFilter === 'break' && item.derivedStatus !== 'break') return false;
          if (statusFilter === 'out' && item.derivedStatus !== 'out') return false;
          if (statusFilter === 'absent' && item.derivedStatus !== 'absent') return false;
          if (statusFilter === 'late' && item.record?.status !== 'late') return false;
          if (statusFilter === 'admin_unverified') {
            if (!item.record || item.record.adminVerification?.verified) return false;
          }
          if (statusFilter === 'accounts_unverified') {
            if (!item.record || item.record.accountsVerification?.verified) return false;
          }
          if (statusFilter === 'auto_punched') {
            if (!item.record?.isAutoPunchedOut) return false;
          }
        }
        if (searchQuery) {
          const q = searchQuery.toLowerCase();
          const matchName = item.employee.name.toLowerCase().includes(q);
          const matchCode = item.employee.employeeCode.toLowerCase().includes(q);
          const matchDept = item.employee.department.toLowerCase().includes(q);
          if (!matchName && !matchCode && !matchDept) return false;
        }
        return true;
      });
  }, [employees, dateRecordMap, shiftMap, shifts, departmentFilter, statusFilter, searchQuery]);

  // Presence & Verification counts
  const liveCounts = useMemo(() => {
    let inCount = 0;
    let breakCount = 0;
    let completedCount = 0;
    let absentCount = 0;
    let lateCount = 0;
    let adminVerifiedCount = 0;
    let accountsVerifiedCount = 0;
    let autoPunchedCount = 0;

    employees.filter((e) => e.isActive).forEach((emp) => {
      const rec = dateRecordMap.get(emp.id);
      if (!rec) {
        absentCount++;
      } else {
        if (rec.status === 'late') lateCount++;
        if (rec.isAutoPunchedOut) autoPunchedCount++;
        if (rec.adminVerification?.verified) adminVerifiedCount++;
        if (rec.accountsVerification?.verified) accountsVerifiedCount++;
        if (rec.timeOut) {
          completedCount++;
        } else if (rec.breaks.some((b) => !b.end)) {
          breakCount++;
        } else {
          inCount++;
        }
      }
    });

    return {
      inCount,
      breakCount,
      completedCount,
      absentCount,
      lateCount,
      adminVerifiedCount,
      accountsVerifiedCount,
      autoPunchedCount,
    };
  }, [employees, dateRecordMap]);

  // Open adjustment modal
  const handleOpenAdjustment = (emp: Employee, existingRecord?: AttendanceRecord) => {
    setEditingEmployee(emp);
    if (existingRecord) {
      setEditingRecord(existingRecord);
      setEditTimeIn(existingRecord.timeIn || '09:00:00');
      setEditTimeOut(existingRecord.timeOut || '17:00:00');
      setEditStatus(existingRecord.status);
      setEditAuditReason(existingRecord.adjustmentNote || '');
    } else {
      // New record for today
      const newRec: AttendanceRecord = {
        id: `att-${selectedDate}-${emp.id}`,
        employeeId: emp.id,
        date: selectedDate,
        day: getDayName(selectedDate),
        timeIn: '09:00:00',
        timeOut: '17:00:00',
        breaks: [],
        totalWorkedMinutes: 480,
        regularMinutes: 480,
        overtimeMinutes: 0,
        status: 'present',
      };
      setEditingRecord(newRec);
      setEditTimeIn('09:00:00');
      setEditTimeOut('17:00:00');
      setEditStatus('present');
      setEditAuditReason('Manual retroactive attendance entry by administrator');
    }
  };

  const handleSaveAdjustment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRecord || !editingEmployee) return;

    if (!editAuditReason.trim()) {
      alert('Please provide an audit reason for modifying official attendance records.');
      return;
    }

    const shift = shiftMap.get(editingEmployee.shiftId) || shifts[0];
    const worked = calculateWorkedMinutes(
      editTimeIn,
      editTimeOut || undefined,
      editingRecord.breaks,
      shift.expectedHours
    );

    const updated: AttendanceRecord = {
      ...editingRecord,
      timeIn: editTimeIn,
      timeOut: editTimeOut || undefined,
      totalWorkedMinutes: worked.totalWorkedMinutes,
      regularMinutes: worked.regularMinutes,
      overtimeMinutes: worked.overtimeMinutes,
      status: editStatus,
      isManuallyAdjusted: true,
      adjustmentNote: editAuditReason.trim(),
      adjustedBy: `${adminUser.name} (${adminUser.employeeCode})`,
    };

    onUpdateRecord(updated);
    setEditingRecord(null);
    setEditingEmployee(null);
  };

  const handleExportToday = () => {
    exportAttendanceToCsv({
      records: dateRecords,
      employees,
      shifts,
      settings,
      startDate: selectedDate,
      endDate: selectedDate,
    });
  };

  return (
    <div className="space-y-6">
      {/* Top Banner: Date Selector & Live Counts */}
      <div className="bg-white dark:bg-slate-900 rounded-xl p-5 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col md:flex-row items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-blue-600 dark:text-blue-400">
            <Users className="w-3.5 h-3.5" />
            <span>Team Attendance & Roster</span>
          </div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 mt-1">
            Office Presence: {selectedDate} ({getDayName(selectedDate)})
          </h1>
        </div>

        {/* Date Selector & Export Button */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-xs">
            <Calendar className="w-4 h-4 text-slate-400" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-transparent text-slate-900 dark:text-slate-100 focus:outline-none font-medium cursor-pointer"
            />
          </div>

          <button
            onClick={() => setSelectedDate(getTodayDateString())}
            className="px-3 py-1.5 text-xs rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 transition-colors font-medium cursor-pointer"
          >
            Today
          </button>

          {(isAdmin || isAccountsOfficer) && (
            <button
              onClick={() => handleBatchVerifyToday(isAdmin ? 'admin' : 'accounts')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold shadow-xs transition-colors cursor-pointer text-white ${
                isAdmin
                  ? 'bg-purple-600 hover:bg-purple-700'
                  : 'bg-emerald-600 hover:bg-emerald-700'
              }`}
              title={`Batch verify all active attendance records for ${selectedDate}`}
            >
              <CheckCheck className="w-3.5 h-3.5" />
              <span>Verify All ({isAdmin ? 'Admin' : 'Accounts'})</span>
            </button>
          )}

          <button
            onClick={handleExportToday}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition-colors cursor-pointer"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Export Roster CSV</span>
          </button>
        </div>
      </div>

      {/* Presence & Verification KPI Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5">
        <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs">
          <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
            Clocked In
          </span>
          <div className="text-xl font-bold font-mono text-emerald-600 dark:text-emerald-400 mt-1">
            {liveCounts.inCount}
          </div>
          <span className="text-[10px] text-slate-400">At desks / working</span>
        </div>

        <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs">
          <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
            On Break
          </span>
          <div className="text-xl font-bold font-mono text-amber-600 dark:text-amber-400 mt-1">
            {liveCounts.breakCount}
          </div>
          <span className="text-[10px] text-slate-400">Temporary pause</span>
        </div>

        <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs">
          <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
            Shift Ended
          </span>
          <div className="text-xl font-bold font-mono text-slate-700 dark:text-slate-300 mt-1">
            {liveCounts.completedCount}
          </div>
          <span className="text-[10px] text-slate-400">Punched out</span>
        </div>

        <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs">
          <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
            Not Arrived
          </span>
          <div className="text-xl font-bold font-mono text-rose-600 dark:text-rose-400 mt-1">
            {liveCounts.absentCount}
          </div>
          <span className="text-[10px] text-slate-400">Absent / Leave</span>
        </div>

        <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs">
          <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
            Late Flags
          </span>
          <div className="text-xl font-bold font-mono text-purple-600 dark:text-purple-400 mt-1">
            {liveCounts.lateCount}
          </div>
          <span className="text-[10px] text-slate-400">Beyond shift grace</span>
        </div>

        <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-purple-200/60 dark:border-purple-900/40 shadow-2xs">
          <span className="text-[10px] font-semibold text-purple-600 dark:text-purple-400 uppercase tracking-wider">
            Admin Verified
          </span>
          <div className="text-xl font-bold font-mono text-purple-700 dark:text-purple-300 mt-1">
            {liveCounts.adminVerifiedCount}
          </div>
          <span className="text-[10px] text-slate-400">Validated by Admin</span>
        </div>

        <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-emerald-200/60 dark:border-emerald-900/40 shadow-2xs">
          <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
            Accounts Verified
          </span>
          <div className="text-xl font-bold font-mono text-emerald-700 dark:text-emerald-300 mt-1">
            {liveCounts.accountsVerifiedCount}
          </div>
          <span className="text-[10px] text-slate-400">Validated by Accounts</span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-wrap items-center justify-between gap-3">
        {/* Search */}
        <div className="relative min-w-[240px]">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search employee name or code..."
            className="w-full pl-9 pr-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-slate-100 focus:outline-none"
          />
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
        </div>

        {/* Department and Status Selectors */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">Dept:</span>
            <select
              value={departmentFilter}
              onChange={(e) => setDepartmentFilter(e.target.value)}
              className="px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-slate-100"
            >
              <option value="all">All Departments</option>
              {departments.map((dept) => (
                <option key={dept} value={dept}>
                  {dept}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-slate-100"
            >
              <option value="all">All Statuses</option>
              <option value="in">Currently In</option>
              <option value="break">On Break</option>
              <option value="out">Shift Finished</option>
              <option value="late">Late Arrival</option>
              <option value="absent">Not In</option>
              <option value="admin_unverified">Pending Admin Verification</option>
              <option value="accounts_unverified">Pending Accounts Verification</option>
              <option value="auto_punched">Auto Punched (11:59 PM)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Roster Table */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                <th className="py-3 px-3">Employee</th>
                <th className="py-3 px-3">Department & Shift</th>
                <th className="py-3 px-3">Time In</th>
                <th className="py-3 px-3">Time Out</th>
                <th className="py-3 px-3 text-right">Hours</th>
                <th className="py-3 px-3 text-center">Live Status</th>
                <th className="py-3 px-3 text-center">Admin Verify</th>
                <th className="py-3 px-3 text-center">Accounts Verify</th>
                <th className="py-3 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {teamRoster.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    No employees matched the selected filters.
                  </td>
                </tr>
              ) : (
                teamRoster.map(({ employee, record, shift, derivedStatus }) => {
                  return (
                    <tr
                      key={employee.id}
                      className="hover:bg-slate-50/70 dark:hover:bg-slate-800/50 transition-colors"
                    >
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 flex items-center justify-center font-bold text-xs">
                            {employee.name.charAt(0)}
                          </div>
                          <div>
                            <p className="font-semibold text-slate-900 dark:text-slate-100">
                              {employee.name}
                            </p>
                            <p className="text-[11px] text-slate-400 font-mono">
                              {employee.employeeCode}
                            </p>
                          </div>
                        </div>
                      </td>

                      <td className="py-3 px-3">
                        <p className="text-slate-700 dark:text-slate-300 font-medium">
                          {employee.department}
                        </p>
                        <p className="text-[11px] text-slate-400">
                          {shift.name} ({formatTime12h(shift.startTime)})
                        </p>
                      </td>

                      <td className="py-3 px-3 font-mono font-medium">
                        {record?.timeIn ? (
                          formatTime12h(record.timeIn)
                        ) : (
                          <span className="text-slate-400 font-sans">—</span>
                        )}
                      </td>

                      <td className="py-3 px-3 font-mono font-medium">
                        {record?.timeOut ? (
                          <div>
                            <span>{formatTime12h(record.timeOut)}</span>
                            {record.isAutoPunchedOut && (
                              <span className="block text-[9px] text-amber-600 dark:text-amber-400 font-sans font-semibold">
                                Auto 11:59 PM
                              </span>
                            )}
                          </div>
                        ) : record?.timeIn ? (
                          <span className="text-emerald-600 dark:text-emerald-400 font-sans text-[11px]">
                            Working
                          </span>
                        ) : (
                          <span className="text-slate-400 font-sans">—</span>
                        )}
                      </td>

                      <td className="py-3 px-3 text-right font-mono font-bold tabular-nums">
                        {record ? formatMinutesToHoursMinutes(record.totalWorkedMinutes) : '0h 00m'}
                      </td>

                      <td className="py-3 px-3 text-center">
                        {derivedStatus === 'break' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                            <Coffee className="w-3 h-3" />
                            <span>On Break</span>
                          </span>
                        ) : derivedStatus === 'in' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>Clocked In</span>
                          </span>
                        ) : derivedStatus === 'out' ? (
                          <span className="inline-block px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                            Completed
                          </span>
                        ) : (
                          <span className="inline-block px-2 py-0.5 rounded text-[10px] font-semibold bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
                            Not In
                          </span>
                        )}
                        {record?.status === 'late' && (
                          <span className="ml-1 inline-block px-1.5 py-0.5 rounded text-[9px] font-bold bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-300">
                            LATE
                          </span>
                        )}
                        {record?.isAutoPunchedOut && (
                          <span className="ml-1 inline-block px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300" title="Automatically closed at 11:59 PM">
                            Auto Closed
                          </span>
                        )}
                      </td>

                      {/* Admin Verification Column */}
                      <td className="py-3 px-3 text-center">
                        {record?.timeIn ? (
                          record.adminVerification?.verified ? (
                            <div className="inline-flex flex-col items-center">
                              <span
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300"
                                title={`Verified by ${record.adminVerification.verifiedByName || 'Admin'} on ${
                                  record.adminVerification.verifiedAt
                                    ? new Date(record.adminVerification.verifiedAt).toLocaleTimeString()
                                    : ''
                                }`}
                              >
                                <ShieldCheck className="w-3 h-3 text-purple-600 dark:text-purple-400" />
                                <span>Verified</span>
                              </span>
                              <span className="text-[9px] text-slate-400 truncate max-w-[85px] mt-0.5">
                                {record.adminVerification.verifiedByName || 'Admin'}
                              </span>
                            </div>
                          ) : (
                            <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                              Pending
                            </span>
                          )
                        ) : (
                          <span className="text-slate-400 font-sans">—</span>
                        )}
                      </td>

                      {/* Accounts Verification Column */}
                      <td className="py-3 px-3 text-center">
                        {record?.timeIn ? (
                          record.accountsVerification?.verified ? (
                            <div className="inline-flex flex-col items-center">
                              <span
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300"
                                title={`Verified by ${record.accountsVerification.verifiedByName || 'Accounts'} on ${
                                  record.accountsVerification.verifiedAt
                                    ? new Date(record.accountsVerification.verifiedAt).toLocaleTimeString()
                                    : ''
                                }`}
                              >
                                <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                                <span>Verified</span>
                              </span>
                              <span className="text-[9px] text-slate-400 truncate max-w-[85px] mt-0.5">
                                {record.accountsVerification.verifiedByName || 'Accounts'}
                              </span>
                            </div>
                          ) : (
                            <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                              Pending
                            </span>
                          )
                        ) : (
                          <span className="text-slate-400 font-sans">—</span>
                        )}
                      </td>

                      {/* Actions Column */}
                      <td className="py-3 px-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Admin Verification Action */}
                          {isAdmin && record?.timeIn && (
                            <button
                              onClick={() => handleToggleAdminVerify(record)}
                              className={`inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium transition-colors cursor-pointer ${
                                record.adminVerification?.verified
                                  ? 'bg-purple-50 text-purple-700 hover:bg-purple-100 dark:bg-purple-950/40 dark:text-purple-300'
                                  : 'bg-purple-600 text-white hover:bg-purple-700'
                              }`}
                              title="Toggle Admin Attendance Verification"
                            >
                              <ShieldCheck className="w-3 h-3" />
                              <span>{record.adminVerification?.verified ? 'Admin ✓' : 'Verify (Admin)'}</span>
                            </button>
                          )}

                          {/* Accounts Verification Action */}
                          {isAccountsOfficer && record?.timeIn && (
                            <button
                              onClick={() => handleToggleAccountsVerify(record)}
                              className={`inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium transition-colors cursor-pointer ${
                                record.accountsVerification?.verified
                                  ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300'
                                  : 'bg-emerald-600 text-white hover:bg-emerald-700'
                              }`}
                              title="Toggle Accounts Officer Attendance Verification"
                            >
                              <CheckCircle2 className="w-3 h-3" />
                              <span>{record.accountsVerification?.verified ? 'Accounts ✓' : 'Verify (Accounts)'}</span>
                            </button>
                          )}

                          {/* Manual Audit Adjustment (Admin only) */}
                          {isAdmin && (
                            <button
                              onClick={() => handleOpenAdjustment(employee, record)}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium text-slate-600 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                              title="Manually adjust time logs with audit note"
                            >
                              <Edit3 className="w-3 h-3" />
                              <span>{record ? 'Adjust' : 'Add Punch'}</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Manual Punch Adjustment Modal */}
      {editingEmployee && (
        <Modal
          isOpen={!!editingEmployee}
          onClose={() => {
            setEditingEmployee(null);
            setEditingRecord(null);
          }}
          title={`Adjust Attendance Record: ${editingEmployee.name}`}
          subtitle={`Employee Code: ${editingEmployee.employeeCode} · Date: ${selectedDate}`}
        >
          <form onSubmit={handleSaveAdjustment} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Time In (HH:mm:ss)
                </label>
                <input
                  type="text"
                  value={editTimeIn}
                  onChange={(e) => setEditTimeIn(e.target.value)}
                  placeholder="09:00:00"
                  pattern="^([0-1]?[0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$"
                  required
                  className="w-full text-xs font-mono px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Time Out (HH:mm:ss)
                </label>
                <input
                  type="text"
                  value={editTimeOut}
                  onChange={(e) => setEditTimeOut(e.target.value)}
                  placeholder="17:00:00"
                  pattern="^([0-1]?[0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$"
                  className="w-full text-xs font-mono px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Attendance Status
              </label>
              <select
                value={editStatus}
                onChange={(e) => setEditStatus(e.target.value as AttendanceRecord['status'])}
                className="w-full text-xs px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
              >
                <option value="present">Present (On-Time)</option>
                <option value="late">Late Arrival</option>
                <option value="half_day">Half Day</option>
                <option value="on_leave">On Approved Leave</option>
                <option value="absent">Absent</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Mandatory Audit Note / Reason for Change
              </label>
              <textarea
                value={editAuditReason}
                onChange={(e) => setEditAuditReason(e.target.value)}
                placeholder="e.g. Employee forgot RFID badge at reception desk; verified in-person."
                rows={3}
                required
                className="w-full text-xs px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
              />
              <p className="text-[11px] text-slate-400 mt-1">
                This modification will be logged with your administrator signature: {adminUser.name}.
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => {
                  setEditingEmployee(null);
                  setEditingRecord(null);
                }}
                className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-xs"
              >
                Save Attendance Adjustment
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
