@echo off
title SD-UI Startup Script
echo ========================================
echo        SD-UI Startup Script
echo ========================================
echo.

set "SCRIPT_DIR=%~dp0"
set "REPO_ROOT=%SCRIPT_DIR%.."
set "APP_DIR=%REPO_ROOT%\ui"
set "LOG_DIR=%REPO_ROOT%\logs"

if not exist "%LOG_DIR%" mkdir "%LOG_DIR%"

echo Project dir: %REPO_ROOT%
echo App dir: %APP_DIR%
echo Log dir: %LOG_DIR%
echo.

if not exist "%APP_DIR%" (
    echo Error: App directory not found: %APP_DIR%
    pause
    exit /b 1
)

node --version >nul 2>&1
if errorlevel 1 (
    echo Error: Node.js not found. Please install Node.js first.
    pause
    exit /b 1
)

cd /d "%APP_DIR%"

if not exist "node_modules" (
    echo Installing dependencies...
    call npm install
    if errorlevel 1 (
        echo Error: Failed to install dependencies
        pause
        exit /b 1
    )
) else (
    echo Dependencies found, skipping install.
)

if not exist "node_modules\.prisma" (
    echo Generating Prisma client...
    call npx prisma generate
    if errorlevel 1 (
        echo Error: Failed to generate Prisma client
        pause
        exit /b 1
    )
) else (
    echo Prisma client found, skipping generation.
)

if not exist "prisma\dev.db" (
    echo Initializing database...
    call npx prisma db push
    if errorlevel 1 (
        echo Error: Failed to initialize database
        pause
        exit /b 1
    )
) else (
    echo Database found, skipping initialization.
)

echo.
echo Starting SD-UI...
echo Access: http://localhost:3000
echo.
echo Press Ctrl+C to stop
echo.

start /B cmd /c "timeout /t 8 /nobreak >nul & start http://localhost:3000"

npm run dev

pause
