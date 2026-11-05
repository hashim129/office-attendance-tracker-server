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
  parseTimeToMinutes,
  playPunchSound,
} from '../../lib/attendanceCalculations';
import { verifyOfficeIpAccess } from '../../lib/ipSecurity';

interface PunchClockTabProps {
  currentUser: Employee;
  shifts: ShiftSchedule[];
  records: AttendanceRecord[];
  onTimeIn: (employeeId: string, notes?: string) => void;
  onTimeOut: (employeeId: string, notes?: string) => void;
  onStartBreak: (employeeId: string, type: 'lunch' | 'coffee' | 'short_break') => void;
  onEndBreak: (employeeId: string) => void;
  settings: OfficeSettings;
  currentClientIp?: string;
}

export const PunchClockTab: React.FC<PunchClockTabProps> = ({
  currentUser,
  shifts,
  records,
  onTimeIn,
  onTimeOut,
  onStartBreak,
  onEndBreak,
  settings,
  currentClientIp = 'Detecting...',
}) => {
  const [currentTime, setCurrentTime] = useState<Date>(new Date());
  const [actionNotes, setActionNotes] = useState<string>('');
  const [showNoteInput, setShowNoteInput] = useState<boolean>(false);

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

  const isClockedIn = !!todayRecord && !!todayRecord.timeIn && !todayRecord.timeOut;
  const isCompleted = !!todayRecord && !!todayRecord.timeOut;
  const activeBreak = todayRecord?.breaks?.find((b) => !b.end);
  const isOnBreak = !!activeBreak;

  const ipCheck = verifyOfficeIpAccess(currentClientIp, settings, currentUser);
  const isPunchBlockedByIp = !ipCheck.allowed;

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
    playPunchSound('in');
    onTimeIn(currentUser.id, actionNotes.trim() || undefined);
    setActionNotes('');
    setShowNoteInput(false);
  };

  const handleTimeOutClick = () => {
    if (isPunchBlockedByIp) {
      alert(ipCheck.reason || 'Access Denied: Connect to Authorized Office Wi-Fi to mark attendance.');
      return;
    }
    if (confirm('Confirm Clock Out for today?')) {
      playPunchSound('out');
      onTimeOut(currentUser.id, actionNotes.trim() || undefined);
      setActionNotes('');
      setShowNoteInput(false);
    }
  };

  const handleBreakToggle = () => {
    if (isPunchBlockedByIp) {
      alert(ipCheck.reason || 'Access Denied: Connect to Authorized Office Wi-Fi to mark attendance.');
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

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Top Banner: Welcome & Live Windows Clock */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-xs border border-slate-200 dark:border-slate-800 flex flex-col md:flex-row items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-blue-600 dark:text-blue-400">
            <Calendar className="w-3.5 h-3.5" />
            <span>{formattedDate}</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1">
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
          <span className="text-[11px] text-slate-400 mt-0.5 font-medium">
            {dayName} · Auto-synchronized
          </span>
        </div>
      </div>

      {/* Main Punch Interaction Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Punch Clock Card */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-xs border border-slate-200 dark:border-slate-800 space-y-6">
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
                  <span>Shift Completed Today</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                  <span>Not Clocked In</span>
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

          {/* Office Wi-Fi Public IP Verification Banner */}
          {settings.enforceOfficeIpLock && (
            <div
              className={`p-3.5 rounded-xl border flex items-start justify-between gap-3 ${
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
                      : `Verified Office Network (${ipCheck.matchedLabel || 'Authorized IP'})`}
                  </div>
                  <p className="text-[11px] opacity-90 mt-0.5">
                    {isPunchBlockedByIp
                      ? ipCheck.reason
                      : 'Your connection matches an authorized Office Wi-Fi Public IP address.'}
                  </p>
                </div>
              </div>
              <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded bg-white/80 dark:bg-slate-900/80 border border-current/20 shrink-0">
                IP: {currentClientIp}
              </span>
            </div>
          )}

          {/* Action Buttons */}
          <div className="space-y-4">
            {!todayRecord?.timeIn ? (
              <button
                onClick={handleTimeInClick}
                disabled={isPunchBlockedByIp}
                className={`w-full py-4 px-6 rounded-xl font-semibold text-base transition-all flex items-center justify-center gap-3 shadow-md ${
                  isPunchBlockedByIp
                    ? 'bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-500 cursor-not-allowed shadow-none'
                    : 'bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white shadow-emerald-600/20 cursor-pointer'
                }`}
              >
                <LogIn className="w-5 h-5" />
                <span>
                  {isPunchBlockedByIp
                    ? 'Connect to Office Wi-Fi to Punch In'
                    : 'Punch Time In'}
                </span>
              </button>
            ) : !todayRecord.timeOut ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <button
                  onClick={handleBreakToggle}
                  disabled={isPunchBlockedByIp}
                  className={`py-3.5 px-5 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2.5 shadow-xs ${
                    isPunchBlockedByIp
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
                  disabled={isOnBreak || isPunchBlockedByIp}
                  className={`py-3.5 px-5 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2.5 shadow-xs ${
                    isOnBreak || isPunchBlockedByIp
                      ? 'bg-slate-100 text-slate-400 dark:bg-slate-800 cursor-not-allowed'
                      : 'bg-rose-600 hover:bg-rose-700 text-white shadow-rose-600/20 cursor-pointer'
                  }`}
                  title={
                    isPunchBlockedByIp
                      ? 'Connect to Office Wi-Fi to clock out'
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
              <div className="p-4 bg-emerald-50 dark:bg-emerald-950/30 rounded-xl border border-emerald-200 dark:border-emerald-800/50 text-center">
                <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">
                  Shift Completed Successfully
                </p>
                <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1">
                  Time In: {formatTime12h(todayRecord.timeIn)} · Time Out: {formatTime12h(todayRecord.timeOut)} · Total: {formatMinutesToHoursMinutes(todayRecord.totalWorkedMinutes)}
                </p>
              </div>
            )}

            {/* Optional Note Attachment */}
            {!isCompleted && (
              <div>
                {!showNoteInput ? (
                  <button
                    onClick={() => setShowNoteInput(true)}
                    className="text-xs text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 flex items-center gap-1 cursor-pointer"
                  >
                    <span>+ Add punch note / remark</span>
                  </button>
                ) : (
                  <div className="space-y-1.5 pt-1">
                    <label className="text-xs text-slate-500 font-medium">Punch Note</label>
                    <input
                      type="text"
                      value={actionNotes}
                      onChange={(e) => setActionNotes(e.target.value)}
                      placeholder="e.g. Working from client site in morning"
                      className="w-full text-xs px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
                    />
                  </div>
                )}
              </div>
            )}
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
                    <p className="text-[11px] text-slate-500 mt-0.5 truncate">
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
              <span>Shift Window:</span>
              <span className="font-medium text-slate-700 dark:text-slate-300">
                {formatTime12h(userShift.startTime)} – {formatTime12h(userShift.endTime)}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Late Grace Threshold:</span>
              <span className="font-medium text-slate-700 dark:text-slate-300">
                +{userShift.graceMinutes} minutes
              </span>
            </div>
            <div className="flex justify-between">
              <span>Overtime Threshold:</span>
              <span className="font-medium text-slate-700 dark:text-slate-300">
                After {userShift.expectedHours}h daily
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
