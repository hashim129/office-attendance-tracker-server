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
  Sunrise,
  Sunset,
  Crown,
  MessageSquare,
  Send,
  LogOut,
} from 'lucide-react';
import {
  AttendanceRecord,
  CeoComment,
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
  ceoComments?: CeoComment[];
  onAddCeoComment?: (comment: Omit<CeoComment, 'id' | 'createdAt'>) => void;
}

export const TeamAttendanceTab: React.FC<TeamAttendanceTabProps> = ({
  employees,
  records,
  shifts,
  settings,
  onUpdateRecord,
  adminUser,
  currentUser,
  ceoComments = [],
  onAddCeoComment,
}) => {
  const effectiveUser = currentUser || adminUser;
  const isAdmin = effectiveUser.role === 'admin';
  const isAccountsOfficer = effectiveUser.role === 'accounts';
  const isCeo = effectiveUser.role === 'ceo';
  const canManage = isAdmin || isAccountsOfficer || isCeo;

  const [selectedDate, setSelectedDate] = useState<string>(getTodayDateString());
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [departmentFilter, setDepartmentFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Comprehensive Adjustment Modal State
  const [editingRecord, setEditingRecord] = useState<AttendanceRecord | null>(null);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [editWorkingStatus, setEditWorkingStatus] = useState<'working' | 'completed' | 'break' | 'absent'>('working');
  const [hasPunchIn, setHasPunchIn] = useState<boolean>(true);
  const [editTimeIn, setEditTimeIn] = useState<string>('09:00:00');
  const [hasPunchOut, setHasPunchOut] = useState<boolean>(false);
  const [editTimeOut, setEditTimeOut] = useState<string>('17:00:00');
  const [editStatus, setEditStatus] = useState<AttendanceRecord['status']>('present');
  const [editPunchNote, setEditPunchNote] = useState<string>('');
  const [editAuditReason, setEditAuditReason] = useState<string>('');

  // CEO Mention / Comment Modal State
  const [mentioningEmployee, setMentioningEmployee] = useState<Employee | null>(null);
  const [mentionMessage, setMentionMessage] = useState<string>('');

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
        const isAbsent = !record || !record.timeIn;

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
      })
      .sort((a, b) => {
        // Working status priority: Working 'in' (1) -> On break 'break' (2) -> Completed 'out' (3) -> Absent 'absent' (4)
        const priority: Record<'in' | 'break' | 'out' | 'absent', number> = {
          in: 1,
          break: 2,
          out: 3,
          absent: 4,
        };
        const rankDiff = priority[a.derivedStatus] - priority[b.derivedStatus];
        if (rankDiff !== 0) return rankDiff;

        // Secondary sort: If both currently working, sort by timeIn earliest first
        if (a.derivedStatus === 'in' && a.record?.timeIn && b.record?.timeIn) {
          return a.record.timeIn.localeCompare(b.record.timeIn);
        }
        // Otherwise sort alphabetically by name
        return a.employee.name.localeCompare(b.employee.name);
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
    let presentPCount = 0;
    let absentACount = 0;

    employees.filter((e) => e.isActive).forEach((emp) => {
      const rec = dateRecordMap.get(emp.id);
      if (!rec || !rec.timeIn) {
        absentCount++;
        absentACount++;
      } else {
        presentPCount++;
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
      presentPCount,
      absentACount,
    };
  }, [employees, dateRecordMap]);

  // Open adjustment modal with separate options for punch in, punch out, and working status
  const handleOpenAdjustment = (emp: Employee, existingRecord?: AttendanceRecord) => {
    setEditingEmployee(emp);
    const shift = shiftMap.get(emp.shiftId) || shifts[0];
    if (existingRecord && existingRecord.timeIn) {
      setEditingRecord(existingRecord);
      setHasPunchIn(true);
      setEditTimeIn(existingRecord.timeIn);
      const hasOut = !!existingRecord.timeOut;
      setHasPunchOut(hasOut);
      setEditTimeOut(hasOut ? existingRecord.timeOut! : shift.endTime);

      const onBreak = existingRecord.breaks?.some((b) => !b.end);
      if (onBreak) {
        setEditWorkingStatus('break');
      } else if (hasOut) {
        setEditWorkingStatus('completed');
      } else {
        setEditWorkingStatus('working');
      }

      setEditStatus(existingRecord.status);
      setEditPunchNote(existingRecord.notes || '');
      setEditAuditReason(existingRecord.adjustmentNote || '');
    } else {
      // New punch record or employee marked absent
      setEditingRecord(existingRecord || null);
      setHasPunchIn(true);
      setEditTimeIn(shift.startTime);
      setHasPunchOut(false);
      setEditTimeOut(shift.endTime);
      setEditWorkingStatus('working');
      setEditStatus('present');
      setEditPunchNote('');
      setEditAuditReason('Manual retroactive attendance entry by administrator');
    }
  };

  // Quick 1-click admin clock in / clock out directly from table
  const handleQuickAdminPunch = (emp: Employee, action: 'in' | 'out') => {
    const shift = shiftMap.get(emp.shiftId) || shifts[0];
    const nowTime = new Date().toTimeString().slice(0, 8);
    const existing = dateRecordMap.get(emp.id);

    if (action === 'in') {
      const isLate = isLateArrival(nowTime, shift.startTime, shift.graceMinutes);
      const updated: AttendanceRecord = {
        ...(existing || {
          id: `att-${selectedDate}-${emp.id}`,
          employeeId: emp.id,
          date: selectedDate,
          day: getDayName(selectedDate),
          breaks: [],
        }),
        timeIn: nowTime,
        timeOut: undefined,
        totalWorkedMinutes: 0,
        regularMinutes: 0,
        overtimeMinutes: 0,
        status: isLate ? 'late' : 'present',
        notes: existing?.notes ? `${existing.notes} · Clocked In by Admin` : 'Clocked In by Admin',
        isManuallyAdjusted: true,
        adjustmentNote: `Quick Clock In by ${effectiveUser.name}`,
        adjustedBy: `${effectiveUser.name} (${effectiveUser.role.toUpperCase()})`,
      };
      onUpdateRecord(updated);
    } else {
      if (!existing || !existing.timeIn) {
        alert('Cannot punch out: Employee has no punch-in recorded for today.');
        return;
      }
      const worked = calculateWorkedMinutes(existing.timeIn, nowTime, existing.breaks || [], shift.expectedHours);
      const updated: AttendanceRecord = {
        ...existing,
        timeOut: nowTime,
        totalWorkedMinutes: worked.totalWorkedMinutes,
        regularMinutes: worked.regularMinutes,
        overtimeMinutes: worked.overtimeMinutes,
        notes: existing.notes ? `${existing.notes} · Clocked Out by Admin` : 'Clocked Out by Admin',
        isManuallyAdjusted: true,
        adjustmentNote: `Quick Clock Out by ${effectiveUser.name}`,
        adjustedBy: `${effectiveUser.name} (${effectiveUser.role.toUpperCase()})`,
      };
      onUpdateRecord(updated);
    }
  };

  const handleSaveAdjustment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEmployee) return;

    if (!editAuditReason.trim()) {
      alert('Please provide an audit reason for modifying official attendance records.');
      return;
    }

    const shift = shiftMap.get(editingEmployee.shiftId) || shifts[0];

    // Determine final timeIn and timeOut based on separate options
    let finalTimeIn: string = '';
    let finalTimeOut: string | undefined = undefined;
    let finalStatus: AttendanceRecord['status'] = editStatus;

    if (editWorkingStatus === 'absent' || !hasPunchIn) {
      finalTimeIn = '';
      finalTimeOut = undefined;
      finalStatus = 'absent';
    } else {
      finalTimeIn = editTimeIn.trim() || shift.startTime;

      if (editWorkingStatus === 'working' || !hasPunchOut) {
        finalTimeOut = undefined;
        if (finalStatus === 'absent') finalStatus = 'present';
      } else if (editWorkingStatus === 'completed' || hasPunchOut) {
        finalTimeOut = editTimeOut.trim() || shift.endTime;
        if (finalStatus === 'absent') finalStatus = 'present';
      }
    }

    const worked = finalTimeIn && finalTimeOut
      ? calculateWorkedMinutes(finalTimeIn, finalTimeOut, editingRecord?.breaks || [], shift.expectedHours)
      : finalTimeIn
      ? calculateWorkedMinutes(finalTimeIn, undefined, editingRecord?.breaks || [], shift.expectedHours)
      : { totalWorkedMinutes: 0, regularMinutes: 0, overtimeMinutes: 0 };

    const updated: AttendanceRecord = {
      ...(editingRecord || {
        id: `att-${selectedDate}-${editingEmployee.id}`,
        employeeId: editingEmployee.id,
        date: selectedDate,
        day: getDayName(selectedDate),
        breaks: [],
      }),
      timeIn: finalTimeIn,
      timeOut: finalTimeOut,
      totalWorkedMinutes: worked.totalWorkedMinutes,
      regularMinutes: worked.regularMinutes,
      overtimeMinutes: worked.overtimeMinutes,
      status: finalStatus,
      notes: editPunchNote.trim() || undefined,
      isManuallyAdjusted: true,
      adjustmentNote: editAuditReason.trim(),
      adjustedBy: `${effectiveUser.name} (${effectiveUser.employeeCode || effectiveUser.role.toUpperCase()})`,
    };

    onUpdateRecord(updated);
    setEditingRecord(null);
    setEditingEmployee(null);
  };

  const handleOpenMentionModal = (emp: Employee) => {
    setMentioningEmployee(emp);
    setMentionMessage('');
  };

  const handleSendCeoMention = (e: React.FormEvent) => {
    e.preventDefault();
    if (!mentioningEmployee || !mentionMessage.trim() || !onAddCeoComment) return;

    onAddCeoComment({
      employeeId: mentioningEmployee.id,
      employeeName: mentioningEmployee.name,
      fromName: effectiveUser.name,
      fromRole: effectiveUser.role,
      message: mentionMessage.trim(),
      date: selectedDate,
    });

    alert(`Directive/Mention successfully sent to ${mentioningEmployee.name}! It will appear in their notifications and dashboard.`);
    setMentioningEmployee(null);
    setMentionMessage('');
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
          <div className="flex flex-wrap items-center gap-3 mt-1.5">
            <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">
              Office Presence:
            </h1>
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-emerald-100/90 dark:bg-emerald-950/80 border-2 border-emerald-400 dark:border-emerald-600 shadow-xs">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
              <span className="text-sm font-black text-emerald-900 dark:text-emerald-200">
                {selectedDate}
              </span>
              <span className="text-emerald-500 font-bold">•</span>
              <span className="text-sm font-black text-emerald-800 dark:text-emerald-300 uppercase tracking-wide">
                {getDayName(selectedDate)}
              </span>
            </div>
          </div>
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
        {/* Total Present ('P') */}
        <div className="p-3 rounded-xl bg-emerald-50/80 dark:bg-emerald-950/40 border-2 border-emerald-400/90 dark:border-emerald-600 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black text-emerald-800 dark:text-emerald-300 uppercase tracking-wider">
              Present ('P')
            </span>
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          </div>
          <div className="text-xl font-black font-mono text-emerald-700 dark:text-emerald-300 mt-1">
            {liveCounts.presentPCount}
          </div>
          <span className="text-[10px] font-medium text-emerald-600/90 dark:text-emerald-400">Active present</span>
        </div>

        {/* Total Absent ('A') */}
        <div className="p-3 rounded-xl bg-rose-50/80 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-800 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black text-rose-800 dark:text-rose-300 uppercase tracking-wider">
              Absent ('A')
            </span>
            <span className="w-2 h-2 rounded-full bg-rose-500" />
          </div>
          <div className="text-xl font-black font-mono text-rose-700 dark:text-rose-300 mt-1">
            {liveCounts.absentACount}
          </div>
          <span className="text-[10px] font-medium text-rose-600/90 dark:text-rose-400">Not arrived / leave</span>
        </div>

        {/* Working at desk */}
        <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs">
          <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
            Clocked In (Active)
          </span>
          <div className="text-xl font-bold font-mono text-emerald-600 dark:text-emerald-400 mt-1">
            {liveCounts.inCount}
          </div>
          <span className="text-[10px] text-slate-400">At desks / working</span>
        </div>

        {/* On Break */}
        <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs">
          <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
            On Break
          </span>
          <div className="text-xl font-bold font-mono text-amber-600 dark:text-amber-400 mt-1">
            {liveCounts.breakCount}
          </div>
          <span className="text-[10px] text-slate-400">Temporary pause</span>
        </div>

        {/* Completed */}
        <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs">
          <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
            Shift Ended
          </span>
          <div className="text-xl font-bold font-mono text-slate-700 dark:text-slate-300 mt-1">
            {liveCounts.completedCount}
          </div>
          <span className="text-[10px] text-slate-400">Punched out</span>
        </div>

        {/* Admin Verified */}
        <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-purple-200/60 dark:border-purple-900/40 shadow-2xs">
          <span className="text-[10px] font-semibold text-purple-600 dark:text-purple-400 uppercase tracking-wider">
            Admin Verified
          </span>
          <div className="text-xl font-bold font-mono text-purple-700 dark:text-purple-300 mt-1">
            {liveCounts.adminVerifiedCount}
          </div>
          <span className="text-[10px] text-slate-400">Validated by Admin</span>
        </div>

        {/* Accounts Verified */}
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
                <th className="py-3 px-3 text-center">P / A Status</th>
                <th className="py-3 px-3">Time In</th>
                <th className="py-3 px-3">Time Out</th>
                <th className="py-3 px-3 text-right">Hours</th>
                <th className="py-3 px-3 text-center">Working Status</th>
                <th className="py-3 px-3 text-center">Admin Verify</th>
                <th className="py-3 px-3 text-center">Accounts Verify</th>
                {(isAdmin || isAccountsOfficer || isCeo) && (
                  <th className="py-3 px-3 text-right">Actions</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {teamRoster.length === 0 ? (
                <tr>
                  <td colSpan={isAdmin || isAccountsOfficer || isCeo ? 10 : 9} className="py-12 text-center text-slate-400">
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

                      {/* P / A Status Column */}
                      <td className="py-3 px-3 text-center">
                        {record?.timeIn ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-black tracking-wide bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border border-emerald-400 dark:border-emerald-600 shadow-2xs">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                            <span className="text-xs font-black">P</span>
                            <span className="font-semibold text-[10px] uppercase tracking-wide">Present</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-black tracking-wide bg-rose-100 text-rose-800 dark:bg-rose-950/80 dark:text-rose-300 border border-rose-300 dark:border-rose-800 shadow-2xs">
                            <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                            <span className="text-xs font-black">A</span>
                            <span className="font-semibold text-[10px] uppercase tracking-wide">Absent</span>
                          </span>
                        )}
                      </td>

                      {/* Time In Column */}
                      <td className="py-3 px-3">
                        {record?.timeIn ? (
                          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700 shadow-2xs font-mono font-bold text-xs">
                            <Sunrise className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                            <span>{formatTime12h(record.timeIn)}</span>
                          </div>
                        ) : (
                          <span className="text-slate-400 font-sans font-normal">—</span>
                        )}
                      </td>

                      {/* Time Out Column */}
                      <td className="py-3 px-3">
                        {record?.timeOut ? (
                          <div className="inline-flex flex-col">
                            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700 shadow-2xs font-mono font-bold text-xs">
                              <Sunset className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                              <span>{formatTime12h(record.timeOut)}</span>
                            </div>
                            {record.isAutoPunchedOut && (
                              <span className="text-[9px] text-amber-600 dark:text-amber-400 font-sans font-semibold mt-0.5">
                                Auto 11:59 PM
                              </span>
                            )}
                          </div>
                        ) : record?.timeIn ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 font-bold text-[11px] animate-pulse">
                            <span className="w-2 h-2 rounded-full bg-blue-500"></span>
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

                      {/* Actions Column (Admin, Accounts Officer & CEO) */}
                      {(isAdmin || isAccountsOfficer || isCeo) && (
                        <td className="py-3 px-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {/* CEO / Management Mention Directive */}
                            {(isCeo || isAdmin) && onAddCeoComment && (
                              <button
                                onClick={() => handleOpenMentionModal(employee)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold bg-amber-500 hover:bg-amber-600 text-white shadow-2xs transition-colors cursor-pointer"
                                title={`Send executive directive or mention comment to ${employee.name}`}
                              >
                                <MessageSquare className="w-3 h-3" />
                                <span>Mention</span>
                              </button>
                            )}

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

                            {/* Quick 1-Click Clock In / Clock Out by Admin/CEO */}
                            {(isAdmin || isCeo) && (
                              !record?.timeIn ? (
                                <button
                                  onClick={() => handleQuickAdminPunch(employee, 'in')}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-2xs transition-colors cursor-pointer"
                                  title={`Immediately punch clock-in for ${employee.name} right now`}
                                >
                                  <Sunrise className="w-3 h-3" />
                                  <span>Clock In</span>
                                </button>
                              ) : !record?.timeOut ? (
                                <button
                                  onClick={() => handleQuickAdminPunch(employee, 'out')}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold bg-amber-600 hover:bg-amber-700 text-white shadow-2xs transition-colors cursor-pointer"
                                  title={`Immediately punch clock-out for ${employee.name} right now`}
                                >
                                  <Sunset className="w-3 h-3" />
                                  <span>Clock Out</span>
                                </button>
                              ) : null
                            )}

                            {/* Manual Edit Punch Logs & Working Status (Admin & CEO) */}
                            {(isAdmin || isCeo) && (
                              <button
                                onClick={() => handleOpenAdjustment(employee, record)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-2xs transition-colors cursor-pointer"
                                title="Edit employee punch in, punch out, or working status"
                              >
                                <Edit3 className="w-3 h-3" />
                                <span>{record?.timeIn ? 'Edit Punch' : 'Add Punch'}</span>
                              </button>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Comprehensive Manual Punch & Working Status Adjustment Modal */}
      {editingEmployee && (
        <Modal
          isOpen={!!editingEmployee}
          onClose={() => {
            setEditingEmployee(null);
            setEditingRecord(null);
          }}
          title={`Edit Attendance & Punch Log: ${editingEmployee.name}`}
          subtitle={`Employee Code: ${editingEmployee.employeeCode} · Shift: ${(shiftMap.get(editingEmployee.shiftId) || shifts[0]).name} · Date: ${selectedDate} (${getDayName(selectedDate)})`}
        >
          <form onSubmit={handleSaveAdjustment} className="space-y-4 max-h-[75vh] overflow-y-auto pr-1">
            {/* 1. Working Status Selector (4 Distinct Options) */}
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 space-y-2">
              <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                1. Select Employee Working Status
              </label>
              <div className="grid grid-cols-2 gap-2">
                {/* Option: Currently Working */}
                <button
                  type="button"
                  onClick={() => {
                    setEditWorkingStatus('working');
                    setHasPunchIn(true);
                    setHasPunchOut(false);
                    if (editStatus === 'absent') setEditStatus('present');
                  }}
                  className={`p-2.5 rounded-lg border text-left flex items-start gap-2 transition-all cursor-pointer ${
                    editWorkingStatus === 'working'
                      ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-500 text-emerald-950 dark:text-emerald-200 shadow-2xs ring-1 ring-emerald-400'
                      : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-slate-300'
                  }`}
                >
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 mt-1 shrink-0 animate-pulse" />
                  <div>
                    <p className="text-xs font-bold">Currently Working</p>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400">Clocked In · Shift In Progress</p>
                  </div>
                </button>

                {/* Option: Shift Ended / Punched Out */}
                <button
                  type="button"
                  onClick={() => {
                    setEditWorkingStatus('completed');
                    setHasPunchIn(true);
                    setHasPunchOut(true);
                    if (editStatus === 'absent') setEditStatus('present');
                  }}
                  className={`p-2.5 rounded-lg border text-left flex items-start gap-2 transition-all cursor-pointer ${
                    editWorkingStatus === 'completed'
                      ? 'bg-blue-50 dark:bg-blue-950/60 border-blue-500 text-blue-950 dark:text-blue-200 shadow-2xs ring-1 ring-blue-400'
                      : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-slate-300'
                  }`}
                >
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-500 mt-1 shrink-0" />
                  <div>
                    <p className="text-xs font-bold">Shift Completed</p>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400">Punched Out · Shift Finished</p>
                  </div>
                </button>

                {/* Option: On Break */}
                <button
                  type="button"
                  onClick={() => {
                    setEditWorkingStatus('break');
                    setHasPunchIn(true);
                    setHasPunchOut(false);
                    if (editStatus === 'absent') setEditStatus('present');
                  }}
                  className={`p-2.5 rounded-lg border text-left flex items-start gap-2 transition-all cursor-pointer ${
                    editWorkingStatus === 'break'
                      ? 'bg-amber-50 dark:bg-amber-950/60 border-amber-500 text-amber-950 dark:text-amber-200 shadow-2xs ring-1 ring-amber-400'
                      : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-slate-300'
                  }`}
                >
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500 mt-1 shrink-0" />
                  <div>
                    <p className="text-xs font-bold">On Lunch / Tea Break</p>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400">Temporary Pause in Shift</p>
                  </div>
                </button>

                {/* Option: Absent / Not In */}
                <button
                  type="button"
                  onClick={() => {
                    setEditWorkingStatus('absent');
                    setHasPunchIn(false);
                    setHasPunchOut(false);
                    setEditStatus('absent');
                  }}
                  className={`p-2.5 rounded-lg border text-left flex items-start gap-2 transition-all cursor-pointer ${
                    editWorkingStatus === 'absent'
                      ? 'bg-rose-50 dark:bg-rose-950/60 border-rose-500 text-rose-950 dark:text-rose-200 shadow-2xs ring-1 ring-rose-400'
                      : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-slate-300'
                  }`}
                >
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500 mt-1 shrink-0" />
                  <div>
                    <p className="text-xs font-bold">Absent / Not In</p>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400">Clear punches & mark absent</p>
                  </div>
                </button>
              </div>
            </div>

            {/* 2. Separate Option to Edit Punch In */}
            <div className={`p-3.5 rounded-xl border transition-all ${
              hasPunchIn
                ? 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700'
                : 'bg-slate-100/70 dark:bg-slate-900/40 border-dashed border-slate-300 dark:border-slate-700 opacity-70'
            }`}>
              <div className="flex items-center justify-between mb-2">
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={hasPunchIn}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setHasPunchIn(checked);
                      if (!checked) {
                        setEditWorkingStatus('absent');
                        setHasPunchOut(false);
                      } else if (editWorkingStatus === 'absent') {
                        setEditWorkingStatus('working');
                      }
                    }}
                    className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300 cursor-pointer"
                  />
                  <span className="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                    <Sunrise className="w-3.5 h-3.5 text-emerald-600" />
                    <span>2. Separate Option: Edit Punch In Time</span>
                  </span>
                </label>
                {hasPunchIn ? (
                  <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded">
                    Punch In Active
                  </span>
                ) : (
                  <span className="text-[10px] font-bold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/60 px-2 py-0.5 rounded">
                    Punch In Disabled (Absent)
                  </span>
                )}
              </div>

              {hasPunchIn && (
                <div className="space-y-2 mt-2">
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={editTimeIn}
                      onChange={(e) => setEditTimeIn(e.target.value)}
                      placeholder="09:00:00"
                      pattern="^([0-1]?[0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$"
                      required={hasPunchIn}
                      className="flex-1 text-xs font-mono px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 font-bold"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const shift = shiftMap.get(editingEmployee.shiftId) || shifts[0];
                        setEditTimeIn(shift.startTime);
                      }}
                      className="px-2.5 py-2 text-[11px] font-medium bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-lg text-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
                      title="Set to scheduled shift start time"
                    >
                      Shift Start
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditTimeIn(new Date().toTimeString().slice(0, 8))}
                      className="px-2.5 py-2 text-[11px] font-medium bg-emerald-100 hover:bg-emerald-200 dark:bg-emerald-950/60 dark:hover:bg-emerald-900/60 rounded-lg text-emerald-800 dark:text-emerald-300 transition-colors cursor-pointer"
                      title="Set to right now"
                    >
                      Current Time
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* 3. Separate Option to Edit Punch Out */}
            <div className={`p-3.5 rounded-xl border transition-all ${
              hasPunchOut
                ? 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700'
                : 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800'
            }`}>
              <div className="flex items-center justify-between mb-2">
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={hasPunchOut}
                    disabled={!hasPunchIn}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setHasPunchOut(checked);
                      if (checked) {
                        setEditWorkingStatus('completed');
                        if (!editTimeOut) {
                          const shift = shiftMap.get(editingEmployee.shiftId) || shifts[0];
                          setEditTimeOut(shift.endTime);
                        }
                      } else {
                        setEditWorkingStatus('working');
                      }
                    }}
                    className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300 cursor-pointer disabled:opacity-50"
                  />
                  <span className="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                    <Sunset className="w-3.5 h-3.5 text-amber-600" />
                    <span>3. Separate Option: Edit Punch Out Time</span>
                  </span>
                </label>
                {hasPunchOut ? (
                  <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 px-2 py-0.5 rounded">
                    Punch Out Recorded (Shift Finished)
                  </span>
                ) : (
                  <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-950/80 px-2 py-0.5 rounded flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Currently Working (No Punch Out)
                  </span>
                )}
              </div>

              {hasPunchOut ? (
                <div className="space-y-2 mt-2">
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={editTimeOut}
                      onChange={(e) => setEditTimeOut(e.target.value)}
                      placeholder="17:00:00"
                      pattern="^([0-1]?[0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$"
                      required={hasPunchOut}
                      className="flex-1 text-xs font-mono px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 font-bold"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const shift = shiftMap.get(editingEmployee.shiftId) || shifts[0];
                        setEditTimeOut(shift.endTime);
                      }}
                      className="px-2.5 py-2 text-[11px] font-medium bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-lg text-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
                      title="Set to scheduled shift end time"
                    >
                      Shift End
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditTimeOut(new Date().toTimeString().slice(0, 8))}
                      className="px-2.5 py-2 text-[11px] font-medium bg-amber-100 hover:bg-amber-200 dark:bg-amber-950/60 dark:hover:bg-amber-900/60 rounded-lg text-amber-800 dark:text-amber-300 transition-colors cursor-pointer"
                      title="Set to right now"
                    >
                      Current Time
                    </button>
                  </div>
                </div>
              ) : (
                <p className="text-[11px] text-emerald-700 dark:text-emerald-300 font-medium">
                  ✓ The punch-out time is intentionally left blank so this employee continues working their shift.
                </p>
              )}
            </div>

            {/* 4. Attendance Classification & Notes */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Attendance Classification
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
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Punch Note / Remark (Optional)
                </label>
                <input
                  type="text"
                  value={editPunchNote}
                  onChange={(e) => setEditPunchNote(e.target.value)}
                  placeholder="e.g. Worked from branch office"
                  className="w-full text-xs px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
                />
              </div>
            </div>

            {/* 5. Mandatory Audit Note */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Mandatory Reason for Manual Adjustment / Override
              </label>
              <textarea
                value={editAuditReason}
                onChange={(e) => setEditAuditReason(e.target.value)}
                placeholder="e.g. Employee punch was corrected by administrator due to forgotten badge or network issue."
                rows={2}
                required
                className="w-full text-xs px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-[10px] text-slate-400 mt-1">
                Security signature: Logged under administrator {effectiveUser.name} ({effectiveUser.role.toUpperCase()}).
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
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-xs cursor-pointer"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Save Attendance & Status Adjustment</span>
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* CEO / Management Mention Modal */}
      {mentioningEmployee && (
        <Modal
          isOpen={!!mentioningEmployee}
          onClose={() => {
            setMentioningEmployee(null);
            setMentionMessage('');
          }}
          title={`Executive Mention / Directive: ${mentioningEmployee.name}`}
          subtitle={`Department: ${mentioningEmployee.department} · Code: ${mentioningEmployee.employeeCode}`}
        >
          <form onSubmit={handleSendCeoMention} className="space-y-4">
            <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 flex items-start gap-2.5">
              <Crown className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="text-xs text-amber-900 dark:text-amber-200">
                <p className="font-bold">
                  Sending as {effectiveUser.role.toUpperCase()}: {effectiveUser.name}
                </p>
                <p className="mt-0.5 text-amber-700 dark:text-amber-300">
                  This directive will be delivered immediately to{' '}
                  <strong>{mentioningEmployee.name}</strong> as a high-priority notification.
                </p>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Directive / Comment Message
              </label>
              <textarea
                value={mentionMessage}
                onChange={(e) => setMentionMessage(e.target.value)}
                placeholder="e.g. Great punctuality this week! Please make sure to review client reports before 4 PM."
                rows={4}
                required
                className="w-full text-xs px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => {
                  setMentioningEmployee(null);
                  setMentionMessage('');
                }}
                className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white rounded-lg shadow-xs cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Send Mention Notification</span>
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
