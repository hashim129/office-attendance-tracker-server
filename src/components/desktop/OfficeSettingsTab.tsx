import React, { useState, useEffect } from 'react';
import {
  Settings,
  Save,
  Download,
  Upload,
  RefreshCw,
  Server,
  Building,
  ShieldAlert,
  CheckCircle2,
  Wifi,
  Plus,
  Trash2,
  Globe,
  ShieldCheck,
  Smartphone,
} from 'lucide-react';
import { OfficeSettings } from '../../types';
import {
  exportDatabaseBackup,
  importDatabaseBackup,
  resetToFactoryDefaults,
} from '../../lib/storage';
import { detectClientNetwork } from '../../lib/ipSecurity';

interface OfficeSettingsTabProps {
  settings: OfficeSettings;
  onUpdateSettings: (newSettings: OfficeSettings) => void;
  onReloadAllData: () => void;
  currentClientIp?: string;
  currentClientIsp?: string;
}

export const OfficeSettingsTab: React.FC<OfficeSettingsTabProps> = ({
  settings,
  onUpdateSettings,
  onReloadAllData,
  currentClientIp,
  currentClientIsp,
}) => {
  const [formData, setFormData] = useState<OfficeSettings>({
    ...settings,
    enforceOfficeIpLock: settings.enforceOfficeIpLock ?? false,
    allowedOfficeIps: settings.allowedOfficeIps ?? [],
    allowedOfficeIsps: settings.allowedOfficeIsps ?? [],
    allowAdminBypassIpLock: settings.allowAdminBypassIpLock ?? true,
  });
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);
  const [detectedIp, setDetectedIp] = useState<string>(currentClientIp || 'Detecting...');
  const [detectedIsp, setDetectedIsp] = useState<string>(currentClientIsp || 'Detecting...');
  const [newIpInput, setNewIpInput] = useState<string>('');
  const [newIpLabelInput, setNewIpLabelInput] = useState<string>('');

  useEffect(() => {
    setFormData({
      ...settings,
      enforceOfficeIpLock: settings.enforceOfficeIpLock ?? false,
      allowedOfficeIps: settings.allowedOfficeIps ?? [],
      allowedOfficeIsps: settings.allowedOfficeIsps ?? [],
      allowAdminBypassIpLock: settings.allowAdminBypassIpLock ?? true,
    });
  }, [settings]);

  useEffect(() => {
    if (currentClientIp && currentClientIp !== 'Detecting...') {
      setDetectedIp(currentClientIp);
      if (currentClientIsp) setDetectedIsp(currentClientIsp);
    } else {
      void detectClientNetwork().then((net) => {
        setDetectedIp(net.ip);
        setDetectedIsp(net.isp);
      });
    }
  }, [currentClientIp, currentClientIsp]);

  const getIpSubnetWildcard = (ip: string): string | null => {
    const parts = ip.trim().split('.');
    if (parts.length === 4) {
      return `${parts[0]}.${parts[1]}.${parts[2]}.*`;
    }
    return null;
  };

  const handleAddAllowedIp = (ipToAdd: string, labelToAdd: string) => {
    const cleanIp = ipToAdd.trim();
    if (!cleanIp || cleanIp === 'Detecting...' || cleanIp === 'Unknown') return;

    const currentList = formData.allowedOfficeIps || [];
    if (currentList.some((item) => item.ip.toLowerCase() === cleanIp.toLowerCase())) {
      alert(`IP / Range "${cleanIp}" is already in the Allowed Office IP list.`);
      return;
    }

    const updatedList = [
      ...currentList,
      {
        ip: cleanIp,
        label: labelToAdd.trim() || 'Office Internet Provider',
        addedAt: new Date().toISOString().split('T')[0],
      },
    ];

    const updatedSettings: OfficeSettings = {
      ...formData,
      allowedOfficeIps: updatedList,
    };
    setFormData(updatedSettings);
    onUpdateSettings(updatedSettings);
    setNewIpInput('');
    setNewIpLabelInput('');
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  const handleRemoveAllowedIp = (ipToRemove: string) => {
    const currentList = formData.allowedOfficeIps || [];
    const updatedList = currentList.filter((item) => item.ip !== ipToRemove);
    const updatedSettings: OfficeSettings = {
      ...formData,
      allowedOfficeIps: updatedList,
    };
    setFormData(updatedSettings);
    onUpdateSettings(updatedSettings);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateSettings(formData);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  const handleBackupDownload = () => {
    const jsonStr = exportDatabaseBackup();
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `attendance_db_backup_${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleBackupUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        const ok = importDatabaseBackup(content);
        if (ok) {
          alert('Database restored successfully from local backup file.');
          onReloadAllData();
        } else {
          alert('Failed to parse backup JSON file. Ensure it is a valid Attendance Tracker database backup.');
        }
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleResetDefaults = () => {
    if (
      confirm(
        'Reset all attendance records, employees, shifts, and settings to original initial sample data?'
      )
    ) {
      resetToFactoryDefaults();
      onReloadAllData();
      alert('System restored to factory default sample data.');
    }
  };

  return (
    <div className="max-w-4xl space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
          <Settings className="w-5 h-5 text-blue-600" />
          <span>Office & Local Server Configuration</span>
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
          Configure company profile, letterhead headers, overtime calculation rates, and database backup
        </p>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Company Profile Card */}
        <div className="bg-white dark:bg-slate-900 rounded-xl p-6 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
            <Building className="w-4 h-4 text-blue-600" />
            <span>Company Profile & Report Letterhead</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Company Legal Name
              </label>
              <input
                type="text"
                value={formData.companyName}
                onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                required
                className="w-full text-xs px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Headquarters Address
              </label>
              <input
                type="text"
                value={formData.companyAddress}
                onChange={(e) => setFormData({ ...formData, companyAddress: e.target.value })}
                required
                className="w-full text-xs px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Office Contact Phone
              </label>
              <input
                type="text"
                value={formData.companyPhone}
                onChange={(e) => setFormData({ ...formData, companyPhone: e.target.value })}
                className="w-full text-xs px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                HR Email Address
              </label>
              <input
                type="email"
                value={formData.companyEmail}
                onChange={(e) => setFormData({ ...formData, companyEmail: e.target.value })}
                className="w-full text-xs px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
              />
            </div>
          </div>
        </div>

        {/* Server & Calculation Rules Card */}
        <div className="bg-white dark:bg-slate-900 rounded-xl p-6 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
            <Server className="w-4 h-4 text-emerald-600" />
            <span>Local Server & Policy Rules</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Server Hostname
              </label>
              <input
                type="text"
                value={formData.serverHostName}
                onChange={(e) => setFormData({ ...formData, serverHostName: e.target.value })}
                className="w-full text-xs font-mono px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Local Port
              </label>
              <input
                type="number"
                value={formData.serverPort}
                onChange={(e) => setFormData({ ...formData, serverPort: parseInt(e.target.value, 10) || 3000 })}
                className="w-full text-xs font-mono px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Overtime Multiplier Rate
              </label>
              <input
                type="number"
                step="0.1"
                min="1.0"
                max="3.0"
                value={formData.overtimeRateMultiplier}
                onChange={(e) => setFormData({ ...formData, overtimeRateMultiplier: parseFloat(e.target.value) || 1.5 })}
                className="w-full text-xs font-mono px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
              />
              <span className="text-[10px] text-slate-400 mt-1 block">
                Standard overtime is 1.5x regular pay
              </span>
            </div>
          </div>
        </div>

        {/* Office Public IP Address Lock & Dual-ISP Extender Support Card */}
        <div className="bg-white dark:bg-slate-900 rounded-xl p-6 border-2 border-emerald-500/30 dark:border-emerald-500/20 shadow-xs space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
              <Wifi className="w-4 h-4 text-emerald-600" />
              <span>Office Multi-Wi-Fi, Extender & Dual-ISP Public IP Lock</span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] text-slate-500 dark:text-slate-400">Detected ISP:</span>
              <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                {detectedIsp}
              </span>
              <span className="text-[11px] text-slate-500 dark:text-slate-400">Public IP:</span>
              <span className="px-2.5 py-1 rounded-md text-xs font-mono font-bold bg-slate-900 text-emerald-400 border border-slate-700">
                {detectedIp}
              </span>
            </div>
          </div>

          {/* Multi-WiFi / Extender / Ethernet Explanation Banner */}
          <div className="p-3.5 rounded-xl bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200/80 dark:border-blue-900/50 text-xs text-slate-700 dark:text-slate-300 space-y-1.5">
            <div className="font-bold text-blue-900 dark:text-blue-200 flex items-center gap-1.5">
              <Globe className="w-4 h-4 text-blue-600 shrink-0" />
              <span>How Multiple Wi-Fi Extenders, Access Points & Ethernet Cables Work Automatically:</span>
            </div>
            <p className="text-[11px] leading-relaxed">
              Even if you have <strong>10 different Wi-Fi names (extenders/repeaters) or Ethernet cables</strong> across your office, they all route out to the internet through your <strong>2 main Internet Service Providers (ISPs)</strong>. That means every Wi-Fi extender and Ethernet cable in your building shares only <strong>2 Public IP Addresses</strong> (one for Provider 1, one for Provider 2)!
            </p>
            <p className="text-[11px] leading-relaxed font-medium text-emerald-700 dark:text-emerald-400">
              ✓ Setup in 2 steps: Connect to Provider 1 and click "Authorize Provider 1" below. Then switch to Provider 2 and click "Authorize Provider 2" (or enter its IP manually). All Wi-Fi extenders and Ethernet cables on both providers will automatically work!
            </p>
          </div>

          {/* Toggle Switches */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={!!formData.enforceOfficeIpLock}
                onChange={(e) => {
                  const updated = { ...formData, enforceOfficeIpLock: e.target.checked };
                  setFormData(updated);
                  onUpdateSettings(updated);
                }}
                className="mt-0.5 w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
              />
              <div>
                <div className="text-xs font-bold text-slate-900 dark:text-slate-100">
                  Enforce Office Public IP Restriction
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  Block employees from marking attendance unless they are on one of your authorized Office Internet Providers
                </p>
              </div>
            </label>

            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.allowAdminBypassIpLock ?? true}
                onChange={(e) => {
                  const updated = { ...formData, allowAdminBypassIpLock: e.target.checked };
                  setFormData(updated);
                  onUpdateSettings(updated);
                }}
                className="mt-0.5 w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
              />
              <div>
                <div className="text-xs font-bold text-slate-900 dark:text-slate-100">
                  Allow Admin Role to Bypass IP Lock
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  Lets Admins manage settings or authorize a new ISP IP even if a router restarts
                </p>
              </div>
            </label>
          </div>

          {/* Quick-Add Current Office IP + Subnet + Manual Additional IP Form */}
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className="text-xs font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5 text-blue-600" />
                <span>Authorize Your 2 Office Internet Providers & Additional IPs</span>
              </label>

              {detectedIp && detectedIp !== 'Detecting...' && detectedIp !== 'Unknown' && (
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      handleAddAllowedIp(
                        detectedIp,
                        `Office ISP (${detectedIsp !== 'Detecting...' ? detectedIsp : 'Provider 1'}) — All Extenders & LAN`
                      )
                    }
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition-colors cursor-pointer"
                  >
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>+ Authorize Exact IP ({detectedIp})</span>
                  </button>

                  {getIpSubnetWildcard(detectedIp) && (
                    <button
                      type="button"
                      onClick={() =>
                        handleAddAllowedIp(
                          getIpSubnetWildcard(detectedIp)!,
                          `ISP Dynamic Subnet (${detectedIsp !== 'Detecting...' ? detectedIsp : 'Office ISP'})`
                        )
                      }
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition-colors cursor-pointer"
                      title="Useful if your ISP slightly changes the last digits of your IP when the router restarts"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>+ Authorize ISP Subnet ({getIpSubnetWildcard(detectedIp)})</span>
                    </button>
                  )}
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
              <div className="sm:col-span-5">
                <input
                  type="text"
                  value={newIpInput}
                  onChange={(e) => setNewIpInput(e.target.value)}
                  placeholder="Enter 2nd Provider IP or Range (e.g. 175.107.239.*)"
                  className="w-full text-xs font-mono px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
                />
              </div>
              <div className="sm:col-span-5">
                <input
                  type="text"
                  value={newIpLabelInput}
                  onChange={(e) => setNewIpLabelInput(e.target.value)}
                  placeholder="Label (e.g. ISP Provider 2 — All Extenders & Ethernet)"
                  className="w-full text-xs px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
                />
              </div>
              <div className="sm:col-span-2">
                <button
                  type="button"
                  onClick={() => handleAddAllowedIp(newIpInput, newIpLabelInput)}
                  disabled={!newIpInput.trim()}
                  className="w-full h-full py-2 px-3 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 dark:disabled:bg-slate-800 text-white flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add IP</span>
                </button>
              </div>
            </div>
          </div>

          {/* Whitelisted IPs Table */}
          <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
            <div className="bg-slate-50 dark:bg-slate-800/70 px-4 py-2.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Authorized Office Internet Providers & Public IPs ({(formData.allowedOfficeIps || []).length})
              </span>
              <span className="text-[11px] text-slate-500">
                Covers all Wi-Fi extenders & Ethernet cables under these IPs
              </span>
            </div>

            {(formData.allowedOfficeIps || []).length === 0 ? (
              <div className="p-5 text-center text-xs text-slate-500 dark:text-slate-400">
                No Office Provider IPs added yet. Click <strong>"+ Authorize Exact IP"</strong> or <strong>"+ Authorize ISP Subnet"</strong> above for Provider 1, then add Provider 2.
              </div>
            ) : (
              <div className="divide-y divide-slate-200 dark:divide-slate-800">
                {(formData.allowedOfficeIps || []).map((item) => {
                  const isCurrentMatch =
                    item.ip === detectedIp ||
                    (item.ip.includes('*') && detectedIp.startsWith(item.ip.split('*')[0]));
                  return (
                    <div
                      key={item.ip}
                      className="px-4 py-2.5 flex items-center justify-between gap-4 hover:bg-slate-50/80 dark:hover:bg-slate-800/30"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="font-mono text-xs font-bold px-2.5 py-1 rounded bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100 border border-slate-300 dark:border-slate-700">
                          {item.ip}
                        </span>
                        <div className="min-w-0">
                          <div className="text-xs font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                            <span className="truncate">{item.label}</span>
                            {isCurrentMatch && (
                              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300">
                                Active Match
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-slate-400">Added on {item.addedAt}</div>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleRemoveAllowedIp(item.ip)}
                        className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                        title="Remove IP Address"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Anti-Proxy Single-Device Binding Security Card */}
        <div className="bg-white dark:bg-slate-900 rounded-xl p-6 border-2 border-blue-500/30 dark:border-blue-500/20 shadow-xs space-y-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
            <Smartphone className="w-4 h-4 text-blue-600" />
            <span>Anti-Proxy Punching & Mobile Device Binding (1 Device = 1 Employee)</span>
          </div>

          <p className="text-xs text-slate-500 dark:text-slate-400">
            Prevents coworkers from sharing PINs or clocking in for absent colleagues while connected to the office network. When enabled, each employee's account is permanently paired to their personal mobile phone on their first punch.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.enforceDeviceBinding !== false}
                onChange={(e) => {
                  const updated = { ...formData, enforceDeviceBinding: e.target.checked };
                  setFormData(updated);
                  onUpdateSettings(updated);
                }}
                className="mt-1 w-4 h-4 rounded text-blue-600"
              />
              <div className="text-xs">
                <span className="font-semibold text-slate-900 dark:text-slate-100 block">
                  Enforce Single-Device Binding
                </span>
                <span className="text-slate-500 dark:text-slate-400 text-[11px]">
                  Employees can only punch from their own registered phone
                </span>
              </div>
            </label>

            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.allowAdminBypassDeviceBinding !== false}
                onChange={(e) => {
                  const updated = { ...formData, allowAdminBypassDeviceBinding: e.target.checked };
                  setFormData(updated);
                  onUpdateSettings(updated);
                }}
                className="mt-1 w-4 h-4 rounded text-blue-600"
              />
              <div className="text-xs">
                <span className="font-semibold text-slate-900 dark:text-slate-100 block">
                  Allow Admin Bypass
                </span>
                <span className="text-slate-500 dark:text-slate-400 text-[11px]">
                  Administrators can log in and manage from any office PC
                </span>
              </div>
            </label>

            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.allowKioskPunchWithoutDevice !== false}
                onChange={(e) => {
                  const updated = { ...formData, allowKioskPunchWithoutDevice: e.target.checked };
                  setFormData(updated);
                  onUpdateSettings(updated);
                }}
                className="mt-1 w-4 h-4 rounded text-blue-600"
              />
              <div className="text-xs">
                <span className="font-semibold text-slate-900 dark:text-slate-100 block">
                  Exempt Lobby Kiosk Terminal
                </span>
                <span className="text-slate-500 dark:text-slate-400 text-[11px]">
                  Allows wall-mounted reception tablet to accept PINs from all staff
                </span>
              </div>
            </label>
          </div>
        </div>

        {/* Save Confirmation Button */}
        <div className="flex items-center justify-between">
          <div>
            {saveSuccess && (
              <span className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 font-semibold animate-in fade-in">
                <CheckCircle2 className="w-4 h-4" />
                <span>Configuration saved successfully!</span>
              </span>
            )}
          </div>

          <button
            type="submit"
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition-colors cursor-pointer"
          >
            <Save className="w-4 h-4" />
            <span>Save Configuration</span>
          </button>
        </div>
      </form>

      {/* Database Backup & Disaster Recovery Card */}
      <div className="bg-white dark:bg-slate-900 rounded-xl p-6 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
          <ShieldAlert className="w-4 h-4 text-amber-600" />
          <span>Local Server Database Backup & Recovery</span>
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Export your entire local office database (employees, punch logs, shifts, leave requests) into a portable JSON backup file for archiving or transfer to another PC.
        </p>

        <div className="flex flex-wrap items-center gap-3 pt-2">
          <button
            type="button"
            onClick={handleBackupDownload}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-blue-600" />
            <span>Export Full Database Backup (JSON)</span>
          </button>

          <label className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 transition-colors cursor-pointer">
            <Upload className="w-3.5 h-3.5 text-emerald-600" />
            <span>Restore Backup JSON</span>
            <input
              type="file"
              accept=".json"
              onChange={handleBackupUpload}
              className="hidden"
            />
          </label>

          <button
            type="button"
            onClick={handleResetDefaults}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer ml-auto"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Reset to Factory Defaults</span>
          </button>
        </div>
      </div>

      {/* Windows Local Server Deployment Kit Card */}
      <div className="bg-white dark:bg-slate-900 rounded-xl p-6 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
            <Server className="w-4 h-4 text-blue-600" />
            <span>Standalone Windows Software (.EXE) & Server Deployment</span>
          </div>
          <span className="text-[10px] font-bold font-mono px-2 py-0.5 rounded bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300">
            Zero Dependencies Required · Windows 10 / 11 / Server
          </span>
        </div>

        <p className="text-xs text-slate-500 dark:text-slate-400">
          Install or run the self-contained Windows software directly on any PC or Windows Server without installing Node.js or any external runtime. All web assets, server engine, and local database storage are bundled inside the executable.
        </p>

        {/* Primary Standalone .EXE Downloads */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          <a
            href="/downloads/OfficeAttendanceTracker-Setup.exe"
            download="OfficeAttendanceTracker-Setup.exe"
            className="p-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-sm transition-colors flex items-start gap-3 cursor-pointer"
          >
            <Download className="w-5 h-5 shrink-0 mt-0.5" />
            <div>
              <div className="text-xs font-bold">
                Download Windows Installer (OfficeAttendanceTracker-Setup.exe)
              </div>
              <p className="text-[11px] text-blue-100 mt-1">
                Guided setup wizard · Installs to Program Files/AppData, creates Desktop & Start Menu shortcuts, configures Firewall & Auto-Start
              </p>
            </div>
          </a>

          <a
            href="/downloads/OfficeAttendanceTracker-Portable.exe"
            download="OfficeAttendanceTracker-Portable.exe"
            className="p-4 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 text-white border border-slate-700 shadow-sm transition-colors flex items-start gap-3 cursor-pointer"
          >
            <Download className="w-5 h-5 shrink-0 mt-0.5 text-emerald-400" />
            <div>
              <div className="text-xs font-bold">
                Download Single-File Portable App (OfficeAttendanceTracker-Portable.exe)
              </div>
              <p className="text-[11px] text-slate-300 mt-1">
                Zero-install standalone .exe · Copy to any USB or Windows Server folder and double-click to launch GUI Server Control Panel
              </p>
            </div>
          </a>
        </div>

        {/* Auxiliary Scripts Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
          {/* 1. Launcher .bat */}
          <button
            type="button"
            onClick={() => {
              const content = `@echo off\r\nsetlocal enabledelayedexpansion\r\ntitle Office Attendance Tracker - Windows Server Host\r\ncolor 0B\r\n\r\necho ======================================================================\r\necho    Office Attendance Tracker - Windows Local Server Launcher\r\necho ======================================================================\r\necho.\r\nwhere node >nul 2>nul\r\nif %ERRORLEVEL% NEQ 0 (\r\n    echo [ERROR] Node.js is not found on this Windows system!\r\n    echo Please install Node.js from https://nodejs.org/\r\n    pause\r\n    exit /b 1\r\n)\r\nif not exist "node_modules\\\\" (\r\n    echo [1/3] Installing dependencies...\r\n    call npm install\r\n)\r\nif not exist "dist\\\\" (\r\n    echo [2/3] Building production assets...\r\n    call npm run build\r\n)\r\necho.\r\necho [3/3] Starting Attendance Tracker Server on port 3000...\r\nstart http://localhost:3000\r\ncall npm start\r\npause\r\n`;
              const blob = new Blob([content], { type: 'application/x-bat' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = 'start-windows-server.bat';
              a.click();
              URL.revokeObjectURL(url);
            }}
            className="p-3.5 rounded-lg bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/60 hover:bg-blue-100 dark:hover:bg-blue-900/40 text-left transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-2 text-xs font-bold text-blue-700 dark:text-blue-300">
              <Download className="w-4 h-4 shrink-0" />
              <span>start-windows-server.bat</span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
              Double-click to start local server & open browser on port 3000
            </p>
          </button>

          {/* 2. Service Installer .bat */}
          <button
            type="button"
            onClick={() => {
              const content = `@echo off\r\ntitle Install Attendance Tracker Windows Auto-Start Task\r\ncolor 0A\r\necho Registering Windows Startup Task for Attendance Tracker...\r\nset SCRIPT_DIR=%~dp0\r\nset BATCH_PATH=%SCRIPT_DIR%start-windows-server.bat\r\nschtasks /create /tn "OfficeAttendanceServer" /tr "\\"%BATCH_PATH%\\"" /sc onstart /ru SYSTEM /f\r\necho Done. Check task in Windows Task Scheduler.\r\npause\r\n`;
              const blob = new Blob([content], { type: 'application/x-bat' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = 'install-windows-service.bat';
              a.click();
              URL.revokeObjectURL(url);
            }}
            className="p-3.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 text-left transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-2 text-xs font-bold text-emerald-700 dark:text-emerald-300">
              <Download className="w-4 h-4 shrink-0" />
              <span>install-windows-service.bat</span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
              Registers Windows auto-start background task on boot
            </p>
          </button>

          {/* 3. Deployment Guide .md */}
          <button
            type="button"
            onClick={() => {
              const content = `# Windows Local Office Server Deployment Guide\r\n\r\n## Quick Start\r\n1. Install Node.js (LTS version) from https://nodejs.org/\r\n2. Run \`start-windows-server.bat\`.\r\n3. Access on http://localhost:3000 or your office LAN IP (http://192.168.1.X:3000).\r\n\r\n## Windows Firewall Rule (Admin Command Prompt):\r\nnetsh advfirewall firewall add rule name="Office Attendance Tracker" dir=in action=allow protocol=TCP localport=3000\r\n\r\n## Running Kiosk on Entrance Tablet\r\nNavigate to http://[SERVER-IP]:3000 and switch to 'Lobby Kiosk' mode.\r\n`;
              const blob = new Blob([content], { type: 'text/markdown' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = 'WINDOWS_SERVER_DEPLOYMENT.md';
              a.click();
              URL.revokeObjectURL(url);
            }}
            className="p-3.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700/60 text-left transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-2 text-xs font-bold text-slate-800 dark:text-slate-200">
              <Download className="w-4 h-4 shrink-0 text-slate-600" />
              <span>Deployment Manual (.md)</span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
              Firewall, LAN IP, and Windows Task Scheduler guide
            </p>
          </button>
        </div>

        {/* Windows Firewall Quick Command */}
        <div className="pt-3 border-t border-slate-100 dark:border-slate-800">
          <p className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1.5">
            Allow Port 3000 in Windows Firewall (run in Administrator Command Prompt):
          </p>
          <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800 flex items-center justify-between text-xs font-mono text-emerald-400 overflow-x-auto">
            <span>netsh advfirewall firewall add rule name="Office Attendance Tracker" dir=in action=allow protocol=TCP localport=3000</span>
          </div>
        </div>
      </div>
    </div>
  );
};
