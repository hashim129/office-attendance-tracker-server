import React, { useState, useMemo } from 'react';
import {
  Calendar,
  Clock,
  Download,
  FileText,
  Filter,
  CheckCircle2,
  AlertTriangle,
  TrendingUp,
  Search,
} from 'lucide-react';
import {
  AttendanceRecord,
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

interface MyAttendanceTabProps {
  currentUser: Employee;
  records: AttendanceRecord[];
  shifts: ShiftSchedule[];
  settings: OfficeSettings;
  onOpenPrintModal: (employee: Employee, filteredRecords: AttendanceRecord[]) => void;
}

export const MyAttendanceTab: React.FC<MyAttendanceTabProps> = ({
  currentUser,
  records,
  shifts,
  settings,
  onOpenPrintModal,
}) => {
  // Strict filter: ONLY records belonging to currentUser!
  const myAllRecords = useMemo(() => {
    return records.filter((r) => r.employeeId === currentUser.id);
  }, [records, currentUser.id]);

  const [dateRange, setDateRange] = useState<'all' | 'month' | 'last_month' | 'custom'>('month');
  const [customStart, setCustomStart] = useState<string>('');
  const [customEnd, setCustomEnd] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Calculate filtered records
  const filteredRecords = useMemo(() => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();

    return myAllRecords
      .filter((r) => {
        // Status filter
        if (statusFilter !== 'all' && r.status !== statusFilter) return false;

        // Search in notes or day
        if (searchTerm) {
          const term = searchTerm.toLowerCase();
          const matchNote = r.notes?.toLowerCase().includes(term);
          const matchDay = r.day.toLowerCase().includes(term);
          const matchDate = r.date.includes(term);
          if (!matchNote && !matchDay && !matchDate) return false;
        }

        // Date range
        const recDate = new Date(r.date + 'T00:00:00');
        if (dateRange === 'month') {
          return recDate.getFullYear() === currentYear && recDate.getMonth() === currentMonth;
        } else if (dateRange === 'last_month') {
          const lastMonthDate = new Date(currentYear, currentMonth - 1, 1);
          return (
            recDate.getFullYear() === lastMonthDate.getFullYear() &&
            recDate.getMonth() === lastMonthDate.getMonth()
          );
        } else if (dateRange === 'custom') {
          if (customStart && r.date < customStart) return false;
          if (customEnd && r.date > customEnd) return false;
          return true;
        }
        return true;
      })
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [myAllRecords, dateRange, customStart, customEnd, statusFilter, searchTerm]);

  // Aggregate statistics
  const stats = useMemo(() => {
    let totalWorkedMins = 0;
    let totalRegularMins = 0;
    let totalOvertimeMins = 0;
    let presentCount = 0;
    let lateCount = 0;

    filteredRecords.forEach((r) => {
      totalWorkedMins += r.totalWorkedMinutes || 0;
      totalRegularMins += r.regularMinutes || 0;
      totalOvertimeMins += r.overtimeMinutes || 0;
      if (r.status === 'present') presentCount++;
      if (r.status === 'late') {
        presentCount++;
        lateCount++;
      }
    });

    const onTimeRate = presentCount > 0 ? Math.round(((presentCount - lateCount) / presentCount) * 100) : 100;

    return {
      totalWorkedMins,
      totalRegularMins,
      totalOvertimeMins,
      presentCount,
      lateCount,
      onTimeRate,
    };
  }, [filteredRecords]);

  const handleDownloadCsv = () => {
    exportAttendanceToCsv({
      records: filteredRecords,
      employees: [currentUser],
      shifts,
      settings,
      employeeFilter: currentUser,
      startDate: customStart || undefined,
      endDate: customEnd || undefined,
    });
  };

  return (
    <div className="space-y-6">
      {/* Header with Title and Download Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <span>My Personal Attendance & Stats</span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Individual timesheet records for {currentUser.name} ({currentUser.employeeCode})
          </p>
        </div>

        {/* Export & Print Timesheet Buttons */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={handleDownloadCsv}
            className="flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 shadow-2xs transition-colors cursor-pointer"
            title="Download personal attendance ledger to Excel / CSV"
          >
            <Download className="w-3.5 h-3.5 text-blue-600" />
            <span>Download My Stats (CSV)</span>
          </button>

          <button
            onClick={() => onOpenPrintModal(currentUser, filteredRecords)}
            className="flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition-colors cursor-pointer"
            title="Open printable official timesheet"
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Print Official Timesheet (PDF)</span>
          </button>
        </div>
      </div>

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Hours Worked */}
        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs">
            <span className="font-semibold uppercase tracking-wider text-[10px]">
              Total Hours Worked
            </span>
            <Clock className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-2xl font-bold font-mono text-slate-900 dark:text-slate-100 mt-2 tabular-nums">
            {formatMinutesToHoursMinutes(stats.totalWorkedMins)}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            {formatMinutesToDecimal(stats.totalWorkedMins)} total decimal hours
          </p>
        </div>

        {/* Regular vs Overtime */}
        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs">
            <span className="font-semibold uppercase tracking-wider text-[10px]">
              Overtime Hours
            </span>
            <TrendingUp className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-2xl font-bold font-mono text-amber-600 dark:text-amber-400 mt-2 tabular-nums">
            {formatMinutesToHoursMinutes(stats.totalOvertimeMins)}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            Regular: {formatMinutesToHoursMinutes(stats.totalRegularMins)}
          </p>
        </div>

        {/* Days Present */}
        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs">
            <span className="font-semibold uppercase tracking-wider text-[10px]">
              Days Present
            </span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-bold font-mono text-slate-900 dark:text-slate-100 mt-2 tabular-nums">
            {stats.presentCount} days
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            In current selected period
          </p>
        </div>

        {/* Punctuality Rate */}
        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs">
            <span className="font-semibold uppercase tracking-wider text-[10px]">
              On-Time Punctuality
            </span>
            <AlertTriangle className="w-4 h-4 text-purple-600" />
          </div>
          <div className="text-2xl font-bold font-mono text-slate-900 dark:text-slate-100 mt-2 tabular-nums">
            {stats.onTimeRate}%
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            {stats.lateCount} late arrival{stats.lateCount === 1 ? '' : 's'} flagged
          </p>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-wrap items-center justify-between gap-4">
        {/* Period Selector Tabs */}
        <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg text-xs font-medium">
          <button
            onClick={() => setDateRange('month')}
            className={`px-3 py-1.5 rounded-md transition-colors cursor-pointer ${
              dateRange === 'month'
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            This Month
          </button>
          <button
            onClick={() => setDateRange('last_month')}
            className={`px-3 py-1.5 rounded-md transition-colors cursor-pointer ${
              dateRange === 'last_month'
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            Last Month
          </button>
          <button
            onClick={() => setDateRange('all')}
            className={`px-3 py-1.5 rounded-md transition-colors cursor-pointer ${
              dateRange === 'all'
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            All Logs
          </button>
          <button
            onClick={() => setDateRange('custom')}
            className={`px-3 py-1.5 rounded-md transition-colors cursor-pointer ${
              dateRange === 'custom'
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            Custom Range
          </button>
        </div>

        {/* Custom Range Inputs */}
        {dateRange === 'custom' && (
          <div className="flex items-center gap-2 text-xs">
            <input
              type="date"
              value={customStart}
              onChange={(e) => setCustomStart(e.target.value)}
              className="px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
            />
            <span className="text-slate-400">to</span>
            <input
              type="date"
              value={customEnd}
              onChange={(e) => setCustomEnd(e.target.value)}
              className="px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
            />
          </div>
        )}

        {/* Status Filter */}
        <div className="flex items-center gap-2">
          <Filter className="w-3.5 h-3.5 text-slate-400" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-slate-100"
          >
            <option value="all">All Statuses</option>
            <option value="present">On Time Only</option>
            <option value="late">Late Arrivals</option>
          </select>
        </div>
      </div>

      {/* Attendance Records Table */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                <th className="py-3 px-4">Date & Day</th>
                <th className="py-3 px-4">Time In</th>
                <th className="py-3 px-4">Time Out</th>
                <th className="py-3 px-4">Break Mins</th>
                <th className="py-3 px-4 text-right">Total Hours</th>
                <th className="py-3 px-4 text-right">Overtime</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4">Notes / Audit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    No attendance records found for the selected filter period.
                  </td>
                </tr>
              ) : (
                filteredRecords.map((r) => {
                  const breakMins = calculateBreaksDuration(r.breaks);
                  return (
                    <tr
                      key={r.id}
                      className="hover:bg-slate-50/70 dark:hover:bg-slate-800/50 transition-colors"
                    >
                      <td className="py-3 px-4 font-medium text-slate-900 dark:text-slate-100">
                        <div>{r.date}</div>
                        <div className="text-[11px] text-slate-400 font-normal">{r.day}</div>
                      </td>

                      <td className="py-3 px-4 font-mono font-medium text-slate-700 dark:text-slate-300">
                        {formatTime12h(r.timeIn)}
                      </td>

                      <td className="py-3 px-4 font-mono font-medium text-slate-700 dark:text-slate-300">
                        {r.timeOut ? (
                          formatTime12h(r.timeOut)
                        ) : (
                          <span className="text-amber-600 dark:text-amber-400 font-sans text-[11px]">
                            In Progress
                          </span>
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
                            Late Arrival
                          </span>
                        ) : r.status === 'present' ? (
                          <span className="inline-block px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">
                            On Time
                          </span>
                        ) : (
                          <span className="inline-block px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 capitalize">
                            {r.status}
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-slate-500 text-[11px]">
                        {r.notes || (r.isManuallyAdjusted ? `Manual edit: ${r.adjustmentNote}` : '—')}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
