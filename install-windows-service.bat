@echo off
title Install Attendance Tracker Windows Auto-Start Task
color 0A

echo ======================================================================
echo    Attendance Tracker - Windows Auto-Start Service Setup
echo ======================================================================
echo.
echo This script registers a Windows Scheduled Task to automatically start
echo the Attendance Tracker server whenever this PC boots up.
echo.

:: Get current directory
set SCRIPT_DIR=%~dp0
set BATCH_PATH=%SCRIPT_DIR%start-windows-server.bat

echo Registering Windows Startup Task for:
echo %BATCH_PATH%
echo.

schtasks /create /tn "OfficeAttendanceServer" /tr "\"%BATCH_PATH%\"" /sc onstart /ru SYSTEM /f

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ======================================================================
    echo  [SUCCESS] Auto-start task "OfficeAttendanceServer" created!
    echo  The server will now automatically run when Windows starts.
    echo ======================================================================
) else (
    echo.
    echo [NOTE] Administrator privileges required to register system startup task.
    echo Please right-click "install-windows-service.bat" and select "Run as Administrator".
)

echo.
pause
