import React, { useState, useMemo } from 'react';
import {
  FileSpreadsheet,
  Download,
  FileText,
  Calendar,
  Filter,
  DollarSign,
  Clock,
  TrendingUp,
  Search,
  Users,
  Sunrise,
  Sunset,
  Crown,
  MessageSquare,
  Send,
} from 'lucide-react';
import {
  AttendanceRecord,
  CeoComment,
  Employee,
  OfficeSettings,
  ShiftSchedule,
} from '../../types';
import {
  calculateBreaksDuration,
  formatMinutesToDecimal,
  formatMinutesToHoursMinutes,
  formatTime12h,
} from '../../lib/attendanceCalculations';
import { exportAttendanceToCsv } from '../../lib/exportUtils';
import { Modal } from '../common/Modal';

interface ReportsTabProps {
  employees: Employee[];
  records: AttendanceRecord[];
  shifts: ShiftSchedule[];
  settings: OfficeSettings;
  onOpenPrintModal: (employee: Employee | null, filteredRecords: AttendanceRecord[]) => void;
  currentUser?: Employee;
  onAddCeoComment?: (comment: Omit<CeoComment, 'id' | 'createdAt'>) => void;
}

export const ReportsTab: React.FC<ReportsTabProps> = ({
  employees,
  records,
  shifts,
  settings,
  onOpenPrintModal,
  currentUser,
  onAddCeoComment,
}) => {
  const [period, setPeriod] = useState<'month' | 'last_month' | 'all' | 'custom'>('month');
  const [customStart, setCustomStart] = useState<string>('');
  const [customEnd, setCustomEnd] = useState<string>('');
  const [selectedDept, setSelectedDept] = useState<string>('all');
  const [selectedEmpId, setSelectedEmpId] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // CEO / Management Mention State
  const [mentioningEmployee, setMentioningEmployee] = useState<Employee | null>(null);
  const [mentionMessage, setMentionMessage] = useState<string>('');

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
      fromName: currentUser?.name || 'Executive Management',
      fromRole: currentUser?.role || 'ceo',
      message: mentionMessage.trim(),
      date: new Date().toISOString().slice(0, 10),
    });

    alert(`Directive/Mention successfully sent to ${mentioningEmployee.name}! It will appear in their notifications and dashboard.`);
    setMentioningEmployee(null);
    setMentionMessage('');
  };

  const empMap = useMemo(() => new Map(employees.map((e) => [e.id, e])), [employees]);
  const departments = useMemo(
    () => Array.from(new Set(employees.map((e) => e.department))).sort(),
    [employees]
  );

  // Filter records
  const filteredRecords = useMemo(() => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();

    return records
      .filter((r) => {
        const emp = empMap.get(r.employeeId);
        if (!emp) return false;

        // Employee filter
        if (selectedEmpId !== 'all' && r.employeeId !== selectedEmpId) return false;

        // Department filter
        if (selectedDept !== 'all' && emp.department !== selectedDept) return false;

        // Status filter
        if (statusFilter !== 'all' && r.status !== statusFilter) return false;

        // Search query
        if (searchQuery) {
          const q = searchQuery.toLowerCase();
          const matchName = emp.name.toLowerCase().includes(q);
          const matchCode = emp.employeeCode.toLowerCase().includes(q);
          const matchDept = emp.department.toLowerCase().includes(q);
          const matchDate = r.date.includes(q);
          if (!matchName && !matchCode && !matchDept && !matchDate) return false;
        }

        // Date period
        const recDate = new Date(r.date + 'T00:00:00');
        if (period === 'month') {
          return recDate.getFullYear() === currentYear && recDate.getMonth() === currentMonth;
        } else if (period === 'last_month') {
          const lastMonthDate = new Date(currentYear, currentMonth - 1, 1);
          return (
            recDate.getFullYear() === lastMonthDate.getFullYear() &&
            recDate.getMonth() === lastMonthDate.getMonth()
          );
        } else if (period === 'custom') {
          if (customStart && r.date < customStart) return false;
          if (customEnd && r.date > customEnd) return false;
          return true;
        }
        return true;
      })
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [records, empMap, selectedEmpId, selectedDept, statusFilter, searchQuery, period, customStart, customEnd]);

  // Summary Metrics
  const summary = useMemo(() => {
    let totalWorkedMinutes = 0;
    let totalRegularMinutes = 0;
    let totalOvertimeMinutes = 0;
    let totalLaborCost = 0;
    let lateCount = 0;
    let presentCount = 0;

    filteredRecords.forEach((r) => {
      totalWorkedMinutes += r.totalWorkedMinutes || 0;
      totalRegularMinutes += r.regularMinutes || 0;
      totalOvertimeMinutes += r.overtimeMinutes || 0;
      if (r.status === 'late') lateCount++;
      if (r.status === 'present' || r.status === 'late') presentCount++;

      const emp = empMap.get(r.employeeId);
      if (emp) {
        const regularHours = (r.regularMinutes || 0) / 60;
        const overtimeHours = (r.overtimeMinutes || 0) / 60;
        const empCost =
          regularHours * emp.hourlyRate +
          overtimeHours * (emp.hourlyRate * settings.overtimeRateMultiplier);
        totalLaborCost += empCost;
      }
    });

    const punctuality = presentCount > 0 ? Math.round(((presentCount - lateCount) / presentCount) * 100) : 100;

    return {
      totalWorkedMinutes,
      totalRegularMinutes,
      totalOvertimeMinutes,
      totalLaborCost,
      lateCount,
      presentCount,
      punctuality,
    };
  }, [filteredRecords, empMap, settings.overtimeRateMultiplier]);

  const handleDownloadFullCsv = () => {
    const singleEmp = selectedEmpId !== 'all' ? empMap.get(selectedEmpId) : undefined;
    exportAttendanceToCsv({
      records: filteredRecords,
      employees,
      shifts,
      settings,
      employeeFilter: singleEmp,
      startDate: customStart || undefined,
      endDate: customEnd || undefined,
    });
  };

  const handleOpenPrintPreview = () => {
    const singleEmp = selectedEmpId !== 'all' ? empMap.get(selectedEmpId) || null : null;
    onOpenPrintModal(singleEmp, filteredRecords);
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-blue-600" />
            <span>Attendance Reports & Payroll Analytics</span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Generate and export company attendance logs, timesheets, and overtime records
          </p>
        </div>

        {/* Export Buttons */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={handleDownloadFullCsv}
            className="flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 shadow-2xs transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-blue-600" />
            <span>Export to Excel / CSV</span>
          </button>

          <button
            onClick={handleOpenPrintPreview}
            className="flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition-colors cursor-pointer"
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Print Official Timesheet (PDF)</span>
          </button>
        </div>
      </div>

      {/* Aggregate KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Working Man-Hours */}
        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs">
            <span className="font-semibold uppercase tracking-wider text-[10px]">
              Total Working Hours
            </span>
            <Clock className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-2xl font-bold font-mono text-slate-900 dark:text-slate-100 mt-2 tabular-nums">
            {formatMinutesToHoursMinutes(summary.totalWorkedMinutes)}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            {formatMinutesToDecimal(summary.totalWorkedMinutes)} total decimal hours
          </p>
        </div>

        {/* Total Overtime */}
        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs">
            <span className="font-semibold uppercase tracking-wider text-[10px]">
              Total Overtime Logged
            </span>
            <TrendingUp className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-2xl font-bold font-mono text-amber-600 dark:text-amber-400 mt-2 tabular-nums">
            {formatMinutesToHoursMinutes(summary.totalOvertimeMinutes)}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            Rate: {settings.overtimeRateMultiplier}x base wage
          </p>
        </div>

        {/* Estimated Payroll / Cost */}
        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs">
            <span className="font-semibold uppercase tracking-wider text-[10px]">
              Est. Payroll Hours Value
            </span>
            <DollarSign className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-bold font-mono text-emerald-600 dark:text-emerald-400 mt-2 tabular-nums">
            ${summary.totalLaborCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            Based on staff wage profiles
          </p>
        </div>

        {/* On-Time Rate */}
        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs">
            <span className="font-semibold uppercase tracking-wider text-[10px]">
              Team Punctuality Rate
            </span>
            <Users className="w-4 h-4 text-purple-600" />
          </div>
          <div className="text-2xl font-bold font-mono text-purple-600 dark:text-purple-400 mt-2 tabular-nums">
            {summary.punctuality}%
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            {summary.lateCount} late arrival{summary.lateCount === 1 ? '' : 's'} recorded
          </p>
        </div>
      </div>

      {/* Filter and Query Controls */}
      <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Period Tabs */}
          <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg text-xs font-medium">
            <button
              onClick={() => setPeriod('month')}
              className={`px-3 py-1.5 rounded-md transition-colors cursor-pointer ${
                period === 'month'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              This Month
            </button>
            <button
              onClick={() => setPeriod('last_month')}
              className={`px-3 py-1.5 rounded-md transition-colors cursor-pointer ${
                period === 'last_month'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              Last Month
            </button>
            <button
              onClick={() => setPeriod('all')}
              className={`px-3 py-1.5 rounded-md transition-colors cursor-pointer ${
                period === 'all'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              All Time
            </button>
            <button
              onClick={() => setPeriod('custom')}
              className={`px-3 py-1.5 rounded-md transition-colors cursor-pointer ${
                period === 'custom'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              Custom Range
            </button>
          </div>

          {/* Search */}
          <div className="relative min-w-[220px]">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search employee or code..."
              className="w-full pl-8 pr-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-slate-100 focus:outline-none"
            />
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
          </div>
        </div>

        {/* Secondary Filters row */}
        <div className="flex flex-wrap items-center gap-4 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
          {period === 'custom' && (
            <div className="flex items-center gap-2">
              <span className="text-slate-500">Dates:</span>
              <input
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                className="px-2.5 py-1 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
              />
              <span className="text-slate-400">to</span>
              <input
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="px-2.5 py-1 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
              />
            </div>
          )}

          <div className="flex items-center gap-2">
            <span className="text-slate-500">Employee:</span>
            <select
              value={selectedEmpId}
              onChange={(e) => setSelectedEmpId(e.target.value)}
              className="px-2.5 py-1 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
            >
              <option value="all">All Employees ({employees.length})</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.name} ({emp.employeeCode})
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-slate-500">Department:</span>
            <select
              value={selectedDept}
              onChange={(e) => setSelectedDept(e.target.value)}
              className="px-2.5 py-1 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
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
            <span className="text-slate-500">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-2.5 py-1 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
            >
              <option value="all">All Statuses</option>
              <option value="present">Present (On Time)</option>
              <option value="late">Late Arrival</option>
            </select>
          </div>

          <div className="ml-auto text-slate-400">
            {filteredRecords.length} records matching
          </div>
        </div>
      </div>

      {/* Reports Table */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                <th className="py-3 px-4">Date & Day</th>
                <th className="py-3 px-4">Employee</th>
                <th className="py-3 px-4">Department</th>
                <th className="py-3 px-4">Time In</th>
                <th className="py-3 px-4">Time Out</th>
                <th className="py-3 px-4">Break</th>
                <th className="py-3 px-4 text-right">Worked (Hours)</th>
                <th className="py-3 px-4 text-right">Overtime</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-center">Verification</th>
                <th className="py-3 px-4">Notes</th>
                {(currentUser?.role === 'ceo' || currentUser?.role === 'admin') && (
                  <th className="py-3 px-4 text-right">Actions</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={currentUser?.role === 'ceo' || currentUser?.role === 'admin' ? 12 : 11} className="py-12 text-center text-slate-400">
                    No records found for the selected reporting criteria.
                  </td>
                </tr>
              ) : (
                filteredRecords.map((r) => {
                  const emp = empMap.get(r.employeeId);
                  const breakMins = calculateBreaksDuration(r.breaks);
                  return (
                    <tr
                      key={r.id}
                      className="hover:bg-slate-50/70 dark:hover:bg-slate-800/50 transition-colors"
                    >
                      <td className="py-3 px-4">
                        <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-lg bg-emerald-50/90 dark:bg-emerald-950/70 border border-emerald-300 dark:border-emerald-700/80 shadow-2xs">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                          <span className="font-bold text-xs text-emerald-900 dark:text-emerald-200">
                            {r.date}
                          </span>
                          <span className="text-emerald-500 font-bold">•</span>
                          <strong className="font-black text-xs text-emerald-800 dark:text-emerald-300 uppercase tracking-wide">
                            {r.day}
                          </strong>
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-900 dark:text-slate-100">
                          {emp ? emp.name : 'Unknown'}
                        </div>
                        <div className="text-[11px] font-mono text-slate-400">
                          {emp?.employeeCode}
                        </div>
                      </td>

                      <td className="py-3 px-4 text-slate-600 dark:text-slate-300">
                        {emp?.department}
                      </td>

                      <td className="py-3 px-4">
                        {r.timeIn ? (
                          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-700 text-emerald-800 dark:text-emerald-200 shadow-2xs font-mono font-bold text-xs">
                            <Sunrise className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                            <span>{formatTime12h(r.timeIn)}</span>
                          </div>
                        ) : (
                          <span className="text-slate-400 font-sans text-xs">—</span>
                        )}
                      </td>

                      <td className="py-3 px-4">
                        {r.timeOut ? (
                          <div className="inline-flex flex-col">
                            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 shadow-2xs font-mono font-bold text-xs">
                              <Sunset className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                              <span>{formatTime12h(r.timeOut)}</span>
                            </div>
                            {r.isAutoPunchedOut && (
                              <span className="text-[9px] text-amber-600 dark:text-amber-400 font-sans font-semibold mt-0.5">
                                Auto 11:59 PM
                              </span>
                            )}
                          </div>
                        ) : r.timeIn ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 font-bold text-[11px] animate-pulse">
                            <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                            Working
                          </span>
                        ) : (
                          <span className="text-slate-400 font-sans text-xs">—</span>
                        )}
                      </td>

                      <td className="py-3 px-4 font-mono text-slate-600 dark:text-slate-400">
                        {breakMins > 0 ? `${breakMins}m` : '—'}
                      </td>

                      <td className="py-3 px-4 font-mono font-bold text-slate-900 dark:text-slate-100 text-right tabular-nums">
                        {formatMinutesToHoursMinutes(r.totalWorkedMinutes)}
                      </td>

                      <td className="py-3 px-4 font-mono text-right tabular-nums">
                        {r.overtimeMinutes > 0 ? (
                          <span className="text-amber-600 dark:text-amber-400 font-semibold">
                            +{formatMinutesToHoursMinutes(r.overtimeMinutes)}
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-center">
                        {r.status === 'late' ? (
                          <span className="inline-block px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                            Late
                          </span>
                        ) : (
                          <span className="inline-block px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">
                            On Time
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-center">
                        <div className="flex flex-col items-center gap-1">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                              r.adminVerification?.verified
                                ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300'
                                : 'bg-slate-100 text-slate-400 dark:bg-slate-800'
                            }`}
                            title={r.adminVerification?.verified ? `Verified by ${r.adminVerification.verifiedByName}` : 'Admin Unverified'}
                          >
                            Admin: {r.adminVerification?.verified ? '✓' : 'Pending'}
                          </span>
                          <span
                            className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                              r.accountsVerification?.verified
                                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                                : 'bg-slate-100 text-slate-400 dark:bg-slate-800'
                            }`}
                            title={r.accountsVerification?.verified ? `Verified by ${r.accountsVerification.verifiedByName}` : 'Accounts Unverified'}
                          >
                            Accounts: {r.accountsVerification?.verified ? '✓' : 'Pending'}
                          </span>
                        </div>
                      </td>

                      <td className="py-3 px-4 text-slate-500 text-[11px]">
                        {r.notes || (r.isManuallyAdjusted ? `Adjusted: ${r.adjustmentNote}` : '—')}
                      </td>

                      {(currentUser?.role === 'ceo' || currentUser?.role === 'admin') && (
                        <td className="py-3 px-4 text-right">
                          {emp && onAddCeoComment && (
                            <button
                              onClick={() => handleOpenMentionModal(emp)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold bg-amber-500 hover:bg-amber-600 text-white shadow-2xs transition-colors cursor-pointer"
                              title={`Send executive directive or comment to ${emp.name}`}
                            >
                              <MessageSquare className="w-3 h-3" />
                              <span>Mention</span>
                            </button>
                          )}
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
                  Sending as {(currentUser?.role || 'ceo').toUpperCase()}: {currentUser?.name || 'Executive'}
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
                placeholder="e.g. Reviewed your performance stats. Great work on meeting punctuality targets!"
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
