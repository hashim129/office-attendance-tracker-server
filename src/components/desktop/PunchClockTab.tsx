import React, { useState, useEffect } from 'react';
import {
  Clock,
  Coffee,
  LogIn,
  LogOut,
  Calendar,
  AlertCircle,
  Timer,
  Info,
  Wifi,
  ShieldAlert,
  ShieldCheck,
  Smartphone,
  Save,
  Check,
  MessageSquare,
  Crown,
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
  parseTimeToMinutes,
  playPunchSound,
} from '../../lib/attendanceCalculations';
import { verifyOfficeIpAccess } from '../../lib/ipSecurity';
import { verifyDeviceAccess, getDeviceDetails } from '../../lib/deviceSecurity';

interface PunchClockTabProps {
  currentUser: Employee;
  allEmployees?: Employee[];
  shifts: ShiftSchedule[];
  records: AttendanceRecord[];
  onTimeIn: (employeeId: string, notes?: string) => void;
  onTimeOut: (employeeId: string, notes?: string) => void;
  onStartBreak: (employeeId: string, type: 'lunch' | 'coffee' | 'short_break') => void;
  onEndBreak: (employeeId: string) => void;
  onUpdatePunchNote?: (employeeId: string, notes: string) => void;
  settings: OfficeSettings;
  currentClientIp?: string;
  ceoComments?: CeoComment[];
  onMarkCeoCommentRead?: (commentId: string) => void;
}

