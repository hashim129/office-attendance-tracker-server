import React, { useState } from 'react';
import { Smartphone, Send, AlertTriangle, ShieldCheck } from 'lucide-react';
import { Employee } from '../../types';
import { getDeviceDetails } from '../../lib/deviceSecurity';
import { Modal } from './Modal';

interface RequestDeviceChangeModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: Employee;
  onRequestDeviceChange: (
    employeeId: string,
    requestedDeviceId: string,
    requestedDeviceName: string,
    reason?: string
  ) => void;
}

export const RequestDeviceChangeModal: React.FC<RequestDeviceChangeModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onRequestDeviceChange,
}) => {
  const [reason, setReason] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const currentDevice = getDeviceDetails();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onRequestDeviceChange(
      currentUser.id,
      currentDevice.deviceId,
      currentDevice.deviceLabel,
      reason.trim() || 'Employee phone binding / change request'
    );
    setSubmitted(true);
    setTimeout(() => {
      setSubmitted(false);
      setReason('');
      onClose();
    }, 1800);
  };

  const isAlreadyBoundToThis = currentUser.registeredDeviceId === currentDevice.deviceId;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Request Phone / Device Approval"
      subtitle={`Employee: ${currentUser.name} (${currentUser.employeeCode})`}
    >
      {submitted ? (
        <div className="py-8 text-center space-y-3">
          <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 mx-auto flex items-center justify-center">
            <ShieldCheck className="w-7 h-7" />
          </div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
            Request Sent to Administrator!
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Your request to bind this phone has been submitted. The Administrator will review and approve your device in the Admin Panel.
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="p-3.5 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 space-y-2">
            <div className="flex items-center gap-2 text-xs font-bold text-blue-900 dark:text-blue-200">
              <Smartphone className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <span>Current Device Details (Auto-Detected)</span>
            </div>
            <div className="text-xs text-slate-700 dark:text-slate-300 space-y-1">
              <p>
                <strong>Device:</strong> {currentDevice.deviceLabel}
              </p>
              <p className="font-mono text-[11px] text-slate-500 truncate">
                <strong>Device ID:</strong> {currentDevice.deviceId}
              </p>
              {currentUser.registeredDeviceName && (
                <p className="pt-1 text-slate-600 dark:text-slate-400 border-t border-blue-200/60 dark:border-blue-900/40">
                  <strong>Currently Registered Phone:</strong> {currentUser.registeredDeviceName}
                </p>
              )}
            </div>
          </div>

          {isAlreadyBoundToThis && (
            <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 text-xs text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>This device is already approved and registered to your account!</span>
            </div>
          )}

          {currentUser.pendingDeviceRequest && currentUser.pendingDeviceRequest.status === 'pending' && (
            <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 text-xs text-amber-800 dark:text-amber-300 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Pending Approval Already Submitted:</p>
                <p className="mt-0.5">
                  Requested: <strong>{currentUser.pendingDeviceRequest.requestedDeviceName}</strong> on{' '}
                  {new Date(currentUser.pendingDeviceRequest.requestedAt).toLocaleDateString()}.
                  Waiting for Administrator to approve.
                </p>
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Reason for Phone Binding / Change Request
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Changed my phone to a new Samsung Galaxy / Old device screen damaged / First time registration"
              rows={3}
              required
              className="w-full text-xs px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-[10px] text-slate-500 mt-1">
              The Administrator will see this reason in the Admin Panel before approving your device.
            </p>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-xs cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Submit Request to Admin</span>
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
};
