import React from 'react';
import { LogOut, Shield, User, Monitor } from 'lucide-react';
import { ActiveDesktopTab, AppMode, Employee } from '../../types';

interface DesktopHeaderProps {
  currentUser: Employee;
  activeTab: ActiveDesktopTab;
  onLogout: () => void;
  onSwitchToKiosk: () => void;
}

export const DesktopHeader: React.FC<DesktopHeaderProps> = ({
  currentUser,
  activeTab,
  onLogout,
  onSwitchToKiosk,
}) => {
  const getTabLabel = (tab: ActiveDesktopTab): string => {
    switch (tab) {
      case 'clock':
        return 'Punch Clock & Active Shift';
      case 'my-attendance':
        return 'My Attendance & Personal Stats';
      case 'team-attendance':
        return 'Office Team Attendance & Live Roster';
      case 'employees':
        return 'Staff Directory & Management';
      case 'shifts':
        return 'Shift Schedules & Working Rules';
      case 'leaves':
        return 'Leave & Vacation Requests';
      case 'reports':
        return 'Attendance Analytics & Timesheets';
      case 'settings':
        return 'Office & Local Server Configuration';
      default:
        return 'Workspace';
    }
  };

  return (
    <div className="h-14 px-6 border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md flex items-center justify-between shrink-0">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-xs">
        <span className="text-slate-400 dark:text-slate-500 font-medium">Workspace</span>
        <span className="text-slate-300 dark:text-slate-700">/</span>
        <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
          {getTabLabel(activeTab)}
        </h2>
      </div>

      {/* Right Controls: Kiosk Mode Shortcut & User Profile */}
      <div className="flex items-center gap-4">
        <button
          onClick={onSwitchToKiosk}
          className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors"
          title="Switch to Lobby Punch-Clock Terminal"
        >
          <Monitor className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
          <span>Lobby Kiosk Mode</span>
        </button>

        <div className="h-5 w-px bg-slate-200 dark:bg-slate-800 hidden sm:block" />

        {/* Profile Card */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 flex items-center justify-center font-bold text-xs ring-2 ring-white dark:ring-slate-800">
            {currentUser.name.charAt(0)}
          </div>
          <div className="hidden md:block text-left">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                {currentUser.name}
              </span>
              <span
                className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.2 rounded ${
                  currentUser.role === 'admin'
                    ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300'
                    : 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300'
                }`}
              >
                {currentUser.role}
              </span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              {currentUser.department} · {currentUser.employeeCode}
            </p>
          </div>

          {/* Logout / Switch User */}
          <button
            onClick={onLogout}
            className="p-2 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title="Sign out or switch employee"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
