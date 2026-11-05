import React, { useState } from 'react';
import {
  CalendarDays,
  Plus,
  CheckCircle2,
  XCircle,
  Clock,
  Filter,
  FileText,
  AlertCircle,
} from 'lucide-react';
import { Employee, LeaveRequest, LeaveStatus, LeaveType } from '../../types';
import { Modal } from '../common/Modal';

interface LeaveManagementTabProps {
  currentUser: Employee;
  employees: Employee[];
  leaves: LeaveRequest[];
  onApplyLeave: (leave: Omit<LeaveRequest, 'id' | 'appliedAt' | 'status'>) => void;
  onReviewLeave: (leaveId: string, status: 'approved' | 'rejected', reviewNote?: string) => void;
}

export const LeaveManagementTab: React.FC<LeaveManagementTabProps> = ({
  currentUser,
  employees,
  leaves,
  onApplyLeave,
  onReviewLeave,
}) => {
  const isAdmin = currentUser.role === 'admin';
  const [isApplyModalOpen, setIsApplyModalOpen] = useState<boolean>(false);
  const [reviewingLeave, setReviewingLeave] = useState<LeaveRequest | null>(null);
  const [reviewDecision, setReviewDecision] = useState<'approved' | 'rejected'>('approved');
  const [reviewNote, setReviewNote] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const [formData, setFormData] = useState({
    leaveType: 'annual' as LeaveType,
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
    totalDays: 1,
    reason: '',
  });

  const empMap = new Map(employees.map((e) => [e.id, e]));

  // Employees only see their own leaves; admins see all leaves
  const visibleLeaves = leaves.filter((l) => {
    if (!isAdmin && l.employeeId !== currentUser.id) return false;
    if (statusFilter !== 'all' && l.status !== statusFilter) return false;
    return true;
  }).sort((a, b) => b.appliedAt.localeCompare(a.appliedAt));

  const handleApplySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.reason.trim()) return;

    // Calculate total days
    const start = new Date(formData.startDate);
    const end = new Date(formData.endDate);
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

    onApplyLeave({
      employeeId: currentUser.id,
      leaveType: formData.leaveType,
      startDate: formData.startDate,
      endDate: formData.endDate,
      totalDays: Math.max(1, diffDays),
      reason: formData.reason.trim(),
    });

    setIsApplyModalOpen(false);
    setFormData({
      leaveType: 'annual',
      startDate: new Date().toISOString().split('T')[0],
      endDate: new Date().toISOString().split('T')[0],
      totalDays: 1,
      reason: '',
    });
  };

  const handleReviewSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reviewingLeave) return;

    onReviewLeave(reviewingLeave.id, reviewDecision, reviewNote.trim() || undefined);
    setReviewingLeave(null);
    setReviewNote('');
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <CalendarDays className="w-5 h-5 text-blue-600" />
            <span>Leave & Vacation Management</span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {isAdmin
              ? 'Review, approve or reject staff time-off and vacation requests'
              : 'Submit time-off requests and track approval statuses'}
          </p>
        </div>

        <button
          onClick={() => setIsApplyModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition-colors cursor-pointer self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Apply for Leave</span>
        </button>
      </div>

      {/* Filter Bar */}
      <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Filter className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-xs text-slate-500">Filter Status:</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-slate-100"
          >
            <option value="all">All Requests</option>
            <option value="pending">Pending Approval</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>

        <span className="text-xs text-slate-400">
          Showing {visibleLeaves.length} record{visibleLeaves.length === 1 ? '' : 's'}
        </span>
      </div>

      {/* Requests List */}
      <div className="space-y-3">
        {visibleLeaves.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 rounded-xl p-12 text-center border border-slate-200 dark:border-slate-800">
            <p className="text-sm font-medium text-slate-500">No leave requests found.</p>
            <p className="text-xs text-slate-400 mt-1">
              Click "Apply for Leave" to submit a new time-off application.
            </p>
          </div>
        ) : (
          visibleLeaves.map((leave) => {
            const emp = empMap.get(leave.employeeId);
            return (
              <div
                key={leave.id}
                className="bg-white dark:bg-slate-900 rounded-xl p-5 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
              >
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2.5">
                    <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                      {emp ? emp.name : 'Unknown Staff'}
                    </span>
                    <span className="text-xs text-slate-400 font-mono">
                      ({emp?.employeeCode})
                    </span>
                    <span className="text-slate-300 dark:text-slate-700">·</span>
                    <span className="text-xs font-semibold capitalize text-blue-600 dark:text-blue-400">
                      {leave.leaveType.replace('_', ' ')} Leave
                    </span>
                  </div>

                  <p className="text-xs text-slate-600 dark:text-slate-300">
                    <strong className="font-semibold text-slate-800 dark:text-slate-200">
                      {leave.startDate} to {leave.endDate}
                    </strong>{' '}
                    ({leave.totalDays} day{leave.totalDays === 1 ? '' : 's'})
                  </p>

                  <p className="text-xs text-slate-500 italic">"{leave.reason}"</p>

                  {leave.reviewNote && (
                    <p className="text-[11px] text-slate-500 pt-1">
                      <strong className="text-slate-700 dark:text-slate-300">Admin Note:</strong>{' '}
                      {leave.reviewNote}
                    </p>
                  )}
                </div>

                {/* Status Badge & Admin Action */}
                <div className="flex items-center gap-3 self-end md:self-auto">
                  {leave.status === 'pending' ? (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                      <Clock className="w-3.5 h-3.5" />
                      <span>Pending Review</span>
                    </span>
                  ) : leave.status === 'approved' ? (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Approved</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300">
                      <XCircle className="w-3.5 h-3.5" />
                      <span>Rejected</span>
                    </span>
                  )}

                  {isAdmin && leave.status === 'pending' && (
                    <button
                      onClick={() => {
                        setReviewingLeave(leave);
                        setReviewDecision('approved');
                        setReviewNote('');
                      }}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition-colors cursor-pointer"
                    >
                      Review
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Apply Leave Modal */}
      {isApplyModalOpen && (
        <Modal
          isOpen={isApplyModalOpen}
          onClose={() => setIsApplyModalOpen(false)}
          title="Apply for Time-Off / Leave"
          subtitle="Submit formal leave dates to office administration"
        >
          <form onSubmit={handleApplySubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Leave Category
              </label>
              <select
                value={formData.leaveType}
                onChange={(e) => setFormData({ ...formData, leaveType: e.target.value as LeaveType })}
                className="w-full text-xs px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
              >
                <option value="annual">Annual / Vacation Leave</option>
                <option value="sick">Sick Leave (Medical)</option>
                <option value="casual">Casual Leave</option>
                <option value="remote_work">Work From Home / Remote</option>
                <option value="unpaid">Unpaid Leave</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Start Date
                </label>
                <input
                  type="date"
                  value={formData.startDate}
                  onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                  required
                  className="w-full text-xs px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  End Date
                </label>
                <input
                  type="date"
                  value={formData.endDate}
                  onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                  required
                  className="w-full text-xs px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Reason / Detailed Description
              </label>
              <textarea
                value={formData.reason}
                onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                placeholder="State the reason for taking leave..."
                rows={3}
                required
                className="w-full text-xs px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
              />
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setIsApplyModalOpen(false)}
                className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-900"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-xs"
              >
                Submit Application
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Review Modal for Admin */}
      {reviewingLeave && (
        <Modal
          isOpen={!!reviewingLeave}
          onClose={() => setReviewingLeave(null)}
          title="Review Leave Application"
          subtitle={`Employee: ${empMap.get(reviewingLeave.employeeId)?.name}`}
        >
          <form onSubmit={handleReviewSubmit} className="space-y-4">
            <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg text-xs space-y-1">
              <p>
                <strong>Dates:</strong> {reviewingLeave.startDate} to {reviewingLeave.endDate} ({reviewingLeave.totalDays} days)
              </p>
              <p>
                <strong>Type:</strong> {reviewingLeave.leaveType.toUpperCase()}
              </p>
              <p>
                <strong>Reason:</strong> {reviewingLeave.reason}
              </p>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Decision
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setReviewDecision('approved')}
                  className={`py-2 px-3 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${
                    reviewDecision === 'approved'
                      ? 'bg-emerald-600 text-white border-emerald-600'
                      : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700'
                  }`}
                >
                  Approve Leave
                </button>
                <button
                  type="button"
                  onClick={() => setReviewDecision('rejected')}
                  className={`py-2 px-3 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${
                    reviewDecision === 'rejected'
                      ? 'bg-rose-600 text-white border-rose-600'
                      : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700'
                  }`}
                >
                  Reject Request
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Review Remarks / Note to Employee
              </label>
              <textarea
                value={reviewNote}
                onChange={(e) => setReviewNote(e.target.value)}
                placeholder="e.g. Approved. Project tasks handed over to Robert."
                rows={2}
                className="w-full text-xs px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
              />
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setReviewingLeave(null)}
                className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-900"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-xs"
              >
                Confirm Decision
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
