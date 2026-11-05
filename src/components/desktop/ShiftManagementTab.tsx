import React, { useState } from 'react';
import { CalendarRange, Plus, Edit2, Clock, Check, AlertCircle } from 'lucide-react';
import { ShiftSchedule } from '../../types';
import { formatTime12h } from '../../lib/attendanceCalculations';
import { Modal } from '../common/Modal';

interface ShiftManagementTabProps {
  shifts: ShiftSchedule[];
  onAddShift: (shift: Omit<ShiftSchedule, 'id'>) => void;
  onUpdateShift: (shift: ShiftSchedule) => void;
}

const WEEKDAYS = [
  { val: 1, label: 'Mon' },
  { val: 2, label: 'Tue' },
  { val: 3, label: 'Wed' },
  { val: 4, label: 'Thu' },
  { val: 5, label: 'Fri' },
  { val: 6, label: 'Sat' },
  { val: 0, label: 'Sun' },
];

export const ShiftManagementTab: React.FC<ShiftManagementTabProps> = ({
  shifts,
  onAddShift,
  onUpdateShift,
}) => {
  const [isAddOpen, setIsAddOpen] = useState<boolean>(false);
  const [editingShift, setEditingShift] = useState<ShiftSchedule | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    startTime: '09:00',
    endTime: '17:00',
    graceMinutes: 15,
    expectedHours: 8,
    workDays: [1, 2, 3, 4, 5],
    color: 'blue',
  });

  const handleOpenAdd = () => {
    setFormData({
      name: '',
      startTime: '09:00',
      endTime: '17:00',
      graceMinutes: 15,
      expectedHours: 8,
      workDays: [1, 2, 3, 4, 5],
      color: 'blue',
    });
    setIsAddOpen(true);
  };

  const handleOpenEdit = (shift: ShiftSchedule) => {
    setEditingShift(shift);
    setFormData({
      name: shift.name,
      startTime: shift.startTime,
      endTime: shift.endTime,
      graceMinutes: shift.graceMinutes,
      expectedHours: shift.expectedHours,
      workDays: shift.workDays,
      color: shift.color || 'blue',
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingShift) {
      onUpdateShift({
        ...editingShift,
        ...formData,
      });
      setEditingShift(null);
    } else {
      onAddShift(formData);
      setIsAddOpen(false);
    }
  };

  const toggleWorkDay = (dayNum: number) => {
    if (formData.workDays.includes(dayNum)) {
      if (formData.workDays.length > 1) {
        setFormData({
          ...formData,
          workDays: formData.workDays.filter((d) => d !== dayNum),
        });
      }
    } else {
      setFormData({
        ...formData,
        workDays: [...formData.workDays, dayNum].sort(),
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <CalendarRange className="w-5 h-5 text-blue-600" />
            <span>Shift Schedules & Attendance Rules</span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Define daily operating hours, grace periods, and late-arrival thresholds
          </p>
        </div>

        <button
          onClick={handleOpenAdd}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition-colors cursor-pointer self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Create Shift Schedule</span>
        </button>
      </div>

      {/* Shifts Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {shifts.map((shift) => (
          <div
            key={shift.id}
            className="bg-white dark:bg-slate-900 rounded-xl p-5 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-between"
          >
            <div>
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    {shift.name}
                  </h3>
                  <p className="text-xs text-blue-600 dark:text-blue-400 font-mono font-medium mt-1">
                    {formatTime12h(shift.startTime)} – {formatTime12h(shift.endTime)}
                  </p>
                </div>
                <button
                  onClick={() => handleOpenEdit(shift)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="mt-4 space-y-2 text-xs text-slate-600 dark:text-slate-300">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Expected Work:</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    {shift.expectedHours} Hours / day
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Late Grace Window:</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    +{shift.graceMinutes} minutes
                  </span>
                </div>

                <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                  <span className="text-[11px] text-slate-500 block mb-1.5">Active Working Days:</span>
                  <div className="flex items-center gap-1">
                    {WEEKDAYS.map((day) => {
                      const isActive = shift.workDays.includes(day.val);
                      return (
                        <span
                          key={day.val}
                          className={`w-6 h-6 rounded flex items-center justify-center text-[10px] font-bold ${
                            isActive
                              ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300'
                              : 'bg-slate-100 text-slate-400 dark:bg-slate-800/60'
                          }`}
                        >
                          {day.label[0]}
                        </span>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-500">
              <span>Automatic Overtime Tracking</span>
              <span className="text-emerald-600 dark:text-emerald-400 font-medium">Enabled</span>
            </div>
          </div>
        ))}
      </div>

      {/* Add / Edit Modal */}
      {(isAddOpen || editingShift) && (
        <Modal
          isOpen={isAddOpen || !!editingShift}
          onClose={() => {
            setIsAddOpen(false);
            setEditingShift(null);
          }}
          title={editingShift ? `Edit Shift: ${editingShift.name}` : 'Create Shift Schedule'}
          subtitle="Configure shift start/end times and punctuality grace policies"
        >
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Shift Name
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g. Standard Morning Shift"
                required
                className="w-full text-xs px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Start Time (HH:mm)
                </label>
                <input
                  type="time"
                  value={formData.startTime}
                  onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                  required
                  className="w-full text-xs font-mono px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  End Time (HH:mm)
                </label>
                <input
                  type="time"
                  value={formData.endTime}
                  onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                  required
                  className="w-full text-xs font-mono px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Grace Period (Minutes)
                </label>
                <input
                  type="number"
                  min="0"
                  max="60"
                  value={formData.graceMinutes}
                  onChange={(e) => setFormData({ ...formData, graceMinutes: parseInt(e.target.value, 10) || 0 })}
                  className="w-full text-xs font-mono px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Expected Work Hours
                </label>
                <input
                  type="number"
                  min="1"
                  max="14"
                  value={formData.expectedHours}
                  onChange={(e) => setFormData({ ...formData, expectedHours: parseInt(e.target.value, 10) || 8 })}
                  className="w-full text-xs font-mono px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Working Days
              </label>
              <div className="flex items-center gap-2">
                {WEEKDAYS.map((day) => {
                  const isSelected = formData.workDays.includes(day.val);
                  return (
                    <button
                      key={day.val}
                      type="button"
                      onClick={() => toggleWorkDay(day.val)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                        isSelected
                          ? 'bg-blue-600 text-white shadow-2xs'
                          : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                      }`}
                    >
                      {day.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => {
                  setIsAddOpen(false);
                  setEditingShift(null);
                }}
                className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-900"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-xs"
              >
                {editingShift ? 'Save Changes' : 'Create Shift'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
