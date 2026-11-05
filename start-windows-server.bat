@echo off
setlocal enabledelayedexpansion
title Office Attendance Tracker - Windows Server Host
color 0B

echo ======================================================================
echo    Office Attendance Tracker - Windows Local Server Launcher
echo ======================================================================
echo.

:: 1. Verify Node.js is installed
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Node.js is not found on this Windows system!
    echo.
    echo Please install Node.js (version 18, 20, or 22 LTS) from:
    echo https://nodejs.org/
    echo.
    echo After installing Node.js, run this file again.
    echo.
    pause
    exit /b 1
)

echo [OK] Node.js detected:
call node -v
echo.

:: 2. Check and install dependencies if needed
if not exist "node_modules\" (
    echo [1/3] First-time setup: Installing required libraries...
    call npm install
    if %ERRORLEVEL% NEQ 0 (
        echo [ERROR] npm install encountered an error.
        pause
        exit /b 1
    )
) else (
    echo [1/3] Dependencies verified.
)

:: 3. Build production web bundle if missing
if not exist "dist\" (
    echo [2/3] Building production assets...
    call npm run build
    if %ERRORLEVEL% NEQ 0 (
        echo [ERROR] Build failed. Please inspect logs.
        pause
        exit /b 1
    )
) else (
    echo [2/3] Production build bundle ready.
)

:: 4. Get local IPv4 address for LAN access
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /c:"IPv4 Address"') do (
    set IP=%%a
    set IP=!IP: =!
    goto :found_ip
)
:found_ip

echo.
echo [3/3] Launching Office Attendance Server...
echo ======================================================================
echo  SERVER IS ACTIVE AND RUNNING!
echo.
echo  - Host Machine Access:   http://localhost:3000
if defined IP (
    echo  - Office LAN Access:    http://!IP!:3000
) else (
    echo  - Office LAN Access:    http://[SERVER-IP-ADDRESS]:3000
)
echo.
echo  Employees can connect from any Windows, Mac, or mobile browser on LAN.
echo  To run the Lobby Punch Kiosk on reception PC, open the link and toggle
echo  "Lobby Kiosk" mode in the top title bar.
echo.
echo  Keep this terminal window open to keep the service running.
echo ======================================================================
echo.

:: Open default browser to server interface
start http://localhost:3000

:: Start server
call npm start
pause
