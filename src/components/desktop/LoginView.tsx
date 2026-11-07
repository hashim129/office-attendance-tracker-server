import React, { useState } from 'react';
import { Clock, KeyRound, Shield, User, ArrowRight, CheckCircle2 } from 'lucide-react';
import { Employee } from '../../types';

interface LoginViewProps {
  employees: Employee[];
  onLogin: (employee: Employee, keepLoggedIn: boolean) => void;
  companyName: string;
}

export const LoginView: React.FC<LoginViewProps> = ({
  employees,
  onLogin,
  companyName,
}) => {
  const [selectedEmpId, setSelectedEmpId] = useState<string>(employees[0]?.id || '');
  const [pinInput, setPinInput] = useState<string>('');
  const [keepLoggedIn, setKeepLoggedIn] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [manualCode, setManualCode] = useState<string>('');
  const [mode, setMode] = useState<'picker' | 'manual'>('picker');

  const selectedEmployee = employees.find((e) => e.id === selectedEmpId);

  const handlePickerSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEmployee) return;

    // Verify PIN
    if (selectedEmployee.pin !== pinInput.trim()) {
      setErrorMsg('Incorrect PIN. Please try again.');
      return;
    }

    setErrorMsg('');
    onLogin(selectedEmployee, keepLoggedIn);
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const emp = employees.find(
      (e) =>
        e.employeeCode.toLowerCase() === manualCode.trim().toLowerCase() ||
        e.email.toLowerCase() === manualCode.trim().toLowerCase()
    );

    if (!emp) {
      setErrorMsg('No employee found with this ID or Email.');
      return;
    }

    if (emp.pin !== pinInput.trim()) {
      setErrorMsg('Incorrect PIN code.');
      return;
    }

    setErrorMsg('');
    onLogin(emp, keepLoggedIn);
  };

  return (
    <div className="min-h-[calc(100vh-2.5rem)] flex items-center justify-center p-6 bg-slate-100/80 dark:bg-slate-950/90 relative overflow-hidden">
      {/* Subtle Windows desktop background elements */}
      <div className="absolute top-1/4 -left-20 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 -right-20 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200/80 dark:border-slate-800 p-8 z-10 transition-all">
        {/* Office Server Header */}
        <div className="flex flex-col items-center text-center mb-6">
          <div className="w-14 h-14 rounded-2xl bg-blue-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20 mb-3">
            <Clock className="w-8 h-8" />
          </div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            {companyName}
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Local Server Attendance & Timesheet Portal
          </p>
        </div>

        {/* Mode Selector Tabs */}
        <div className="flex rounded-lg bg-slate-100 dark:bg-slate-800 p-1 mb-6 text-xs font-medium">
          <button
            type="button"
            onClick={() => {
              setMode('picker');
              setErrorMsg('');
            }}
            className={`flex-1 py-1.5 rounded-md transition-colors ${
              mode === 'picker'
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-xs'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            Staff Directory Select
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('manual');
              setErrorMsg('');
            }}
            className={`flex-1 py-1.5 rounded-md transition-colors ${
              mode === 'manual'
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-xs'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            Employee ID / Email
          </button>
        </div>

        {/* Picker Mode Form */}
        {mode === 'picker' ? (
          <form onSubmit={handlePickerSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                Select Your Account
              </label>
              <div className="relative">
                <select
                  value={selectedEmpId}
                  onChange={(e) => {
                    setSelectedEmpId(e.target.value);
                    setPinInput('');
                    setErrorMsg('');
                  }}
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                >
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.name} ({emp.employeeCode}) — {emp.role.toUpperCase()} [{emp.department}]
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {selectedEmployee && (
              <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 flex items-center justify-center font-bold">
                    {selectedEmployee.name.charAt(0)}
                  </div>
                  <div>
                    <p className="font-semibold text-slate-800 dark:text-slate-200">
                      {selectedEmployee.name}
                    </p>
                    <p className="text-slate-500 dark:text-slate-400 text-[11px]">
                      {selectedEmployee.designation}
                    </p>
                  </div>
                </div>
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider ${
                    selectedEmployee.role === 'admin'
                      ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300'
                      : selectedEmployee.role === 'accounts'
                      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                      : 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'
                  }`}
                >
                  {selectedEmployee.role === 'accounts' ? 'Accounts' : selectedEmployee.role}
                </span>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                Security PIN Code
              </label>
              <div className="relative">
                <input
                  type="password"
                  value={pinInput}
                  onChange={(e) => setPinInput(e.target.value)}
                  placeholder="Enter your 4-digit PIN"
                  maxLength={6}
                  className="w-full px-3.5 py-2.5 pl-10 bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-slate-100 font-mono tracking-widest focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                  required
                />
                <KeyRound className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              </div>
            </div>

            {/* Keep Logged In Option */}
            <div className="flex items-center justify-between text-xs pt-1">
              <label className="flex items-center gap-2 text-slate-600 dark:text-slate-300 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={keepLoggedIn}
                  onChange={(e) => setKeepLoggedIn(e.target.checked)}
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-4 h-4"
                />
                <span>Keep me logged in on this PC</span>
              </label>
            </div>

            {errorMsg && (
              <p className="text-xs text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/30 p-2.5 rounded-lg border border-rose-200 dark:border-rose-900/50">
                {errorMsg}
              </p>
            )}

            <button
              type="submit"
              className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-medium text-sm rounded-lg transition-colors flex items-center justify-center gap-2 shadow-sm cursor-pointer"
            >
              <span>Sign In to Dashboard</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        ) : (
          /* Manual Mode Form */
          <form onSubmit={handleManualSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                Employee Code or Work Email
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={manualCode}
                  onChange={(e) => setManualCode(e.target.value)}
                  placeholder="e.g. EMP-101 or admin@office.local"
                  className="w-full px-3.5 py-2.5 pl-10 bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                  required
                />
                <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                Security PIN Code
              </label>
              <div className="relative">
                <input
                  type="password"
                  value={pinInput}
                  onChange={(e) => setPinInput(e.target.value)}
                  placeholder="Enter your 4-digit PIN"
                  maxLength={6}
                  className="w-full px-3.5 py-2.5 pl-10 bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-slate-100 font-mono tracking-widest focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                  required
                />
                <KeyRound className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              </div>
            </div>

            <div className="flex items-center justify-between text-xs pt-1">
              <label className="flex items-center gap-2 text-slate-600 dark:text-slate-300 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={keepLoggedIn}
                  onChange={(e) => setKeepLoggedIn(e.target.checked)}
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-4 h-4"
                />
                <span>Keep me logged in</span>
              </label>
            </div>

            {errorMsg && (
              <p className="text-xs text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/30 p-2.5 rounded-lg border border-rose-200 dark:border-rose-900/50">
                {errorMsg}
              </p>
            )}

            <button
              type="submit"
              className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm rounded-lg transition-colors flex items-center justify-center gap-2 shadow-sm cursor-pointer"
            >
              <span>Verify & Sign In</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
