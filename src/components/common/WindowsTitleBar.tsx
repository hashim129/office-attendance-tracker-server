import React from 'react';
import {
  Clock,
  Layers,
  Monitor,
  Moon,
  Sun,
  Minus,
  Square,
  X,
  Server,
} from 'lucide-react';
import { AppMode } from '../../types';

interface WindowsTitleBarProps {
  appMode: AppMode;
  onToggleMode: (mode: AppMode) => void;
  isDark: boolean;
  onToggleTheme: () => void;
  serverHost: string;
  serverPort: number;
}

export const WindowsTitleBar: React.FC<WindowsTitleBarProps> = ({
  appMode,
  onToggleMode,
  isDark,
  onToggleTheme,
  serverHost,
  serverPort,
}) => {
  const [isMaximized, setIsMaximized] = React.useState(false);

  const handleMinimize = () => {
    // Simulated Windows minimize animation/feedback
    const el = document.getElementById('windows-window-frame');
    if (el) {
      el.classList.add('scale-95', 'opacity-60');
      setTimeout(() => {
        el.classList.remove('scale-95', 'opacity-60');
      }, 300);
    }
  };

  const handleMaximize = () => {
    setIsMaximized(!isMaximized);
  };

  return (
    <header className="h-10 bg-slate-200/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-300 dark:border-slate-800 flex items-center justify-between px-3 select-none text-xs text-slate-700 dark:text-slate-300 z-50">
      {/* Left: App Icon & Brand Title */}
      <div className="flex items-center gap-2.5 shrink-0">
        <div className="w-5 h-5 rounded bg-blue-600 flex items-center justify-center text-white shadow-xs">
          <Clock className="w-3.5 h-3.5" />
        </div>
        <span className="font-semibold text-slate-900 dark:text-slate-100 whitespace-nowrap">
          Office Attendance Tracker
        </span>
        <span className="text-slate-400 dark:text-slate-500 hidden sm:inline">|</span>
        <div className="hidden md:flex items-center gap-1.5 text-slate-500 dark:text-slate-400 font-mono text-[11px]">
          <Server className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
          <span>{serverHost}:{serverPort}</span>
        </div>
      </div>

      {/* Center: Mode Switcher */}
      <div className="flex items-center gap-1 p-0.5 bg-slate-300/60 dark:bg-slate-800/80 rounded-md border border-slate-300/80 dark:border-slate-700/60">
        <button
          onClick={() => onToggleMode('desktop')}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition-colors ${
            appMode === 'desktop'
              ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
          title="Switch to Desktop Office Management Workspace"
        >
          <Layers className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Desktop App</span>
        </button>

        <button
          onClick={() => onToggleMode('kiosk')}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition-colors ${
            appMode === 'kiosk'
              ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
          title="Switch to Fullscreen Lobby Punch-Clock Terminal"
        >
          <Monitor className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Lobby Kiosk</span>
        </button>
      </div>

      {/* Right: Theme Toggle & Windows Window Controls */}
      <div className="flex items-center gap-1 shrink-0">
        <button
          onClick={onToggleTheme}
          className="p-1.5 rounded hover:bg-slate-300 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 transition-colors"
          title={isDark ? 'Switch to Light Theme' : 'Switch to Dark Theme'}
        >
          {isDark ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
        </button>

        <div className="h-4 w-px bg-slate-300 dark:bg-slate-700 mx-1" />

        {/* Windows Standard Title Bar Buttons */}
        <button
          onClick={handleMinimize}
          className="w-8 h-7 flex items-center justify-center rounded hover:bg-slate-300 dark:hover:bg-slate-800 transition-colors text-slate-600 dark:text-slate-400"
          title="Minimize"
        >
          <Minus className="w-3.5 h-3.5" />
        </button>

        <button
          onClick={handleMaximize}
          className="w-8 h-7 flex items-center justify-center rounded hover:bg-slate-300 dark:hover:bg-slate-800 transition-colors text-slate-600 dark:text-slate-400"
          title={isMaximized ? 'Restore Down' : 'Maximize'}
        >
          <Square className="w-3 h-3" />
        </button>

        <button
          onClick={() => {
            if (confirm('Exit Attendance Tracker Windows application?')) {
              window.location.reload();
            }
          }}
          className="w-8 h-7 flex items-center justify-center rounded hover:bg-rose-600 hover:text-white transition-colors text-slate-600 dark:text-slate-400"
          title="Close Window"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </header>
  );
};
