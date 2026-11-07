import React, { useState, useEffect } from 'react';
import {
  Clock,
  LogIn,
  LogOut,
  Coffee,
  CheckCircle2,
  Lock,
  ArrowLeft,
  KeyRound,
  User,
  Building,
} from 'lucide-react';
import { AttendanceRecord, Employee, OfficeSettings, ShiftSchedule } from '../../types';
import {
  calculateWorkedMinutes,
  formatMinutesToHoursMinutes,
  formatTime12h,
  getDayName,
  getTodayDateString,
  playPunchSound,
} from '../../lib/attendanceCalculations';
import { verifyOfficeIpAccess } from '../../lib/ipSecurity';

interface KioskModeProps {
  employees: Employee[];
  shifts: ShiftSchedule[];
  records: AttendanceRecord[];
  settings: OfficeSettings;
  onTimeIn: (employeeId: string, notes?: string) => void;
  onTimeOut: (employeeId: string, notes?: string) => void;
  onStartBreak: (employeeId: string, type: 'lunch' | 'coffee' | 'short_break') => void;
  onEndBreak: (employeeId: string) => void;
  onExitKiosk: () => void;
  currentClientIp?: string;
}

export const KioskMode: React.FC<KioskModeProps> = ({
  employees,
  shifts,
  records,
  settings,
  onTimeIn,
  onTimeOut,
  onStartBreak,
  onEndBreak,
  onExitKiosk,
  currentClientIp = 'Detecting...',
}) => {
  const [currentTime, setCurrentTime] = useState<Date>(new Date());
  const [pinInput, setPinInput] = useState<string>('');
  const [matchedEmployee, setMatchedEmployee] = useState<Employee | null>(null);
  const [toastMessage, setToastMessage] = useState<{
    text: string;
    type: 'success' | 'info';
  } | null>(null);

  // Admin Exit Modal
  const [isExitModalOpen, setIsExitModalOpen] = useState<boolean>(false);
  const [adminPinInput, setAdminPinInput] = useState<string>('');
  const [adminPinError, setAdminPinError] = useState<string>('');

  // Update clock every second
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Inactivity auto-reset: if an employee is selected, reset after 15 seconds
  useEffect(() => {
    if (!matchedEmployee && !toastMessage) return;
    const timeout = setTimeout(() => {
      setMatchedEmployee(null);
      setPinInput('');
      setToastMessage(null);
    }, 12000);
    return () => clearTimeout(timeout);
  }, [matchedEmployee, toastMessage]);

  const todayStr = getTodayDateString();
  const dayName = getDayName(todayStr);

  // Today's record for matched employee
  const todayRecord = matchedEmployee
    ? records.find((r) => r.employeeId === matchedEmployee.id && r.date === todayStr)
    : null;

  const isClockedIn = !!todayRecord && !!todayRecord.timeIn && !todayRecord.timeOut;
  const isCompleted = !!todayRecord && !!todayRecord.timeOut;
  const activeBreak = todayRecord?.breaks?.find((b) => !b.end);
  const isOnBreak = !!activeBreak;

  const userShift = matchedEmployee
    ? shifts.find((s) => s.id === matchedEmployee.shiftId) || shifts[0]
    : shifts[0];

  // Handle PIN input key clicks
  const [selectedStaffToAuth, setSelectedStaffToAuth] = useState<Employee | null>(null);

  const handleKeyClick = (digit: string) => {
    if (pinInput.length < 6) {
      const nextPin = pinInput + digit;
      setPinInput(nextPin);

      // Check if 4 digits
      if (nextPin.length === 4) {
        if (selectedStaffToAuth) {
          if (selectedStaffToAuth.pin === nextPin) {
            setMatchedEmployee(selectedStaffToAuth);
            setSelectedStaffToAuth(null);
            setPinInput('');
          } else {
            setToastMessage({
              text: 'Incorrect PIN for selected employee. Please try again.',
              type: 'info',
            });
            setTimeout(() => {
              setPinInput('');
              setToastMessage(null);
            }, 2000);
          }
        } else {
          // Direct PIN entry on keypad
          const found = employees.find((e) => e.pin === nextPin && e.isActive);
          if (found) {
            setMatchedEmployee(found);
            setPinInput('');
          } else {
            setToastMessage({
              text: 'PIN code not recognized. Please check your credentials.',
              type: 'info',
            });
            setTimeout(() => {
              setPinInput('');
              setToastMessage(null);
            }, 2000);
          }
        }
      }
    }
  };

  const handleBackspace = () => {
    setPinInput((prev) => prev.slice(0, -1));
  };

  const handleClear = () => {
    setPinInput('');
    setMatchedEmployee(null);
    setSelectedStaffToAuth(null);
  };

  const handleSelectStaff = (empId: string) => {
    if (!empId) {
      setSelectedStaffToAuth(null);
      return;
    }
    const emp = employees.find((e) => e.id === empId);
    if (emp) {
      setSelectedStaffToAuth(emp);
      setMatchedEmployee(null);
      setPinInput('');
      setToastMessage({
        text: `Please enter 4-digit PIN for ${emp.name}`,
        type: 'info',
      });
      setTimeout(() => setToastMessage(null), 3000);
    }
  };

  const handleKioskTimeIn = () => {
    if (!matchedEmployee) return;
    if (todayRecord?.timeIn) {
      setToastMessage({
        text: `Daily Limit: ${matchedEmployee.name} already punched Time In today at ${formatTime12h(todayRecord.timeIn)}. Only 1 clock-in permitted per day.`,
        type: 'info',
      });
      setTimeout(() => {
        setMatchedEmployee(null);
        setPinInput('');
      }, 4000);
      return;
    }
    const check = verifyOfficeIpAccess(currentClientIp, settings, matchedEmployee);
    if (!check.allowed) {
      setToastMessage({
        text: check.reason || 'Access Denied: Connect to Office Wi-Fi to mark attendance.',
        type: 'info',
      });
      return;
    }
    playPunchSound('in');
    onTimeIn(matchedEmployee.id, 'Lobby Kiosk Punch');
    setToastMessage({
      text: `Good day ${matchedEmployee.name}! Time In registered at ${currentTime.toLocaleTimeString()}`,
      type: 'success',
    });
    setTimeout(() => {
      setMatchedEmployee(null);
      setPinInput('');
    }, 4000);
  };

  const handleKioskTimeOut = () => {
    if (!matchedEmployee) return;
    const check = verifyOfficeIpAccess(currentClientIp, settings, matchedEmployee);
    if (!check.allowed) {
      setToastMessage({
        text: check.reason || 'Access Denied: Connect to Office Wi-Fi to mark attendance.',
        type: 'info',
      });
      return;
    }
    playPunchSound('out');
    onTimeOut(matchedEmployee.id, 'Lobby Kiosk Punch');
    setToastMessage({
      text: `Goodbye ${matchedEmployee.name}! Time Out recorded at ${currentTime.toLocaleTimeString()}`,
      type: 'success',
    });
    setTimeout(() => {
      setMatchedEmployee(null);
      setPinInput('');
    }, 4000);
  };

  const handleKioskBreak = () => {
    if (!matchedEmployee) return;
    const check = verifyOfficeIpAccess(currentClientIp, settings, matchedEmployee);
    if (!check.allowed) {
      setToastMessage({
        text: check.reason || 'Access Denied: Connect to Office Wi-Fi to mark attendance.',
        type: 'info',
      });
      return;
    }
    playPunchSound('break');
    if (isOnBreak) {
      onEndBreak(matchedEmployee.id);
      setToastMessage({
        text: `Welcome back ${matchedEmployee.name}! Break ended.`,
        type: 'info',
      });
    } else {
      onStartBreak(matchedEmployee.id, 'lunch');
      setToastMessage({
        text: `Enjoy your break, ${matchedEmployee.name}!`,
        type: 'info',
      });
    }
    setTimeout(() => {
      setMatchedEmployee(null);
      setPinInput('');
    }, 4000);
  };

  const handleExitKioskSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const admin = employees.find((e) => e.role === 'admin' && e.pin === adminPinInput.trim());
    if (admin) {
      setIsExitModalOpen(false);
      onExitKiosk();
    } else {
      setAdminPinError('Invalid Admin PIN code.');
    }
  };

  const formattedTime = currentTime.toLocaleTimeString('en-US', {
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
    <div className="min-h-screen bg-slate-950 text-white flex flex-col justify-between p-6 sm:p-10 select-none relative overflow-hidden">
      {/* Background ambient lighting */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-blue-600/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-indigo-600/15 rounded-full blur-3xl pointer-events-none" />

      {/* Top Header */}
      <div className="flex items-center justify-between z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-lg shadow-blue-500/20">
            <Building className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold tracking-tight text-white">{settings.companyName}</h2>
            <p className="text-xs text-slate-400">Entrance Lobby Attendance Terminal</p>
          </div>
        </div>

        {/* Exit Kiosk to Desktop button (Admin PIN protected) */}
        <button
          onClick={() => {
            setIsExitModalOpen(true);
            setAdminPinInput('');
            setAdminPinError('');
          }}
          className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors cursor-pointer"
        >
          <Lock className="w-3.5 h-3.5 text-slate-400" />
          <span>Exit Kiosk</span>
        </button>
      </div>

      {/* Center Section: Digital Clock & Touch Punch Pad */}
      <div className="my-auto py-6 max-w-4xl mx-auto w-full z-10 grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
        {/* Left Side: Giant Live Clock & Date */}
        <div className="text-center lg:text-left space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-900/40 text-blue-300 text-xs font-medium border border-blue-800/50">
            <Clock className="w-3.5 h-3.5" />
            <span>Local Server Real-Time Clock</span>
          </div>

          <div className="text-5xl sm:text-7xl font-mono font-bold tracking-tight text-white tabular-nums drop-shadow-md">
            {formattedTime}
          </div>

          <div className="text-lg sm:text-xl font-medium text-slate-300">
            {formattedDate}
          </div>

          <p className="text-xs text-slate-400 max-w-sm">
            Enter your 4-digit PIN on the keypad, or tap your staff card to register Time In, Lunch Break, or Time Out.
          </p>

          {/* Quick Staff Selector for ease of testing */}
          <div className="pt-2">
            <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
              Quick Touch Select (Staff):
            </label>
            <select
              value={matchedEmployee?.id || ''}
              onChange={(e) => handleSelectStaff(e.target.value)}
              className="w-full max-w-sm px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-xs text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">-- Tap or Select Staff Member --</option>
              {employees.filter((e) => e.isActive).map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.name} ({emp.employeeCode})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Right Side: PIN Keypad or Active Employee Punch Card */}
        <div className="bg-slate-900/90 rounded-2xl border border-slate-800 p-6 shadow-2xl backdrop-blur-md">
          {/* Toast Notification Banner */}
          {toastMessage && (
            <div className="mb-4 p-4 rounded-xl bg-emerald-950/80 border border-emerald-700 text-emerald-200 text-xs font-medium flex items-center gap-2.5 animate-in fade-in">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
              <span>{toastMessage.text}</span>
            </div>
          )}

          {!matchedEmployee ? (
            /* PIN Keypad Screen */
            <div className="space-y-4">
              <div className="text-center">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Enter 4-Digit Employee PIN
                </span>
                <div className="h-12 flex items-center justify-center gap-3 mt-2 bg-slate-950 rounded-xl border border-slate-800">
                  {[0, 1, 2, 3].map((idx) => (
                    <div
                      key={idx}
                      className={`w-3.5 h-3.5 rounded-full transition-all ${
                        pinInput.length > idx
                          ? 'bg-blue-400 scale-110 shadow-xs shadow-blue-400'
                          : 'border-2 border-slate-700'
                      }`}
                    />
                  ))}
                </div>
              </div>

              {/* Number Grid */}
              <div className="grid grid-cols-3 gap-2.5 pt-2">
                {['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', '⌫'].map((btn) => (
                  <button
                    key={btn}
                    onClick={() => {
                      if (btn === 'C') handleClear();
                      else if (btn === '⌫') handleBackspace();
                      else handleKeyClick(btn);
                    }}
                    className={`h-14 rounded-xl font-mono text-xl font-semibold flex items-center justify-center transition-all cursor-pointer active:scale-95 ${
                      btn === 'C' || btn === '⌫'
                        ? 'bg-slate-800/60 hover:bg-slate-700 text-slate-400 text-sm font-sans'
                        : 'bg-slate-800 hover:bg-slate-700 text-white shadow-xs'
                    }`}
                  >
                    {btn}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            /* Employee Identified - Punch Options Card */
            <div className="space-y-5 animate-in fade-in">
              {/* Employee Header */}
              <div className="flex items-center justify-between pb-4 border-b border-slate-800">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-lg shadow-md">
                    {matchedEmployee.name.charAt(0)}
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white">{matchedEmployee.name}</h3>
                    <p className="text-xs text-slate-400">
                      {matchedEmployee.designation} · {matchedEmployee.employeeCode}
                    </p>
                  </div>
                </div>

                <button
                  onClick={handleClear}
                  className="px-2.5 py-1 text-xs text-slate-400 hover:text-white bg-slate-800 rounded-lg"
                >
                  Clear
                </button>
              </div>

              {/* Current Status Box */}
              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 text-xs flex items-center justify-between">
                <div>
                  <span className="text-slate-400">Current Status Today:</span>
                  <p className="font-semibold text-white mt-0.5">
                    {isOnBreak
                      ? 'Currently on Lunch Break'
                      : isClockedIn
                      ? `Clocked In (${formatTime12h(todayRecord?.timeIn)})`
                      : isCompleted
                      ? `Shift Completed (${formatTime12h(todayRecord?.timeOut)})`
                      : 'Not Clocked In'}
                  </p>
                </div>

                <span
                  className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                    isOnBreak
                      ? 'bg-amber-900/60 text-amber-300'
                      : isClockedIn
                      ? 'bg-emerald-900/60 text-emerald-300'
                      : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  {isOnBreak ? 'On Break' : isClockedIn ? 'Working' : 'Ready'}
                </span>
              </div>

              {/* Punch Buttons */}
              <div className="space-y-3 pt-2">
                {!todayRecord?.timeIn ? (
                  <button
                    onClick={handleKioskTimeIn}
                    className="w-full py-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-bold text-base flex items-center justify-center gap-2.5 shadow-lg shadow-emerald-600/30 transition-all cursor-pointer"
                  >
                    <LogIn className="w-5 h-5" />
                    <span>Punch Time In</span>
                  </button>
                ) : !todayRecord.timeOut ? (
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={handleKioskBreak}
                      className={`py-3.5 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer ${
                        isOnBreak
                          ? 'bg-amber-600 hover:bg-amber-500 text-white shadow-lg shadow-amber-600/20'
                          : 'bg-slate-800 hover:bg-slate-700 text-amber-400 border border-amber-900/40'
                      }`}
                    >
                      <Coffee className="w-4 h-4" />
                      <span>{isOnBreak ? 'End Break' : 'Start Break'}</span>
                    </button>

                    <button
                      onClick={handleKioskTimeOut}
                      disabled={isOnBreak}
                      className={`py-3.5 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer ${
                        isOnBreak
                          ? 'bg-slate-800/40 text-slate-600 cursor-not-allowed'
                          : 'bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-600/20'
                      }`}
                    >
                      <LogOut className="w-4 h-4" />
                      <span>Punch Time Out</span>
                    </button>
                  </div>
                ) : (
                  <div className="p-3 bg-emerald-950/40 rounded-xl border border-emerald-800/40 text-center text-xs text-emerald-300">
                    Shift already recorded for today. Have a great evening!
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Footer */}
      <div className="flex items-center justify-between text-xs text-slate-500 z-10 pt-4 border-t border-slate-900">
        <span>Windows Local Server Kiosk Terminal · IP: 127.0.0.1:{settings.serverPort}</span>
        <span>Secured Office Access</span>
      </div>

      {/* Admin PIN Exit Modal */}
      {isExitModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="w-full max-w-sm bg-slate-900 rounded-2xl border border-slate-800 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Lock className="w-4 h-4 text-blue-400" />
                <span>Admin Authorization Required</span>
              </h3>
              <button
                onClick={() => setIsExitModalOpen(false)}
                className="text-slate-500 hover:text-white"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-400">
              Enter your Administrator PIN to exit kiosk mode and return to the Desktop management workspace.
            </p>

            <form onSubmit={handleExitKioskSubmit} className="space-y-4">
              <input
                type="password"
                value={adminPinInput}
                onChange={(e) => setAdminPinInput(e.target.value)}
                placeholder="Enter Admin PIN"
                maxLength={6}
                required
                autoFocus
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-lg text-sm text-center font-mono tracking-widest text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />

              {adminPinError && (
                <p className="text-xs text-rose-400 bg-rose-950/40 p-2 rounded-lg border border-rose-900">
                  {adminPinError}
                </p>
              )}

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsExitModalOpen(false)}
                  className="flex-1 py-2 text-xs font-semibold text-slate-400 hover:text-white bg-slate-800 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-lg shadow-xs"
                >
                  Verify & Exit
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
