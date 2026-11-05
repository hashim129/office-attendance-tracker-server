# Windows Local Office Server Deployment Guide

This package includes **two standalone Windows executables (`.exe`)** that require **zero external dependencies** (no Node.js, npm, or external database installation required). All web assets, the local HTTP server, and the shared JSON database engine are compiled directly into the executable.

---

## 1. Zero-Dependency Windows Executables (Recommended)

You can find both executables in the root directory, the `release\` directory, or download them directly inside the app under **Office & Server Settings**:

### Option A: Guided Windows Installer (`OfficeAttendanceTracker-Setup.exe`)
1. Copy `OfficeAttendanceTracker-Setup.exe` to your Windows Server or host PC.
2. Double-click **`OfficeAttendanceTracker-Setup.exe`**.
3. Choose your installation folder and select your preferences:
   - Create Desktop Shortcut (`Office Attendance Tracker`)
   - Create Start Menu Shortcut
   - Automatically start server when Windows starts
   - Add Windows Firewall rule for Office LAN access (Port 3000)
4. Click **Install Now**.

### Option B: Single-File Portable App (`OfficeAttendanceTracker-Portable.exe`)
1. Copy **`OfficeAttendanceTracker-Portable.exe`** to any folder or USB drive on any Windows 10, Windows 11, or Windows Server machine.
2. Double-click **`OfficeAttendanceTracker-Portable.exe`**.
3. The native **Windows Server Control Panel** will open, start the server on Port `3000`, display your Office LAN URL (e.g., `http://192.168.1.100:3000`), and open the desktop application window automatically.

---

## 2. Connecting Office Staff PCs & Kiosk Terminals

- **Host Server PC**: `http://localhost:3000`
- **Employee Workstations on LAN**: `http://[SERVER-LAN-IP]:3000` (shown directly in the Windows Server Control Panel window).
- **Shared Live Database**: All punches, employee updates, shift schedules, and leave requests across all LAN computers are automatically synchronized to the central `data\database.json` file on the server.
- **Minimize to System Tray**: Click **Minimize to System Tray** in the Server Control Panel to keep the attendance server running quietly in the background.