export const PunchClockTab: React.FC<PunchClockTabProps> = ({
  currentUser,
  allEmployees = [],
  shifts,
  records,
  onTimeIn,
  onTimeOut,
  onStartBreak,
  onEndBreak,
  onUpdatePunchNote,
  settings,
  currentClientIp = 'Detecting...',
  ceoComments = [],
  onMarkCeoCommentRead,
}) => {
  const [currentTime, setCurrentTime] = useState<Date>(new Date());
  const [actionNotes, setActionNotes] = useState<string>('');
  const [showNoteInput, setShowNoteInput] = useState<boolean>(false);
  const [noteSavedFeedback, setNoteSavedFeedback] = useState<boolean>(false);

  // Live timer interval
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const todayStr = getTodayDateString();
  const dayName = getDayName(todayStr);
  const userShift = shifts.find((s) => s.id === currentUser.shiftId) || shifts[0];

  // Find today's record for this employee
  const todayRecord = records.find(
    (r) => r.employeeId === currentUser.id && r.date === todayStr
  );

  // Sync existing note into actionNotes state
  useEffect(() => {
    if (todayRecord?.notes !== undefined) {
      setActionNotes(todayRecord.notes || '');
    }
  }, [todayRecord?.notes]);

  const isClockedIn = !!todayRecord && !!todayRecord.timeIn && !todayRecord.timeOut;
  const isCompleted = !!todayRecord && !!todayRecord.timeOut;
  const activeBreak = todayRecord?.breaks?.find((b) => !b.end);
  const isOnBreak = !!activeBreak;

  // 1. Office Wi-Fi IP Security Check
  const ipCheck = verifyOfficeIpAccess(currentClientIp, settings, currentUser);
  const isPunchBlockedByIp = !ipCheck.allowed;

  // 2. Anti-Proxy Single-Device Security Check
  const deviceCheck = verifyDeviceAccess(
    currentUser,
    allEmployees.length > 0 ? allEmployees : [currentUser],
    settings,
    false
  );
  const isPunchBlockedByDevice = !deviceCheck.allowed;

  const isPunchBlocked = isPunchBlockedByIp || isPunchBlockedByDevice;

  // Calculate live elapsed seconds for work and break
  const getElapsedTimeString = (startTimeStr: string): string => {
    const startMins = parseTimeToMinutes(startTimeStr);
    const nowMins = currentTime.getHours() * 60 + currentTime.getMinutes();
    const diffMins = Math.max(0, nowMins - startMins);
    const hours = Math.floor(diffMins / 60);
    const mins = diffMins % 60;
    const secs = currentTime.getSeconds();
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleTimeInClick = () => {
    if (isPunchBlockedByIp) {
      alert(ipCheck.reason || 'Access Denied: Connect to Authorized Office Wi-Fi to mark attendance.');
      return;
    }
    if (isPunchBlockedByDevice) {
      alert(deviceCheck.reason || 'Proxy Punching Denied: You must punch from your registered personal device.');
      return;
    }
    if (todayRecord?.timeIn) {
      alert(`Daily Limit: You have already punched Time In for today at ${formatTime12h(todayRecord.timeIn)}. Employees are permitted only ONE clock-in per day.`);
      return;
    }

    playPunchSound('in');
    onTimeIn(currentUser.id, actionNotes.trim() || undefined);
    setShowNoteInput(false);
  };

  const handleTimeOutClick = () => {
    if (isPunchBlockedByIp) {
      alert(ipCheck.reason || 'Access Denied: Connect to Authorized Office Wi-Fi to mark attendance.');
      return;
    }
    if (isPunchBlockedByDevice) {
      alert(deviceCheck.reason || 'Proxy Punching Denied: You must punch from your registered personal device.');
      return;
    }
    if (confirm('Confirm Clock Out for today? Once clocked out, your shift for today will be complete.')) {
      playPunchSound('out');
      onTimeOut(currentUser.id, actionNotes.trim() || undefined);
      setShowNoteInput(false);
    }
  };

  const handleBreakToggle = () => {
    if (isPunchBlockedByIp) {
      alert(ipCheck.reason || 'Access Denied: Connect to Authorized Office Wi-Fi to mark attendance.');
      return;
    }
    if (isPunchBlockedByDevice) {
      alert(deviceCheck.reason || 'Proxy Punching Denied: You must punch from your registered personal device.');
      return;
    }
    if (isOnBreak) {
      playPunchSound('break');
      onEndBreak(currentUser.id);
    } else {
      playPunchSound('break');
      onStartBreak(currentUser.id, 'lunch');
    }
  };

  const handleSaveNoteRealTime = () => {
    if (!onUpdatePunchNote) return;
    onUpdatePunchNote(currentUser.id, actionNotes.trim());
    setNoteSavedFeedback(true);
    setTimeout(() => setNoteSavedFeedback(false), 2500);
  };

  const formattedDigitalClock = currentTime.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });

  const formattedDate = currentTime.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  const myDirectives = (ceoComments || []).filter(
    (c) => c.employeeId === currentUser.id && !c.isRead
  );

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Unread Executive Directives Banner */}
      {myDirectives.length > 0 && (
        <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/60 border-2 border-amber-300 dark:border-amber-700 shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-amber-800 dark:text-amber-200 font-bold text-xs">
              <Crown className="w-4 h-4 text-amber-600" />
              <span>Executive Directives & Mentions ({myDirectives.length})</span>
            </div>
            <span className="text-[10px] text-amber-600 dark:text-amber-400 font-medium uppercase tracking-wider">
              Immediate Action
            </span>
          </div>
          <div className="space-y-2">
            {myDirectives.map((comment) => (
              <div
                key={comment.id}
                className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-800 flex items-start justify-between gap-3 shadow-2xs"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                      {comment.fromName} ({comment.fromRole.toUpperCase()})
                    </span>
                    <span className="text-[10px] text-slate-400">
                      {new Date(comment.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <p className="text-xs text-slate-700 dark:text-slate-300 font-medium">
                    "{comment.message}"
                  </p>
                </div>
                {onMarkCeoCommentRead && (
                  <button
                    onClick={() => onMarkCeoCommentRead(comment.id)}
                    className="shrink-0 inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-amber-100 hover:bg-amber-200 dark:bg-amber-900/40 dark:hover:bg-amber-900/60 text-amber-800 dark:text-amber-200 text-xs font-bold transition-colors cursor-pointer"
                    title="Acknowledge directive"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Acknowledge</span>
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Top Banner: Welcome & Live Windows Clock */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-xs border border-slate-200 dark:border-slate-800 flex flex-col md:flex-row items-center justify-between gap-6">
        <div>
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-emerald-100/90 dark:bg-emerald-950/80 border-2 border-emerald-400 dark:border-emerald-600 shadow-2xs">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs font-black text-emerald-900 dark:text-emerald-200">
              {formattedDate}
            </span>
            <span className="text-emerald-500 font-bold">•</span>
            <span className="text-xs font-black text-emerald-800 dark:text-emerald-300 uppercase tracking-wide">
              {dayName}
            </span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-2">
            Welcome back, {currentUser.name}
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Assigned Shift: <strong className="text-slate-700 dark:text-slate-300">{userShift.name}</strong> ({formatTime12h(userShift.startTime)} – {formatTime12h(userShift.endTime)}) · {userShift.graceMinutes}m grace period
          </p>
        </div>

        {/* Big Live Digital Clock Display */}
        <div className="bg-slate-950 text-white dark:bg-black rounded-xl px-6 py-4 border border-slate-800 shadow-inner flex flex-col items-center">
          <span className="text-[10px] font-mono tracking-widest text-slate-400 uppercase">
            Office Server Time
          </span>
          <div className="text-3xl sm:text-4xl font-mono font-bold tracking-wider text-blue-400 mt-0.5 tabular-nums">
            {formattedDigitalClock}
          </div>
          <span className="text-[11px] text-emerald-400 font-bold mt-1 tracking-wide">
            {dayName} · Live Sync
          </span>
        </div>
      </div>

      {/* Main Punch Interaction Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Punch Clock Card */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-xs border border-slate-200 dark:border-slate-800 space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Clock className="w-4 h-4 text-blue-600" />
              <span>Shift Attendance Punch</span>
            </h2>

            {/* Current State Indicator */}
            <div>
              {isOnBreak ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                  <Coffee className="w-3.5 h-3.5" />
                  <span>On Lunch Break</span>
                </span>
              ) : isClockedIn ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span>Clocked In (Active)</span>
                </span>
              ) : isCompleted ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Shift Completed (1 Punch / Day)</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                  <span>Not Clocked In Today</span>
                </span>
              )}
            </div>
          </div>

          {/* Active Counters if Clocked In */}
          {isClockedIn && (
            <div className="grid grid-cols-2 gap-4 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800">
              <div>
                <span className="text-[11px] text-slate-500 dark:text-slate-400 uppercase tracking-wider font-semibold">
                  Time In Recorded
                </span>
                <p className="text-xl font-bold font-mono text-slate-900 dark:text-slate-100 mt-0.5">
                  {formatTime12h(todayRecord?.timeIn)}
                </p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  {todayRecord?.status === 'late' ? (
                    <span className="text-amber-600 dark:text-amber-400 font-medium">
                      Late Arrival (Past {userShift.graceMinutes}m grace)
                    </span>
                  ) : (
                    <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                      On-Time Arrival
                    </span>
                  )}
                </p>
              </div>

              <div>
                <span className="text-[11px] text-slate-500 dark:text-slate-400 uppercase tracking-wider font-semibold">
                  {isOnBreak ? 'Active Break Duration' : 'Elapsed Shift Duration'}
                </span>
                <p className="text-xl font-bold font-mono text-blue-600 dark:text-blue-400 mt-0.5 tabular-nums">
                  {isOnBreak && activeBreak
                    ? getElapsedTimeString(activeBreak.start)
                    : todayRecord?.timeIn
                    ? getElapsedTimeString(todayRecord.timeIn)
                    : '00:00:00'}
                </p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Target: {userShift.expectedHours} hours
                </p>
              </div>
            </div>
          )}

          {/* Security Status Banners */}
          <div className="space-y-2">
            {/* 1. Office Wi-Fi Public IP Verification Banner */}
            {settings.enforceOfficeIpLock && (
              <div
                className={`p-3 rounded-xl border flex items-start justify-between gap-3 ${
                  isPunchBlockedByIp
                    ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-900/60 text-rose-800 dark:text-rose-200'
                    : 'bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-900/50 text-emerald-800 dark:text-emerald-200'
                }`}
              >
                <div className="flex items-start gap-2.5">
                  {isPunchBlockedByIp ? (
                    <ShieldAlert className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                  ) : (
                    <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                  )}
                  <div className="text-xs">
                    <div className="font-bold">
                      {isPunchBlockedByIp
                        ? 'Attendance Locked — Unauthorized Network IP'
                        : `Verified Office Wi-Fi (${ipCheck.matchedLabel || 'Authorized Office Network'})`}
                    </div>
                    <p className="text-[11px] opacity-90 mt-0.5">
                      {isPunchBlockedByIp
                        ? ipCheck.reason
                        : 'Your connection matches an authorized Office Wi-Fi network.'}
                    </p>
                  </div>
                </div>
                <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded bg-white/80 dark:bg-slate-900/80 border border-current/20 shrink-0">
                  IP: {currentClientIp}
                </span>
              </div>
            )}

            {/* 2. Anti-Proxy Single-Device Verification Banner */}
            {settings.enforceDeviceBinding && (
              <div
                className={`p-3 rounded-xl border flex items-start justify-between gap-3 ${
                  isPunchBlockedByDevice
                    ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-900/60 text-rose-800 dark:text-rose-200'
                    : deviceCheck.shouldRegister
                    ? 'bg-indigo-50/80 dark:bg-indigo-950/40 border-indigo-200 dark:border-indigo-900/50 text-indigo-900 dark:text-indigo-200'
                    : 'bg-blue-50/70 dark:bg-blue-950/30 border-blue-200 dark:border-blue-900/50 text-blue-900 dark:text-blue-200'
                }`}
              >
                <div className="flex items-start gap-2.5">
                  <Smartphone className="w-4 h-4 shrink-0 mt-0.5" />
                  <div className="text-xs">
                    <div className="font-bold">
                      {isPunchBlockedByDevice
                        ? 'Anti-Proxy Security: Device Mismatch'
                        : deviceCheck.shouldRegister
                        ? 'Personal Device Registration'
                        : 'Authorized Personal Device Bound'}
                    </div>
                    <p className="text-[11px] opacity-90 mt-0.5">
                      {isPunchBlockedByDevice
                        ? deviceCheck.reason
                        : deviceCheck.shouldRegister
                        ? 'This smartphone will be permanently bound to your account on your first punch. Proxy punching by colleagues is prohibited.'
                        : `Device Verified: ${currentUser.registeredDeviceName || deviceCheck.currentDeviceName}`}
                    </p>
                  </div>
                </div>
                <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-white/80 dark:bg-slate-900/80 border border-current/20 shrink-0 max-w-[120px] truncate">
                  {deviceCheck.currentDeviceName.split('·')[0]}
                </span>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="space-y-4 pt-1">
            {!todayRecord?.timeIn ? (
              <button
                onClick={handleTimeInClick}
                disabled={isPunchBlocked}
                className={`w-full py-4 px-6 rounded-xl font-semibold text-base transition-all flex items-center justify-center gap-3 shadow-md ${
                  isPunchBlocked
                    ? 'bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-500 cursor-not-allowed shadow-none'
                    : 'bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white shadow-emerald-600/20 cursor-pointer'
                }`}
              >
                <LogIn className="w-5 h-5" />
                <span>
                  {isPunchBlockedByIp
                    ? 'Connect to Office Wi-Fi to Punch In'
                    : isPunchBlockedByDevice
                    ? 'Unauthorized Device (Proxy Punch Blocked)'
                    : 'Punch Time In (Once Daily)'}
                </span>
              </button>
            ) : !todayRecord.timeOut ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <button
                  onClick={handleBreakToggle}
                  disabled={isPunchBlocked}
                  className={`py-3.5 px-5 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2.5 shadow-xs ${
                    isPunchBlocked
                      ? 'bg-slate-200 dark:bg-slate-800 text-slate-400 cursor-not-allowed'
                      : isOnBreak
                      ? 'bg-amber-600 hover:bg-amber-700 text-white cursor-pointer'
                      : 'bg-amber-100 hover:bg-amber-200 text-amber-900 dark:bg-amber-950/60 dark:text-amber-200 dark:hover:bg-amber-900/60 border border-amber-300 dark:border-amber-800 cursor-pointer'
                  }`}
                >
                  <Coffee className="w-4 h-4" />
                  <span>{isOnBreak ? 'End Lunch Break' : 'Start Lunch Break'}</span>
                </button>

                <button
                  onClick={handleTimeOutClick}
                  disabled={isOnBreak || isPunchBlocked}
                  className={`py-3.5 px-5 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2.5 shadow-xs ${
                    isOnBreak || isPunchBlocked
                      ? 'bg-slate-100 text-slate-400 dark:bg-slate-800 cursor-not-allowed'
                      : 'bg-rose-600 hover:bg-rose-700 text-white shadow-rose-600/20 cursor-pointer'
                  }`}
                  title={
                    isPunchBlockedByIp
                      ? 'Connect to Office Wi-Fi to clock out'
                      : isPunchBlockedByDevice
                      ? 'Unauthorized device'
                      : isOnBreak
                      ? 'Please end break before clocking out'
                      : 'Record Time Out for today'
                  }
                >
                  <LogOut className="w-4 h-4" />
                  <span>Punch Time Out</span>
                </button>
              </div>
            ) : (
              <div className="p-4 bg-emerald-50 dark:bg-emerald-950/30 rounded-xl border border-emerald-200 dark:border-emerald-800/50 text-center space-y-1">
                <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">
                  Daily Attendance Completed
                </p>
                <p className="text-xs text-emerald-700 dark:text-emerald-400">
                  Time In: {formatTime12h(todayRecord.timeIn)} · Time Out: {formatTime12h(todayRecord.timeOut)} · Total Worked: {formatMinutesToHoursMinutes(todayRecord.totalWorkedMinutes)}
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 pt-1">
                  Employees are permitted ONE attendance punch cycle per day. For any manual adjustments, please contact the Administrator.
                </p>
              </div>
            )}

            {/* Real-Time Punch Note / Remark Section */}
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-800 dark:text-slate-200">
                  <MessageSquare className="w-3.5 h-3.5 text-blue-600" />
                  <span>Punch Note / Daily Remark</span>
                </div>
                {noteSavedFeedback && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400 animate-in fade-in">
                    <Check className="w-3.5 h-3.5" />
                    <span>Saved in Real-Time!</span>
                  </span>
                )}
              </div>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                <input
                  type="text"
                  value={actionNotes}
                  onChange={(e) => setActionNotes(e.target.value)}
                  placeholder="e.g. Working from client branch in morning / Doctor appointment"
                  className="flex-1 text-xs px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />

                {todayRecord ? (
                  <button
                    type="button"
                    onClick={handleSaveNoteRealTime}
                    className="px-3.5 py-2 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center justify-center gap-1.5 shadow-xs transition-colors cursor-pointer shrink-0"
                    title="Save remark to database immediately"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>Save Remark</span>
                  </button>
                ) : (
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 self-center px-1">
                    Will save automatically with Time In
                  </span>
                )}
              </div>

              {todayRecord?.notes && !noteSavedFeedback && (
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Current Saved Note: <strong className="text-slate-700 dark:text-slate-300">{todayRecord.notes}</strong>
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Right Col: Today's Timeline Card */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-xs border border-slate-200 dark:border-slate-800 space-y-4">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Timer className="w-4 h-4 text-slate-500" />
            <span>Today's Activity Log</span>
          </h3>

          {!todayRecord ? (
            <div className="py-8 text-center text-xs text-slate-400">
              No punch recorded yet today. Click "Punch Time In" when you begin work.
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-start gap-3 p-3 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-800">
                <LogIn className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-800 dark:text-slate-200">Time In</span>
                    <span className="font-mono font-medium text-slate-600 dark:text-slate-400">
                      {formatTime12h(todayRecord.timeIn)}
                    </span>
                  </div>
                  {todayRecord.notes && (
                    <p className="text-[11px] text-slate-500 mt-0.5 break-words">
                      Note: {todayRecord.notes}
                    </p>
                  )}
                </div>
              </div>

              {/* Breaks */}
              {todayRecord.breaks.map((b, idx) => (
                <div
                  key={b.id || idx}
                  className="flex items-start gap-3 p-3 rounded-lg bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-900/30 text-xs"
                >
                  <Coffee className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-amber-900 dark:text-amber-200 capitalize">
                        {b.type} Break
                      </span>
                      <span className="font-mono text-amber-800 dark:text-amber-300">
                        {formatTime12h(b.start)} {b.end ? `– ${formatTime12h(b.end)}` : '(Active)'}
                      </span>
                    </div>
                  </div>
                </div>
              ))}

              {/* Time Out */}
              {todayRecord.timeOut && (
                <div className="flex items-start gap-3 p-3 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-800">
                  <LogOut className="w-4 h-4 text-rose-600 mt-0.5 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-800 dark:text-slate-200">Time Out</span>
                      <span className="font-mono font-medium text-slate-600 dark:text-slate-400">
                        {formatTime12h(todayRecord.timeOut)}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Shift Details Helper */}
          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-500 space-y-1">
            <div className="flex justify-between">
              <span>Shift:</span>
              <span className="font-medium text-slate-700 dark:text-slate-300">{userShift.name}</span>
            </div>
            <div className="flex justify-between">
              <span>Expected Hours:</span>
              <span className="font-medium text-slate-700 dark:text-slate-300">{userShift.expectedHours}h daily</span>
            </div>
            <div className="flex justify-between">
              <span>Daily Punch Policy:</span>
              <span className="font-medium text-blue-600 dark:text-blue-400">1 Punch Cycle / Day</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
