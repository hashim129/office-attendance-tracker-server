import React, { useState, useEffect } from 'react';
import {
  ActiveDesktopTab,
  AppMode,
  AttendanceRecord,
  Employee,
  LeaveRequest,
  OfficeSettings,
  ShiftSchedule,
} from './types';
import {
  clearSession,
  loadAttendanceRecords,
  loadEmployees,
  loadLeaves,
  loadSavedMode,
  loadSession,
  loadSettings,
  loadShifts,
  saveAttendanceRecords,
  saveEmployees,
  saveLeaves,
  saveMode,
  saveSession,
  saveSettings,
  saveShifts,
  syncDatabaseFromServer,
} from './lib/storage';
import {
  calculateWorkedMinutes,
  getCurrentTimeString,
  getDayName,
  getTodayDateString,
  isLateArrival,
} from './lib/attendanceCalculations';
import { detectClientNetwork } from './lib/ipSecurity';
import { getDeviceDetails } from './lib/deviceSecurity';
import { WindowsTitleBar } from './components/common/WindowsTitleBar';
import { LoginView } from './components/desktop/LoginView';
import { DesktopHeader } from './components/desktop/DesktopHeader';
import { DesktopSidebar } from './components/desktop/DesktopSidebar';
import { PunchClockTab } from './components/desktop/PunchClockTab';
import { MyAttendanceTab } from './components/desktop/MyAttendanceTab';
import { TeamAttendanceTab } from './components/desktop/TeamAttendanceTab';
import { EmployeesDirectoryTab } from './components/desktop/EmployeesDirectoryTab';
import { ShiftManagementTab } from './components/desktop/ShiftManagementTab';
import { LeaveManagementTab } from './components/desktop/LeaveManagementTab';
import { ReportsTab } from './components/desktop/ReportsTab';
import { OfficeSettingsTab } from './components/desktop/OfficeSettingsTab';
import { PrintableTimesheetModal } from './components/desktop/PrintableTimesheetModal';
import { KioskMode } from './components/kiosk/KioskMode';

