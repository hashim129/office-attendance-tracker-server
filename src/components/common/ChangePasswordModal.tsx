import React, { useState } from 'react';
import { KeyRound, Eye, EyeOff, ShieldCheck, AlertCircle } from 'lucide-react';
import { Employee } from '../../types';
import { Modal } from './Modal';

interface ChangePasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: Employee;
  onUpdatePin: (employeeId: string, newPin: string) => void;
}

export const ChangePasswordModal: React.FC<ChangePasswordModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onUpdatePin,
}) => {
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (currentPin.trim() !== currentUser.pin) {
      setError('Current password / PIN does not match your account.');
      return;
    }

    const trimmedNew = newPin.trim();
    if (trimmedNew.length < 4) {
      setError('New password / PIN must be at least 4 characters or digits.');
      return;
    }

    if (trimmedNew === currentUser.pin) {
      setError('New password / PIN must be different from your current one.');
      return;
    }

    if (trimmedNew !== confirmPin.trim()) {
      setError('New password and confirmation do not match.');
      return;
    }

    onUpdatePin(currentUser.id, trimmedNew);
    setSuccess(true);
    setTimeout(() => {
      setSuccess(false);
      setCurrentPin('');
      setNewPin('');
      setConfirmPin('');
      onClose();
    }, 1500);
  };

  const handleClose = () => {
    setError(null);
    setSuccess(false);
    setCurrentPin('');
    setNewPin('');
    setConfirmPin('');
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Change Portal Password / PIN"
      subtitle={`Account: ${currentUser.name} (${currentUser.employeeCode})`}
    >
      {success ? (
        <div className="py-8 text-center space-y-3">
          <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 mx-auto flex items-center justify-center">
            <ShieldCheck className="w-7 h-7" />
          </div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
            Password Changed Successfully!
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Your new PIN/password is now active. Please use it for all future portal logins and punches.
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 flex items-center gap-2 text-xs text-rose-800 dark:text-rose-200">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Current Password / PIN
            </label>
            <div className="relative">
              <input
                type={showCurrent ? 'text' : 'password'}
                value={currentPin}
                onChange={(e) => setCurrentPin(e.target.value)}
                required
                placeholder="Enter current PIN"
                className="w-full text-xs px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 pr-9 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
              />
              <button
                type="button"
                onClick={() => setShowCurrent(!showCurrent)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              New Password / PIN
            </label>
            <div className="relative">
              <input
                type={showNew ? 'text' : 'password'}
                value={newPin}
                onChange={(e) => setNewPin(e.target.value)}
                required
                minLength={4}
                placeholder="Enter at least 4 digits or characters"
                className="w-full text-xs px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 pr-9 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
              />
              <button
                type="button"
                onClick={() => setShowNew(!showNew)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-[10px] text-slate-500 mt-1">
              Must be at least 4 characters or digits. (e.g. 1234 or a strong PIN).
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Confirm New Password / PIN
            </label>
            <input
              type="password"
              value={confirmPin}
              onChange={(e) => setConfirmPin(e.target.value)}
              required
              minLength={4}
              placeholder="Confirm new PIN"
              className="w-full text-xs px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-xs cursor-pointer"
            >
              <KeyRound className="w-3.5 h-3.5" />
              <span>Update Password / PIN</span>
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
};
