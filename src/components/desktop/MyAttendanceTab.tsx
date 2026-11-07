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
  BarChart3,
  PieChart,
  Target,
  Activity,
  Sparkles,
  Sunrise,
  Sunset,
  Crown,
  MessageSquare,
  Check,
  Smartphone,
  KeyRound,
  ShieldCheck,
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
  getDayName,
  getTodayDateString,
} from '../../lib/attendanceCalculations';
import { exportAttendanceToCsv } from '../../lib/exportUtils';

interface MyAttendanceTabProps {
  currentUser: Employee;
  records: AttendanceRecord[];
  shifts: ShiftSchedule[];
  settings: OfficeSettings;
  onOpenPrintModal: (employee: Employee, filteredRecords: AttendanceRecord[]) => void;
  ceoComments?: CeoComment[];
  onMarkCeoCommentRead?: (commentId: string) => void;
  onOpenRequestDevice?: () => void;
  onOpenChangePassword?: () => void;
}

export const MyAttendanceTab: React.FC<MyAttendanceTabProps> = ({
  currentUser,
  records,
  shifts,
  settings,
  onOpenPrintModal,
  ceoComments = [],
  onMarkCeoCommentRead,
  onOpenRequestDevice,
  onOpenChangePassword,
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

  // Current week worked minutes calculation (Monday through Sunday)
  const currentWeekStats = useMemo(() => {
    const today = new Date();
    const dayOfWeek = today.getDay(); // 0 is Sun, 1 is Mon...
    const diffToMon = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const monday = new Date(today);
    monday.setDate(today.getDate() + diffToMon);
    monday.setHours(0, 0, 0, 0);

    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);

    const monStr = monday.toISOString().slice(0, 10);
    const sunStr = sunday.toISOString().slice(0, 10);

    const weekRecords = myAllRecords.filter((r) => r.date >= monStr && r.date <= sunStr);
    const weekWorkedMins = weekRecords.reduce((acc, r) => acc + (r.totalWorkedMinutes || 0), 0);
    const targetMins = 40 * 60; // 40 hours target
    const percent = Math.min(100, Math.round((weekWorkedMins / targetMins) * 100));

    return {
      weekWorkedMins,
      targetMins,
      percent,
      monStr,
      sunStr,
    };
  }, [myAllRecords]);

  // Chronological recent days (up to 10 days) for the interactive bar chart
  const recentDaysForChart = useMemo(() => {
    const slice = filteredRecords.slice(0, 10).reverse();
    return slice.map((r) => {
      const workedHours = (r.totalWorkedMinutes || 0) / 60;
      const regularHours = (r.regularMinutes || 0) / 60;
      const overtimeHours = (r.overtimeMinutes || 0) / 60;
      return {
        id: r.id,
        date: r.date,
        shortDate: r.date.slice(5),
        day: r.day.slice(0, 3),
        fullDay: r.day,
        timeIn: r.timeIn,
        timeOut: r.timeOut,
        workedHours,
        regularHours,
        overtimeHours,
        isLate: r.status === 'late',
      };
    });
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

  const todayStr = getTodayDateString();
  const dayName = getDayName(todayStr);

  const myCeoDirectives = useMemo(() => {
    return ceoComments.filter((c) => c.employeeId === currentUser.id);
  }, [ceoComments, currentUser.id]);

  return (
    <div className="space-y-6">
      {/* Unread Executive Directives Banner */}
      {myCeoDirectives.filter((c) => !c.isRead).length > 0 && (
        <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/60 border-2 border-amber-300 dark:border-amber-700 shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-amber-800 dark:text-amber-200 font-bold text-xs">
              <Crown className="w-4 h-4 text-amber-600" />
              <span>Official Executive Mentions / Directives ({myCeoDirectives.filter((c) => !c.isRead).length})</span>
            </div>
            <span className="text-[10px] text-amber-600 dark:text-amber-400 font-medium uppercase tracking-wider">
              High Priority
            </span>
          </div>
          <div className="space-y-2">
            {myCeoDirectives
              .filter((c) => !c.isRead)
              .map((comment) => (
                <div
                  key={comment.id}
                  className="p-3 rounded-lg bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-800 flex items-start justify-between gap-3"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-bold text-slate-900 dark:text-slate-100">
                        {comment.fromName} ({comment.fromRole.toUpperCase()})
                      </span>
                      <span className="text-[10px] text-slate-400">
                        {new Date(comment.createdAt).toLocaleDateString()} {new Date(comment.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <p className="text-xs text-slate-700 dark:text-slate-300 font-medium">
                      "{comment.message}"
                    </p>
                  </div>
                  {onMarkCeoCommentRead && (
                    <button
                      onClick={() => onMarkCeoCommentRead(comment.id)}
                      className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded bg-amber-100 hover:bg-amber-200 dark:bg-amber-900/40 dark:hover:bg-amber-900/60 text-amber-800 dark:text-amber-200 text-xs font-semibold transition-colors cursor-pointer"
                      title="Acknowledge directive"
                    >
                      <Check className="w-3 h-3" />
                      <span>Mark Read</span>
                    </button>
                  )}
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Header with Title and Download Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <span>My Personal Attendance & Stats</span>
            </h1>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-emerald-100/90 dark:bg-emerald-950/80 border-2 border-emerald-400 dark:border-emerald-600 shadow-2xs">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-xs font-black text-emerald-900 dark:text-emerald-200">
                {todayStr}
              </span>
              <span className="text-emerald-500 font-bold">•</span>
              <span className="text-xs font-black text-emerald-800 dark:text-emerald-300 uppercase tracking-wide">
                {dayName}
              </span>
            </div>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
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

      {/* Device Binding & Account Security Card */}
      <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-900/50 flex items-center justify-center shrink-0">
            <Smartphone className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Device Security & Portal Credentials
              </h3>
              {currentUser.registeredDeviceId ? (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-800">
                  <ShieldCheck className="w-3 h-3 text-emerald-600" />
                  <span>Bound & Approved</span>
                </span>
              ) : currentUser.pendingDeviceRequest?.status === 'pending' ? (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/50 px-2 py-0.5 rounded border border-amber-300 dark:border-amber-700 animate-pulse">
                  <span>⏳ Approval Pending</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">
                  <span>Unbound</span>
                </span>
              )}
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400">
              {currentUser.registeredDeviceId ? (
                <>
                  Bound Device: <strong className="text-slate-700 dark:text-slate-200">{currentUser.registeredDeviceName || currentUser.registeredDeviceId}</strong> · Approved by {currentUser.deviceBoundApprovedBy || 'Administrator'}
                </>
              ) : currentUser.pendingDeviceRequest?.status === 'pending' ? (
                <>
                  Approval requested for: <strong className="text-amber-700 dark:text-amber-300">{currentUser.pendingDeviceRequest.deviceName}</strong> (Reason: "{currentUser.pendingDeviceRequest.reason}")
                </>
              ) : (
                'No personal phone bound. Please submit a device binding request for Admin approval to punch attendance.'
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-stretch md:self-auto justify-end">
          {onOpenRequestDevice && (
            <button
              type="button"
              onClick={onOpenRequestDevice}
              className="flex-1 md:flex-initial inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700 transition-colors cursor-pointer"
            >
              <Smartphone className="w-3.5 h-3.5 text-blue-600" />
              <span>{currentUser.registeredDeviceId ? 'Request Phone Change' : 'Request Phone Approval'}</span>
            </button>
          )}

          {onOpenChangePassword && (
            <button
              type="button"
              onClick={onOpenChangePassword}
              className="flex-1 md:flex-initial inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-2xs transition-colors cursor-pointer"
            >
              <KeyRound className="w-3.5 h-3.5" />
              <span>Change Password / PIN</span>
            </button>
          )}
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

      {/* Graphical Representation of Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Daily Worked Hours Interactive Bar Chart (2 cols) */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 rounded-xl p-5 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-between">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-300 flex items-center justify-center">
                <BarChart3 className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  Daily Work Hours Trend
                </h3>
                <p className="text-[11px] text-slate-400">
                  Logged hours with 8.0h standard shift guideline & overtime highlights
                </p>
              </div>
            </div>

            {/* Chart Legend */}
            <div className="flex items-center gap-3 text-[11px]">
              <span className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
                <span className="w-2.5 h-2.5 rounded-xs bg-blue-500"></span>
                Regular (up to 8h)
              </span>
              <span className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
                <span className="w-2.5 h-2.5 rounded-xs bg-amber-500"></span>
                Overtime
              </span>
              <span className="flex items-center gap-1.5 text-purple-600 dark:text-purple-400 font-semibold">
                <span className="w-2 h-2 rounded-full bg-purple-500"></span>
                Late Arrival
              </span>
            </div>
          </div>

          {/* Bar Chart Container */}
          {recentDaysForChart.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-400">
              No daily attendance records in this period to graph.
            </div>
          ) : (
            <div className="relative pt-6 pb-2">
              {/* 8.0h Reference Line across the chart */}
              <div
                className="absolute left-0 right-0 border-b-2 border-dashed border-emerald-400/80 dark:border-emerald-600 z-10 pointer-events-none flex items-center justify-end pr-2"
                style={{ bottom: `${(8 / 12) * 100}%` }}
                title="8.0h Standard Target"
              >
                <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300 bg-white/95 dark:bg-slate-900/95 px-1.5 py-0.5 rounded shadow-2xs border border-emerald-300 dark:border-emerald-700">
                  8.0h Standard Shift
                </span>
              </div>

              {/* Chart Plot Area */}
              <div className="h-44 flex items-end justify-between gap-2 px-2 border-b border-slate-200 dark:border-slate-800">
                {recentDaysForChart.map((d) => {
                  const maxChartHours = 12;
                  const totalPercent = Math.min(100, Math.max(8, (d.workedHours / maxChartHours) * 100));
                  const overtimePercent = d.workedHours > 0 ? Math.min(100, (d.overtimeHours / d.workedHours) * 100) : 0;

                  return (
                    <div
                      key={d.id}
                      className="group relative flex-1 flex flex-col items-center h-full justify-end cursor-pointer"
                    >
                      {/* Hover Tooltip Card */}
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none absolute -top-16 z-30 bg-slate-900 text-white text-[10px] rounded-lg py-1.5 px-2.5 shadow-xl whitespace-nowrap">
                        <p className="font-bold text-emerald-400">
                          {d.fullDay}, {d.date}
                        </p>
                        <p className="text-slate-200">
                          Total: <strong className="text-white">{d.workedHours.toFixed(1)}h</strong> ({d.timeIn ? formatTime12h(d.timeIn) : '—'} - {d.timeOut ? formatTime12h(d.timeOut) : 'In Progress'})
                        </p>
                        {d.overtimeHours > 0 && (
                          <p className="text-amber-300 font-semibold">
                            +{d.overtimeHours.toFixed(1)}h Overtime
                          </p>
                        )}
                        {d.isLate && <p className="text-purple-300 font-bold">Late Arrival</p>}
                      </div>

                      {/* Bar Visual (Regular + Overtime stacked) */}
                      <div
                        className="w-full max-w-[36px] rounded-t-md overflow-hidden flex flex-col justify-end transition-all group-hover:brightness-110 shadow-xs"
                        style={{ height: `${totalPercent}%` }}
                      >
                        {/* Overtime stack segment */}
                        {d.overtimeHours > 0 && (
                          <div
                            className="w-full bg-gradient-to-t from-amber-500 to-amber-400"
                            style={{ height: `${overtimePercent}%` }}
                            title={`Overtime: ${d.overtimeHours.toFixed(1)}h`}
                          />
                        )}
                        {/* Regular stack segment */}
                        <div
                          className={`w-full flex-1 ${
                            d.isLate
                              ? 'bg-gradient-to-t from-purple-600 to-indigo-500'
                              : 'bg-gradient-to-t from-blue-600 to-emerald-500'
                          }`}
                          title={`Regular: ${d.regularHours.toFixed(1)}h`}
                        />
                      </div>

                      {/* Late arrival dot indicator */}
                      {d.isLate && (
                        <span className="w-1.5 h-1.5 rounded-full bg-purple-500 mt-1" />
                      )}
                    </div>
                  );
                })}
              </div>

              {/* X-Axis Labels */}
              <div className="flex items-center justify-between gap-2 px-2 pt-2 text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                {recentDaysForChart.map((d) => (
                  <div key={d.id} className="flex-1 text-center truncate">
                    <span className="font-semibold block">{d.day}</span>
                    <span className="text-[9px] text-slate-400">{d.shortDate}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right Col: Punctuality Ring & Weekly Target Meter */}
        <div className="space-y-4 flex flex-col justify-between">
          {/* Punctuality Ring / Doughnut Chart */}
          <div className="bg-white dark:bg-slate-900 rounded-xl p-4 border border-slate-200 dark:border-slate-800 shadow-xs flex items-center gap-4">
            {/* SVG Ring */}
            <div className="relative w-24 h-24 shrink-0 flex items-center justify-center">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                {/* Background Ring */}
                <circle
                  cx="50"
                  cy="50"
                  r="38"
                  className="stroke-slate-100 dark:stroke-slate-800"
                  strokeWidth="10"
                  fill="transparent"
                />
                {/* Progress Ring (Emerald) */}
                <circle
                  cx="50"
                  cy="50"
                  r="38"
                  className="stroke-emerald-500 transition-all duration-700 ease-out"
                  strokeWidth="10"
                  strokeDasharray="238.76"
                  strokeDashoffset={238.76 - (238.76 * stats.onTimeRate) / 100}
                  strokeLinecap="round"
                  fill="transparent"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-base font-black font-mono text-slate-900 dark:text-slate-100">
                  {stats.onTimeRate}%
                </span>
                <span className="text-[8px] uppercase tracking-wider text-slate-400 font-bold">
                  On-Time
                </span>
              </div>
            </div>

            {/* Punctuality Details */}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900 dark:text-slate-100">
                <PieChart className="w-3.5 h-3.5 text-emerald-600" />
                <span>Punctuality Ratio</span>
              </div>
              <div className="mt-2 space-y-1 text-[11px]">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                    On-Time:
                  </span>
                  <strong className="text-slate-900 dark:text-slate-100 font-mono">
                    {Math.max(0, stats.presentCount - stats.lateCount)} days
                  </strong>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-purple-500"></span>
                    Late Arrivals:
                  </span>
                  <strong className="text-purple-600 dark:text-purple-400 font-mono">
                    {stats.lateCount} days
                  </strong>
                </div>
              </div>
            </div>
          </div>

          {/* Weekly 40-Hour Target Meter */}
          <div className="bg-white dark:bg-slate-900 rounded-xl p-4 border border-slate-200 dark:border-slate-800 shadow-xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900 dark:text-slate-100">
                <Target className="w-3.5 h-3.5 text-blue-600" />
                <span>Weekly Work Target (40h)</span>
              </div>
              <span className="text-xs font-black font-mono text-blue-600 dark:text-blue-400">
                {currentWeekStats.percent}%
              </span>
            </div>

            {/* Progress Bar Gauge */}
            <div className="w-full bg-slate-100 dark:bg-slate-800 h-3 rounded-full overflow-hidden mt-3 p-0.5">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  currentWeekStats.percent >= 100
                    ? 'bg-gradient-to-r from-emerald-500 to-teal-400'
                    : 'bg-gradient-to-r from-blue-600 to-emerald-500'
                }`}
                style={{ width: `${currentWeekStats.percent}%` }}
              />
            </div>

            <div className="flex items-center justify-between text-[11px] text-slate-400 mt-2 font-mono">
              <span>{formatMinutesToHoursMinutes(currentWeekStats.weekWorkedMins)} logged</span>
              <span>40h target</span>
            </div>

            {currentWeekStats.percent >= 100 ? (
              <div className="mt-2 text-[10px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-700 rounded px-2 py-0.5 text-center">
                🎉 Weekly 40h Target Completed!
              </div>
            ) : (
              <div className="mt-2 text-[10px] text-slate-500 text-center">
                {formatMinutesToHoursMinutes(Math.max(0, currentWeekStats.targetMins - currentWeekStats.weekWorkedMins))} remaining this week
              </div>
            )}
          </div>
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
                        {r.timeIn ? (
                          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-700 text-emerald-800 dark:text-emerald-200 shadow-2xs">
                            <Sunrise className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                            <span className="font-mono font-bold text-xs">{formatTime12h(r.timeIn)}</span>
                          </div>
                        ) : (
                          <span className="text-slate-400 font-sans text-xs">—</span>
                        )}
                      </td>

                      <td className="py-3 px-4">
                        {r.timeOut ? (
                          <div className="inline-flex flex-col">
                            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 shadow-2xs">
                              <Sunset className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                              <span className="font-mono font-bold text-xs">{formatTime12h(r.timeOut)}</span>
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