export default function App() {
  const [appMode, setAppMode] = useState<AppMode>(loadSavedMode());
  const [isDark, setIsDark] = useState<boolean>(() => {
    return localStorage.getItem('office_theme') === 'dark';
  });

  // Database State
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [shifts, setShifts] = useState<ShiftSchedule[]>([]);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [settings, setSettings] = useState<OfficeSettings>(loadSettings());
  const [currentClientIp, setCurrentClientIp] = useState<string>('Detecting...');
  const [currentClientIsp, setCurrentClientIsp] = useState<string>('Detecting...');

  // Current Session & Workspace Navigation
  const [currentUser, setCurrentUser] = useState<Employee | null>(null);
  const [activeTab, setActiveTab] = useState<ActiveDesktopTab>('clock');

  // Printable Timesheet Modal State
  const [printModalState, setPrintModalState] = useState<{
    isOpen: boolean;
    employee: Employee | null;
    filteredRecords: AttendanceRecord[];
  }>({
    isOpen: false,
    employee: null,
    filteredRecords: [],
  });

  // Initial Data Load & Server Sync
  useEffect(() => {
    const refreshFromLocal = () => {
      const loadedEmps = loadEmployees();
      const loadedShifts = loadShifts();
      const loadedRecords = loadAttendanceRecords();
      const loadedLeaves = loadLeaves();
      const loadedSettings = loadSettings();

      setEmployees(loadedEmps);
      setShifts(loadedShifts);
      setRecords(loadedRecords);
      setLeaves(loadedLeaves);
      setSettings(loadedSettings);

      const session = loadSession();
      if (session) {
        const matched = loadedEmps.find((e) => e.id === session.userId && e.isActive);
        if (matched) {
          setCurrentUser(matched);
        }
      }
    };

    refreshFromLocal();
    void detectClientNetwork().then((net) => {
      setCurrentClientIp(net.ip);
      setCurrentClientIsp(net.isp);
    });

    // Sync with Cloud / Windows Server backend (/api/db) immediately on boot
    void syncDatabaseFromServer(true).then((updated) => {
      if (updated) refreshFromLocal();
    });

    const syncInterval = setInterval(() => {
      void syncDatabaseFromServer(false).then((updated) => {
        if (updated) refreshFromLocal();
      });
    }, 4000);

    const ipInterval = setInterval(() => {
      void detectClientNetwork().then((net) => {
        setCurrentClientIp(net.ip);
        setCurrentClientIsp(net.isp);
      });
    }, 30000);

    return () => {
      clearInterval(syncInterval);
      clearInterval(ipInterval);
    };
  }, []);

  // Theme synchronization
  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('office_theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('office_theme', 'light');
    }
  }, [isDark]);

  const handleToggleTheme = () => {
    setIsDark(!isDark);
  };

  const handleToggleMode = (mode: AppMode) => {
    setAppMode(mode);
    saveMode(mode);
  };

  const handleLogin = (employee: Employee, keepLoggedIn: boolean) => {
    setCurrentUser(employee);
    saveSession(employee.id, keepLoggedIn);
  };

  const handleLogout = () => {
    clearSession();
    setCurrentUser(null);
  };

  // -------------------------------------------------------------
  // Attendance Clock In / Out / Break Engine
  // -------------------------------------------------------------
  const handleTimeIn = (employeeId: string, notes?: string) => {
    const todayStr = getTodayDateString();
    const dayName = getDayName(todayStr);
    const nowTime = getCurrentTimeString();
    const emp = employees.find((e) => e.id === employeeId);
    if (!emp) return;
    const shift = shifts.find((s) => s.id === emp?.shiftId) || shifts[0];
    const late = isLateArrival(nowTime, shift);

    const existingIdx = records.findIndex(
      (r) => r.employeeId === employeeId && r.date === todayStr
    );

    // DAILY LIMIT ENFORCEMENT: Each employee is restricted to 1 attendance punch daily
    if (existingIdx >= 0 && records[existingIdx].timeIn) {
      alert(
        `Daily Punch Limit: ${emp.name} already clocked in today at ${records[existingIdx].timeIn}. Only ONE clock-in is permitted per day. If a modification is required, contact the Administrator.`
      );
      return;
    }

    // Auto-bind device on first punch if not bound yet
    const { deviceId, deviceLabel } = getDeviceDetails();
    if (!emp.registeredDeviceId && settings.enforceDeviceBinding !== false) {
      const updatedEmp: Employee = {
        ...emp,
        registeredDeviceId: deviceId,
        registeredDeviceName: deviceLabel,
        registeredAt: new Date().toISOString(),
      };
      const updatedEmployees = employees.map((e) => (e.id === emp.id ? updatedEmp : e));
      setEmployees(updatedEmployees);
      saveEmployees(updatedEmployees);
      if (currentUser?.id === emp.id) {
        setCurrentUser(updatedEmp);
      }
    }

    let nextRecords = [...records];

    if (existingIdx >= 0) {
      nextRecords[existingIdx] = {
        ...nextRecords[existingIdx],
        timeIn: nowTime,
        status: late ? 'late' : 'present',
        notes: notes || nextRecords[existingIdx].notes,
        clientIp: currentClientIp,
        deviceId,
        deviceName: deviceLabel,
      };
    } else {
      const newRec: AttendanceRecord = {
        id: `att-${todayStr}-${employeeId}`,
        employeeId,
        date: todayStr,
        day: dayName,
        timeIn: nowTime,
        breaks: [],
        totalWorkedMinutes: 0,
        regularMinutes: 0,
        overtimeMinutes: 0,
        status: late ? 'late' : 'present',
        notes,
        clientIp: currentClientIp,
        deviceId,
        deviceName: deviceLabel,
      };
      nextRecords = [newRec, ...nextRecords];
    }

    setRecords(nextRecords);
    saveAttendanceRecords(nextRecords);
  };

  const handleUpdatePunchNote = (employeeId: string, notes: string) => {
    const todayStr = getTodayDateString();
    const existingIdx = records.findIndex(
      (r) => r.employeeId === employeeId && r.date === todayStr
    );

    if (existingIdx >= 0) {
      const updatedRecords = [...records];
      updatedRecords[existingIdx] = {
        ...updatedRecords[existingIdx],
        notes,
      };
      setRecords(updatedRecords);
      saveAttendanceRecords(updatedRecords);
    }
  };

  const handleTimeOut = (employeeId: string, notes?: string) => {
    const todayStr = getTodayDateString();
    const nowTime = getCurrentTimeString();
    const emp = employees.find((e) => e.id === employeeId);
    const shift = shifts.find((s) => s.id === emp?.shiftId) || shifts[0];

    const existingIdx = records.findIndex(
      (r) => r.employeeId === employeeId && r.date === todayStr
    );

    if (existingIdx === -1) return;

    const currentRec = records[existingIdx];

    // Close any active open break
    const updatedBreaks = currentRec.breaks.map((b) => {
      if (!b.end) {
        return { ...b, end: nowTime };
      }
      return b;
    });

    const worked = calculateWorkedMinutes(
      currentRec.timeIn,
      nowTime,
      updatedBreaks,
      shift.expectedHours
    );

    const updated: AttendanceRecord = {
      ...currentRec,
      timeOut: nowTime,
      breaks: updatedBreaks,
      totalWorkedMinutes: worked.totalWorkedMinutes,
      regularMinutes: worked.regularMinutes,
      overtimeMinutes: worked.overtimeMinutes,
      notes: notes || currentRec.notes,
    };

    const nextRecords = [...records];
    nextRecords[existingIdx] = updated;
    setRecords(nextRecords);
    saveAttendanceRecords(nextRecords);
  };

  const handleStartBreak = (
    employeeId: string,
    type: 'lunch' | 'coffee' | 'short_break'
  ) => {
    const todayStr = getTodayDateString();
    const nowTime = getCurrentTimeString();
    const existingIdx = records.findIndex(
      (r) => r.employeeId === employeeId && r.date === todayStr
    );

    if (existingIdx === -1) return;

    const currentRec = records[existingIdx];
    const newBreak = {
      id: `brk-${Date.now()}`,
      start: nowTime,
      type,
    };

    const updated: AttendanceRecord = {
      ...currentRec,
      breaks: [...currentRec.breaks, newBreak],
    };

    const nextRecords = [...records];
    nextRecords[existingIdx] = updated;
    setRecords(nextRecords);
    saveAttendanceRecords(nextRecords);
  };

  const handleEndBreak = (employeeId: string) => {
    const todayStr = getTodayDateString();
    const nowTime = getCurrentTimeString();
    const existingIdx = records.findIndex(
      (r) => r.employeeId === employeeId && r.date === todayStr
    );

    if (existingIdx === -1) return;

    const currentRec = records[existingIdx];
    const updatedBreaks = currentRec.breaks.map((b) => {
      if (!b.end) {
        return { ...b, end: nowTime };
      }
      return b;
    });

    const updated: AttendanceRecord = {
      ...currentRec,
      breaks: updatedBreaks,
    };

    const nextRecords = [...records];
    nextRecords[existingIdx] = updated;
    setRecords(nextRecords);
    saveAttendanceRecords(nextRecords);
  };

  // -------------------------------------------------------------
  // Admin Data Modification Handlers
  // -------------------------------------------------------------
  const handleAddEmployee = (empData: Omit<Employee, 'id'>) => {
    const newEmp: Employee = {
      ...empData,
      id: `emp-${Date.now()}`,
    };
    const nextEmps = [...employees, newEmp];
    setEmployees(nextEmps);
    saveEmployees(nextEmps);
  };

  const handleUpdateEmployee = (updatedEmp: Employee) => {
    const nextEmps = employees.map((e) => (e.id === updatedEmp.id ? updatedEmp : e));
    setEmployees(nextEmps);
    saveEmployees(nextEmps);
    if (currentUser?.id === updatedEmp.id) {
      setCurrentUser(updatedEmp);
    }
  };

  const handleDeleteEmployee = (empId: string) => {
    const nextEmps = employees.filter((e) => e.id !== empId);
    setEmployees(nextEmps);
    saveEmployees(nextEmps);
  };

  const handleAddShift = (shiftData: Omit<ShiftSchedule, 'id'>) => {
    const newShift: ShiftSchedule = {
      ...shiftData,
      id: `shift-${Date.now()}`,
    };
    const nextShifts = [...shifts, newShift];
    setShifts(nextShifts);
    saveShifts(nextShifts);
  };

  const handleUpdateShift = (updatedShift: ShiftSchedule) => {
    const nextShifts = shifts.map((s) => (s.id === updatedShift.id ? updatedShift : s));
    setShifts(nextShifts);
    saveShifts(nextShifts);
  };

  const handleApplyLeave = (
    leaveData: Omit<LeaveRequest, 'id' | 'appliedAt' | 'status'>
  ) => {
    const newLeave: LeaveRequest = {
      ...leaveData,
      id: `leave-${Date.now()}`,
      status: 'pending',
      appliedAt: new Date().toISOString(),
    };
    const nextLeaves = [newLeave, ...leaves];
    setLeaves(nextLeaves);
    saveLeaves(nextLeaves);
  };

  const handleReviewLeave = (
    leaveId: string,
    status: 'approved' | 'rejected',
    reviewNote?: string
  ) => {
    const nextLeaves = leaves.map((l) => {
      if (l.id === leaveId) {
        return {
          ...l,
          status,
          reviewNote,
          reviewedBy: currentUser?.id,
        };
      }
      return l;
    });
    setLeaves(nextLeaves);
    saveLeaves(nextLeaves);
  };

  const handleUpdateRecord = (updatedRecord: AttendanceRecord) => {
    const existingIdx = records.findIndex((r) => r.id === updatedRecord.id);
    let nextRecords = [...records];
    if (existingIdx >= 0) {
      nextRecords[existingIdx] = updatedRecord;
    } else {
      nextRecords = [updatedRecord, ...nextRecords];
    }
    setRecords(nextRecords);
    saveAttendanceRecords(nextRecords);
  };

  const handleUpdateSettings = (newSettings: OfficeSettings) => {
    setSettings(newSettings);
    saveSettings(newSettings);
  };

  const handleReloadAllData = () => {
    setEmployees(loadEmployees());
    setShifts(loadShifts());
    setRecords(loadAttendanceRecords());
    setLeaves(loadLeaves());
    setSettings(loadSettings());
  };

  const handleOpenPrintModal = (
    emp: Employee | null,
    filteredRecords: AttendanceRecord[]
  ) => {
    setPrintModalState({
      isOpen: true,
      employee: emp,
      filteredRecords,
    });
  };

  const pendingLeavesCount = leaves.filter((l) => l.status === 'pending').length;

  return (
    <div
      id="windows-window-frame"
      className="min-h-screen bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col font-sans transition-all duration-200"
    >
      {/* Windows 11 Title Bar */}
      <WindowsTitleBar
        appMode={appMode}
        onToggleMode={handleToggleMode}
        isDark={isDark}
        onToggleTheme={handleToggleTheme}
        serverHost={settings.serverHostName}
        serverPort={settings.serverPort}
      />

      {/* Screen Mode Render */}
      {appMode === 'kiosk' ? (
        <KioskMode
          employees={employees}
          shifts={shifts}
          records={records}
          settings={settings}
          onTimeIn={handleTimeIn}
          onTimeOut={handleTimeOut}
          onStartBreak={handleStartBreak}
          onEndBreak={handleEndBreak}
          onExitKiosk={() => handleToggleMode('desktop')}
          currentClientIp={currentClientIp}
        />
      ) : !currentUser ? (
        <LoginView
          employees={employees}
          onLogin={handleLogin}
          companyName={settings.companyName}
        />
      ) : (
        <div className="flex-1 flex flex-col min-h-[calc(100vh-2.5rem)] overflow-hidden">
          {/* Header */}
          <DesktopHeader
            currentUser={currentUser}
            activeTab={activeTab}
            onLogout={handleLogout}
            onSwitchToKiosk={() => handleToggleMode('kiosk')}
          />

          {/* Body Split: Sidebar + Active Viewport */}
          <div className="flex-1 flex overflow-hidden">
            <DesktopSidebar
              currentUser={currentUser}
              activeTab={activeTab}
              onSelectTab={setActiveTab}
              pendingLeavesCount={pendingLeavesCount}
              settings={settings}
            />

            <main className="flex-1 p-6 lg:p-8 overflow-y-auto bg-slate-50/50 dark:bg-slate-950/40">
              {activeTab === 'clock' && (
                <PunchClockTab
                  currentUser={currentUser}
                  allEmployees={employees}
                  shifts={shifts}
                  records={records}
                  onTimeIn={handleTimeIn}
                  onTimeOut={handleTimeOut}
                  onStartBreak={handleStartBreak}
                  onEndBreak={handleEndBreak}
                  onUpdatePunchNote={handleUpdatePunchNote}
                  settings={settings}
                  currentClientIp={currentClientIp}
                />
              )}

              {activeTab === 'my-attendance' && (
                <MyAttendanceTab
                  currentUser={currentUser}
                  records={records}
                  shifts={shifts}
                  settings={settings}
                  onOpenPrintModal={handleOpenPrintModal}
                />
              )}

              {activeTab === 'leaves' && (
                <LeaveManagementTab
                  currentUser={currentUser}
                  employees={employees}
                  leaves={leaves}
                  onApplyLeave={handleApplyLeave}
                  onReviewLeave={handleReviewLeave}
                />
              )}

              {/* Admin Views - Protected by Role Guard */}
              {currentUser.role === 'admin' && activeTab === 'team-attendance' && (
                <TeamAttendanceTab
                  employees={employees}
                  records={records}
                  shifts={shifts}
                  settings={settings}
                  onUpdateRecord={handleUpdateRecord}
                  adminUser={currentUser}
                />
              )}

              {currentUser.role === 'admin' && activeTab === 'employees' && (
                <EmployeesDirectoryTab
                  employees={employees}
                  shifts={shifts}
                  onAddEmployee={handleAddEmployee}
                  onUpdateEmployee={handleUpdateEmployee}
                  onDeleteEmployee={handleDeleteEmployee}
                  currentUserId={currentUser.id}
                />
              )}

              {currentUser.role === 'admin' && activeTab === 'shifts' && (
                <ShiftManagementTab
                  shifts={shifts}
                  onAddShift={handleAddShift}
                  onUpdateShift={handleUpdateShift}
                />
              )}

              {currentUser.role === 'admin' && activeTab === 'reports' && (
                <ReportsTab
                  employees={employees}
                  records={records}
                  shifts={shifts}
                  settings={settings}
                  onOpenPrintModal={handleOpenPrintModal}
                />
              )}

              {currentUser.role === 'admin' && activeTab === 'settings' && (
                <OfficeSettingsTab
                  settings={settings}
                  onUpdateSettings={handleUpdateSettings}
                  onReloadAllData={handleReloadAllData}
                  currentClientIp={currentClientIp}
                  currentClientIsp={currentClientIsp}
                />
              )}
            </main>
          </div>
        </div>
      )}

      {/* Printable Timesheet Document Preview Modal */}
      {printModalState.isOpen && (
        <PrintableTimesheetModal
          isOpen={printModalState.isOpen}
          onClose={() =>
            setPrintModalState({
              isOpen: false,
              employee: null,
              filteredRecords: [],
            })
          }
          employee={printModalState.employee}
          allEmployees={employees}
          records={printModalState.filteredRecords}
          settings={settings}
        />
      )}
    </div>
  );
}
