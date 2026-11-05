import React from 'react';
import { Printer, Download, X } from 'lucide-react';
import { AttendanceRecord, Employee, OfficeSettings } from '../../types';
import {
  calculateBreaksDuration,
  formatMinutesToDecimal,
  formatMinutesToHoursMinutes,
  formatTime12h,
} from '../../lib/attendanceCalculations';

interface PrintableTimesheetModalProps {
  isOpen: boolean;
  onClose: () => void;
  employee: Employee | null; // null if whole team
  allEmployees: Employee[];
  records: AttendanceRecord[];
  settings: OfficeSettings;
}

export const PrintableTimesheetModal: React.FC<PrintableTimesheetModalProps> = ({
  isOpen,
  onClose,
  employee,
  allEmployees,
  records,
  settings,
}) => {
  if (!isOpen) return null;

  const empMap = new Map(allEmployees.map((e) => [e.id, e]));

  // Sort chronological for official timesheets
  const sortedRecords = [...records].sort((a, b) => a.date.localeCompare(b.date));

  // Compute totals
  let totalWorkedMins = 0;
  let totalRegularMins = 0;
  let totalOvertimeMins = 0;
  let totalBreakMins = 0;
  let lateDays = 0;

  sortedRecords.forEach((r) => {
    totalWorkedMins += r.totalWorkedMinutes || 0;
    totalRegularMins += r.regularMinutes || 0;
    totalOvertimeMins += r.overtimeMinutes || 0;
    totalBreakMins += calculateBreaksDuration(r.breaks);
    if (r.status === 'late') lateDays++;
  });

  const handlePrint = () => {
    window.print();
  };

  const startDate = sortedRecords[0]?.date || 'N/A';
  const endDate = sortedRecords[sortedRecords.length - 1]?.date || 'N/A';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-xs overflow-y-auto">
      <div className="w-full max-w-4xl bg-white text-slate-900 rounded-xl shadow-2xl overflow-hidden my-6 border border-slate-200">
        {/* Top Control Bar (Hidden during print) */}
        <div className="no-print bg-slate-100 px-6 py-3 border-b border-slate-200 flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-700">
            Official Timesheet Print Preview (A4 / Letter Format)
          </span>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-xs cursor-pointer transition-colors"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print / Save as PDF</span>
            </button>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Printable Document Container */}
        <div className="print-container p-8 sm:p-12 space-y-6 bg-white font-sans text-xs">
          {/* Company Letterhead Header */}
          <div className="border-b-2 border-slate-900 pb-4 flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 uppercase">
                {settings.companyName}
              </h1>
              <p className="text-slate-600 mt-1">{settings.companyAddress}</p>
              <p className="text-slate-500 text-[11px]">
                Phone: {settings.companyPhone} · Email: {settings.companyEmail}
              </p>
            </div>

            <div className="text-right">
              <span className="inline-block px-3 py-1 bg-slate-900 text-white font-mono font-bold text-xs uppercase tracking-wider rounded">
                Official Timesheet
              </span>
              <p className="text-slate-500 text-[11px] mt-1.5 font-mono">
                Generated: {new Date().toLocaleDateString()}
              </p>
            </div>
          </div>

          {/* Employee & Period Details */}
          <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded border border-slate-200">
            <div>
              <p className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                {employee ? 'Employee Information' : 'Department Timesheet Scope'}
              </p>
              {employee ? (
                <div className="mt-1 space-y-0.5">
                  <p className="text-sm font-bold text-slate-900">{employee.name}</p>
                  <p className="text-slate-600">
                    ID: <strong className="font-mono">{employee.employeeCode}</strong> · {employee.designation}
                  </p>
                  <p className="text-slate-600">Department: {employee.department}</p>
                </div>
              ) : (
                <div className="mt-1 space-y-0.5">
                  <p className="text-sm font-bold text-slate-900">All Office Personnel</p>
                  <p className="text-slate-600">Scope: Company-wide verified logs</p>
                </div>
              )}
            </div>

            <div className="text-right">
              <p className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                Timesheet Pay Period
              </p>
              <p className="text-sm font-bold text-slate-900 font-mono mt-1">
                {startDate} to {endDate}
              </p>
              <p className="text-slate-500 text-[11px]">
                Total Days Logged: {sortedRecords.length} days
              </p>
            </div>
          </div>

          {/* Aggregate Hours Summary Box */}
          <div className="grid grid-cols-4 gap-3 border border-slate-300 rounded p-3 text-center bg-white">
            <div>
              <span className="text-[10px] text-slate-500 uppercase font-semibold">
                Total Regular Hours
              </span>
              <p className="text-base font-bold font-mono text-slate-900 mt-0.5">
                {formatMinutesToHoursMinutes(totalRegularMins)}
              </p>
            </div>

            <div>
              <span className="text-[10px] text-slate-500 uppercase font-semibold">
                Total Overtime
              </span>
              <p className="text-base font-bold font-mono text-slate-900 mt-0.5">
                {formatMinutesToHoursMinutes(totalOvertimeMins)}
              </p>
            </div>

            <div>
              <span className="text-[10px] text-slate-500 uppercase font-semibold">
                Total Net Hours
              </span>
              <p className="text-base font-bold font-mono text-blue-900 mt-0.5">
                {formatMinutesToHoursMinutes(totalWorkedMins)}
              </p>
            </div>

            <div>
              <span className="text-[10px] text-slate-500 uppercase font-semibold">
                Punctuality / Late
              </span>
              <p className="text-base font-bold font-mono text-slate-900 mt-0.5">
                {lateDays} Late Days
              </p>
            </div>
          </div>

          {/* Records Table */}
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b-2 border-slate-900 bg-slate-100 text-[11px] font-bold text-slate-800">
                <th className="py-2 px-2">Date</th>
                <th className="py-2 px-2">Day</th>
                {!employee && <th className="py-2 px-2">Staff Name</th>}
                <th className="py-2 px-2">Time In</th>
                <th className="py-2 px-2">Time Out</th>
                <th className="py-2 px-2 text-right">Break</th>
                <th className="py-2 px-2 text-right">Regular</th>
                <th className="py-2 px-2 text-right">Overtime</th>
                <th className="py-2 px-2 text-right">Total</th>
                <th className="py-2 px-2 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {sortedRecords.map((r) => {
                const emp = empMap.get(r.employeeId);
                const breakMins = calculateBreaksDuration(r.breaks);
                return (
                  <tr key={r.id}>
                    <td className="py-1.5 px-2 font-mono">{r.date}</td>
                    <td className="py-1.5 px-2">{r.day.slice(0, 3)}</td>
                    {!employee && <td className="py-1.5 px-2 font-medium">{emp?.name}</td>}
                    <td className="py-1.5 px-2 font-mono">{formatTime12h(r.timeIn)}</td>
                    <td className="py-1.5 px-2 font-mono">{r.timeOut ? formatTime12h(r.timeOut) : '—'}</td>
                    <td className="py-1.5 px-2 font-mono text-right">{breakMins > 0 ? `${breakMins}m` : '0m'}</td>
                    <td className="py-1.5 px-2 font-mono text-right">{formatMinutesToDecimal(r.regularMinutes)}</td>
                    <td className="py-1.5 px-2 font-mono text-right">{formatMinutesToDecimal(r.overtimeMinutes)}</td>
                    <td className="py-1.5 px-2 font-mono text-right font-bold">{formatMinutesToHoursMinutes(r.totalWorkedMinutes)}</td>
                    <td className="py-1.5 px-2 text-center text-[10px] font-semibold uppercase">{r.status}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-slate-900 font-bold bg-slate-50">
                <td colSpan={employee ? 5 : 6} className="py-2 px-2 text-right uppercase text-[11px]">
                  Totals:
                </td>
                <td className="py-2 px-2 font-mono text-right">{formatMinutesToDecimal(totalRegularMins)}h</td>
                <td className="py-2 px-2 font-mono text-right">{formatMinutesToDecimal(totalOvertimeMins)}h</td>
                <td className="py-2 px-2 font-mono text-right font-bold text-slate-950">
                  {formatMinutesToHoursMinutes(totalWorkedMins)}
                </td>
                <td></td>
              </tr>
            </tfoot>
          </table>

          {/* Signatures Section for Official Payroll Timesheets */}
          <div className="pt-12 grid grid-cols-2 gap-12 text-slate-700">
            <div className="border-t border-slate-400 pt-2 text-center">
              <p className="font-semibold text-slate-900">
                {employee ? employee.name : 'Employee Signature'}
              </p>
              <p className="text-[11px] text-slate-500">Employee Signature & Date</p>
            </div>

            <div className="border-t border-slate-400 pt-2 text-center">
              <p className="font-semibold text-slate-900">Office Administrator / HR Approver</p>
              <p className="text-[11px] text-slate-500">Authorized Signature & Date</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
