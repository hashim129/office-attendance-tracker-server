import React, { useState } from 'react';
import { LogOut, Shield, User, Monitor, Bell, Crown, Check, MessageSquare } from 'lucide-react';
import { ActiveDesktopTab, AppMode, CeoComment, Employee } from '../../types';

interface DesktopHeaderProps {
  currentUser: Employee;
  activeTab: ActiveDesktopTab;
  onLogout: () => void;
  onSwitchToKiosk: () => void;
  ceoComments?: CeoComment[];
  onMarkCeoCommentRead?: (commentId: string) => void;
}

export const DesktopHeader: React.FC<DesktopHeaderProps> = ({
  currentUser,
  activeTab,
  onLogout,
  onSwitchToKiosk,
  ceoComments = [],
  onMarkCeoCommentRead,
}) => {
  const [showNotifications, setShowNotifications] = useState(false);

  // Filter notifications sent to this employee
  const myNotifications = ceoComments.filter((c) => c.employeeId === currentUser.id);
  const unreadCount = myNotifications.filter((c) => !c.isRead).length;

  const getTabLabel = (tab: ActiveDesktopTab): string => {
    switch (tab) {
      case 'clock':
        return 'Punch Clock & Active Shift';
      case 'my-attendance':
        return 'My Attendance & Personal Stats';
      case 'team-attendance':
        return currentUser.role === 'ceo'
          ? 'Team Presence & Executive Mentions'
          : currentUser.role === 'accounts'
          ? 'Attendance Verification & Audit'
          : 'Office Team Attendance & Live Roster';
      case 'employees':
        return 'Staff Directory & Management';
      case 'shifts':
        return 'Shift Schedules & Working Rules';
      case 'leaves':
        return 'Leave & Vacation Requests';
      case 'reports':
        return currentUser.role === 'ceo'
          ? 'All Staff Attendance & Performance Analytics'
          : 'Attendance Analytics & Timesheets';
      case 'settings':
        return 'Office & Local Server Configuration';
      default:
        return 'Workspace';
    }
  };

  return (
    <div className="h-14 px-6 border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md flex items-center justify-between shrink-0 relative z-30">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-xs">
        <span className="text-slate-400 dark:text-slate-500 font-medium">Workspace</span>
        <span className="text-slate-300 dark:text-slate-700">/</span>
        <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
          {getTabLabel(activeTab)}
        </h2>
      </div>

      {/* Right Controls: Notifications, Kiosk Mode Shortcut & User Profile */}
      <div className="flex items-center gap-3">
        {/* CEO / Executive Notifications Bell */}
        <div className="relative">
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="p-2 rounded-lg text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors relative cursor-pointer"
            title="Executive Mentions & Directives"
          >
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center animate-pulse">
                {unreadCount}
              </span>
            )}
          </button>

          {/* Notifications Dropdown Panel */}
          {showNotifications && (
            <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-800 p-4 z-50">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <Crown className="w-4 h-4 text-amber-500" />
                  <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider">
                    Executive Directives & Mentions
                  </h3>
                </div>
                <span className="text-[11px] font-medium text-slate-400">
                  {unreadCount} unread
                </span>
              </div>

              <div className="max-h-72 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800 py-1">
                {myNotifications.length === 0 ? (
                  <div className="py-8 text-center text-xs text-slate-400">
                    <MessageSquare className="w-6 h-6 mx-auto mb-2 text-slate-300 dark:text-slate-600" />
                    No mentions or directives yet.
                  </div>
                ) : (
                  myNotifications.map((c) => (
                    <div
                      key={c.id}
                      className={`p-3 text-xs transition-colors rounded-lg my-1 ${
                        !c.isRead
                          ? 'bg-amber-50/70 dark:bg-amber-950/40 border border-amber-200/80 dark:border-amber-900/60'
                          : 'bg-transparent text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-amber-700 dark:text-amber-400 flex items-center gap-1">
                          <Crown className="w-3 h-3 text-amber-500" />
                          <span>{c.fromName} ({c.fromRole.toUpperCase()})</span>
                        </span>
                        <span className="text-[10px] text-slate-400">
                          {c.date} · {new Date(c.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <p className="text-slate-800 dark:text-slate-200 mt-1 font-medium leading-relaxed">
                        "{c.message}"
                      </p>
                      {!c.isRead && onMarkCeoCommentRead && (
                        <button
                          onClick={() => onMarkCeoCommentRead(c.id)}
                          className="mt-2 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1 cursor-pointer"
                        >
                          <Check className="w-3 h-3" />
                          <span>Mark as Read / Acknowledged</span>
                        </button>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        <button
          onClick={onSwitchToKiosk}
          className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
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
                    : currentUser.role === 'ceo'
                    ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200 border border-amber-300 dark:border-amber-700 font-black'
                    : currentUser.role === 'accounts'
                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300'
                    : 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300'
                }`}
              >
                {currentUser.role === 'ceo'
                  ? 'CEO'
                  : currentUser.role === 'accounts'
                  ? 'Accounts Officer'
                  : currentUser.role}
              </span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              {currentUser.department} · {currentUser.employeeCode}
            </p>
          </div>

          {/* Logout / Switch User */}
          <button
            onClick={onLogout}
            className="p-2 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            title="Sign out or switch employee"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
