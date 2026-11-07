import React, { useState } from 'react';
import {
  Users,
  UserPlus,
  Edit2,
  Trash2,
  Search,
  KeyRound,
  Shield,
  Phone,
  Mail,
  Building,
  Smartphone,
  RotateCcw,
} from 'lucide-react';
import { Employee, Role, ShiftSchedule } from '../../types';
import { Modal } from '../common/Modal';

interface EmployeesDirectoryTabProps {
  employees: Employee[];
  shifts: ShiftSchedule[];
  onAddEmployee: (emp: Omit<Employee, 'id'>) => void;
  onUpdateEmployee: (emp: Employee) => void;
  onDeleteEmployee: (empId: string) => void;
  currentUserId: string;
}

export const EmployeesDirectoryTab: React.FC<EmployeesDirectoryTabProps> = ({
  employees,
  shifts,
  onAddEmployee,
  onUpdateEmployee,
  onDeleteEmployee,
  currentUserId,
}) => {
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedDept, setSelectedDept] = useState<string>('all');
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [editingEmp, setEditingEmp] = useState<Employee | null>(null);
  const [deletingEmp, setDeletingEmp] = useState<Employee | null>(null);

  const firstActiveShift = shifts.find((s) => s.isActive !== false) || shifts[0];

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    employeeCode: '',
    email: '',
    role: 'employee' as Role,
    pin: '',
    department: 'Engineering',
    designation: '',
    shiftId: firstActiveShift?.id || '',
    phone: '',
    hourlyRate: 35,
    isActive: true,
  });

  const departments = Array.from(new Set(employees.map((e) => e.department))).sort();
  const shiftMap = new Map(shifts.map((s) => [s.id, s]));

  const filteredEmployees = employees.filter((emp) => {
    if (selectedDept !== 'all' && emp.department !== selectedDept) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matchName = emp.name.toLowerCase().includes(q);
      const matchCode = emp.employeeCode.toLowerCase().includes(q);
      const matchEmail = emp.email.toLowerCase().includes(q);
      const matchDesignation = emp.designation.toLowerCase().includes(q);
      if (!matchName && !matchCode && !matchEmail && !matchDesignation) return false;
    }
    return true;
  });

  const handleResetDevice = (emp: Employee) => {
    if (
      confirm(
        `Reset device pairing for "${emp.name}"?\n\nTheir current personal device binding will be removed. The employee will be able to bind a new device on their next punch.`
      )
    ) {
      onUpdateEmployee({
        ...emp,
        registeredDeviceId: undefined,
        registeredDeviceName: undefined,
        registeredAt: undefined,
      });
    }
  };

  const handleOpenAddModal = () => {
    // Generate next employee code
    const nextCodeNum = employees.length + 101;
    setFormData({
      name: '',
      employeeCode: `EMP-${nextCodeNum}`,
      email: '',
      role: 'employee',
      pin: Math.floor(1000 + Math.random() * 9000).toString(),
      department: 'Engineering',
      designation: '',
      shiftId: firstActiveShift?.id || '',
      phone: '+1 (555) 000-0000',
      hourlyRate: 38,
      isActive: true,
    });
    setIsAddModalOpen(true);
  };

  const handleOpenEditModal = (emp: Employee) => {
    setEditingEmp(emp);
    setFormData({
      name: emp.name,
      employeeCode: emp.employeeCode,
      email: emp.email,
      role: emp.role,
      pin: emp.pin,
      department: emp.department,
      designation: emp.designation,
      shiftId: emp.shiftId,
      phone: emp.phone,
      hourlyRate: emp.hourlyRate,
      isActive: emp.isActive,
    });
  };

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.email.trim()) return;

    onAddEmployee({
      ...formData,
      joinedDate: new Date().toISOString().split('T')[0],
    });
    setIsAddModalOpen(false);
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEmp) return;

    onUpdateEmployee({
      ...editingEmp,
      ...formData,
    });
    setEditingEmp(null);
  };

  const handleConfirmDelete = () => {
    if (!deletingEmp) return;
    if (deletingEmp.id === currentUserId) {
      alert('You cannot delete your own active administrator account.');
      return;
    }
    onDeleteEmployee(deletingEmp.id);
    setDeletingEmp(null);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-600" />
            <span>Staff Directory & Employees</span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Manage company personnel, shifts, roles, security PINs, and access permissions
          </p>
        </div>

        <button
          onClick={handleOpenAddModal}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition-colors cursor-pointer self-start sm:self-auto"
        >
          <UserPlus className="w-4 h-4" />
          <span>Add New Employee</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="relative min-w-[260px]">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name, code, email, designation..."
            className="w-full pl-9 pr-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-slate-100 focus:outline-none"
          />
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">Department:</span>
          <select
            value={selectedDept}
            onChange={(e) => setSelectedDept(e.target.value)}
            className="px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-slate-100"
          >
            <option value="all">All Departments ({employees.length})</option>
            {departments.map((dept) => (
              <option key={dept} value={dept}>
                {dept}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Employees Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filteredEmployees.map((emp) => {
          const shift = shiftMap.get(emp.shiftId) || shifts[0];
          return (
            <div
              key={emp.id}
              className="bg-white dark:bg-slate-900 rounded-xl p-5 border border-slate-200 dark:border-slate-800 shadow-xs hover:border-slate-300 dark:hover:border-slate-700 transition-all flex flex-col justify-between"
            >
              <div>
                {/* Header: Name, Code & Role */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 flex items-center justify-center font-bold text-sm">
                      {emp.name.charAt(0)}
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                        {emp.name}
                      </h3>
                      <p className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                        {emp.employeeCode}
                      </p>
                    </div>
                  </div>

                  <span
                    className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${
                      emp.role === 'admin'
                        ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300'
                        : emp.role === 'ceo'
                        ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200 border border-amber-300 dark:border-amber-700 font-black'
                        : emp.role === 'accounts'
                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300'
                        : 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300'
                    }`}
                  >
                    {emp.role === 'ceo' ? 'CEO' : emp.role === 'accounts' ? 'Accounts' : emp.role}
                  </span>
                </div>

                {/* Details */}
                <div className="mt-4 space-y-1.5 text-xs text-slate-600 dark:text-slate-300">
                  <div className="flex items-center gap-2">
                    <Building className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="font-medium text-slate-800 dark:text-slate-200 truncate">
                      {emp.designation} ({emp.department})
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="truncate text-slate-500">{emp.email}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="text-slate-500">{emp.phone}</span>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800 text-[11px]">
                    <span className="text-slate-500">Shift:</span>
                    <span className="font-medium text-slate-700 dark:text-slate-300">
                      {shift?.name || 'Standard'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-500">Kiosk PIN:</span>
                    <span className="font-mono font-bold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                      {emp.pin}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-[11px] pt-1">
                    <span className="text-slate-500">Bound Device:</span>
                    {emp.registeredDeviceId ? (
                      <span
                        className="inline-flex items-center gap-1 text-[10px] font-semibold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/50 px-1.5 py-0.5 rounded border border-blue-200 dark:border-blue-900/50 max-w-[140px] truncate"
                        title={`${emp.registeredDeviceName || emp.registeredDeviceId} (Paired on ${emp.registeredAt ? new Date(emp.registeredAt).toLocaleDateString() : 'N/A'})`}
                      >
                        <Smartphone className="w-3 h-3 shrink-0 text-blue-600 dark:text-blue-400" />
                        <span className="truncate">{emp.registeredDeviceName?.split('·')[0] || 'Personal Device'}</span>
                      </span>
                    ) : (
                      <span className="text-[10px] text-slate-400 italic">No Device (Auto-Pairs)</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="mt-5 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2">
                {emp.registeredDeviceId && (
                  <button
                    onClick={() => handleResetDevice(emp)}
                    className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium text-amber-600 hover:text-amber-700 hover:bg-amber-50 dark:text-amber-400 dark:hover:bg-amber-950/40 transition-colors cursor-pointer"
                    title="Reset device pairing so employee can bind a new phone"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Reset Device</span>
                  </button>
                )}

                <button
                  onClick={() => handleOpenEditModal(emp)}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium text-slate-600 hover:text-blue-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-blue-400 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                  <span>Edit</span>
                </button>

                <button
                  onClick={() => setDeletingEmp(emp)}
                  disabled={emp.id === currentUserId}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                    emp.id === currentUserId
                      ? 'text-slate-300 dark:text-slate-700 cursor-not-allowed'
                      : 'text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer'
                  }`}
                  title={emp.id === currentUserId ? 'Cannot delete logged in user' : 'Remove employee'}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Remove</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Add / Edit Employee Modal */}
      {(isAddModalOpen || editingEmp) && (
        <Modal
          isOpen={isAddModalOpen || !!editingEmp}
          onClose={() => {
            setIsAddModalOpen(false);
            setEditingEmp(null);
          }}
          title={editingEmp ? `Edit Staff Member: ${editingEmp.name}` : 'Add New Employee'}
          subtitle="Configure employee credentials, security PIN, and assigned office shift"
          maxWidth="lg"
        >
          <form onSubmit={editingEmp ? handleEditSubmit : handleAddSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. Alex Henderson"
                  required
                  className="w-full text-xs px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Employee ID Code
                </label>
                <input
                  type="text"
                  value={formData.employeeCode}
                  onChange={(e) => setFormData({ ...formData, employeeCode: e.target.value })}
                  placeholder="EMP-109"
                  required
                  className="w-full text-xs font-mono px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Work Email
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="name@office.local"
                  required
                  className="w-full text-xs px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Kiosk Security PIN (4 Digits)
                </label>
                <input
                  type="text"
                  value={formData.pin}
                  onChange={(e) => setFormData({ ...formData, pin: e.target.value })}
                  placeholder="1234"
                  maxLength={6}
                  required
                  className="w-full text-xs font-mono tracking-widest px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Department
                </label>
                <input
                  type="text"
                  value={formData.department}
                  onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                  placeholder="Engineering"
                  required
                  className="w-full text-xs px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Designation / Role Title
                </label>
                <input
                  type="text"
                  value={formData.designation}
                  onChange={(e) => setFormData({ ...formData, designation: e.target.value })}
                  placeholder="Senior Software Engineer"
                  required
                  className="w-full text-xs px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  System Permission Role
                </label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value as Role })}
                  className="w-full text-xs px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
                >
                  <option value="employee">Employee (Personal Reports & Self Punch Only)</option>
                  <option value="accounts">Accounts Officer (Audit, Timesheets & Attendance Verification)</option>
                  <option value="ceo">Chief Executive Officer (CEO - Full Overview & Direct Mentions)</option>
                  <option value="admin">Administrator (Full Office Management & Settings)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Assigned Shift
                </label>
                <select
                  value={formData.shiftId}
                  onChange={(e) => setFormData({ ...formData, shiftId: e.target.value })}
                  className="w-full text-xs px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
                >
                  {shifts.map((s) => {
                    const isDisabled = s.isActive === false;
                    return (
                      <option
                        key={s.id}
                        value={s.id}
                        disabled={isDisabled && s.id !== formData.shiftId}
                      >
                        {s.name} ({s.startTime} – {s.endTime}){isDisabled ? ' [Disabled Shift]' : ''}
                      </option>
                    );
                  })}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Contact Phone
                </label>
                <input
                  type="text"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="+1 (555) 123-4567"
                  className="w-full text-xs px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Hourly Wage Rate ($)
                </label>
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  value={formData.hourlyRate}
                  onChange={(e) => setFormData({ ...formData, hourlyRate: parseFloat(e.target.value) || 0 })}
                  className="w-full text-xs font-mono px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => {
                  setIsAddModalOpen(false);
                  setEditingEmp(null);
                }}
                className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-xs"
              >
                {editingEmp ? 'Save Employee Changes' : 'Create Staff Member'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Delete Confirmation Modal */}
      {deletingEmp && (
        <Modal
          isOpen={!!deletingEmp}
          onClose={() => setDeletingEmp(null)}
          title="Confirm Employee Removal"
          subtitle="Are you sure you want to remove this employee from the local server?"
        >
          <div className="space-y-4">
            <p className="text-xs text-slate-600 dark:text-slate-300">
              You are about to remove <strong>{deletingEmp.name}</strong> ({deletingEmp.employeeCode}). This will revoke their local login and kiosk PIN credentials.
            </p>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setDeletingEmp(null)}
                className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-900"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="px-4 py-2 text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white rounded-lg shadow-xs"
              >
                Confirm Removal
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
