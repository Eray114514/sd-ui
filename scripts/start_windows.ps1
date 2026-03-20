# SD-UI Windows Startup Script
# Usage: Right-click "Run with PowerShell" or execute in PowerShell: .\scripts\start_windows.ps1

$ErrorActionPreference = "Stop"

$SCRIPT_DIR = Split-Path -Parent $MyInvocation.MyCommand.Definition
$REPO_ROOT = Resolve-Path (Join-Path $SCRIPT_DIR "..")
$APP_DIR = Join-Path $REPO_ROOT "ui"
$LOG_DIR = Join-Path $REPO_ROOT "logs"

if (!(Test-Path $LOG_DIR)) {
    New-Item -ItemType Directory -Path $LOG_DIR -Force | Out-Null
}

$LOG_OUT = Join-Path $LOG_DIR "app.log"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "       SD-UI Startup Script            " -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check if port 3000 is already in use
$portInUse = Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue
if ($portInUse) {
    Write-Host "Warning: Port 3000 is already in use!" -ForegroundColor Yellow
    Write-Host "The following processes are using port 3000:" -ForegroundColor Yellow
    $portInUse | ForEach-Object {
        Write-Host "  PID: $($_.OwningProcess)" -ForegroundColor Gray
    }
    Write-Host ""
    Write-Host "Do you want to kill these processes and continue? (Y/N)" -ForegroundColor Yellow
    $response = Read-Host
    if ($response -eq "Y" -or $response -eq "y") {
        $portInUse | ForEach-Object {
            Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue
            Write-Host "Killed process: $($_.OwningProcess)" -ForegroundColor Gray
        }
        Write-Host "Port 3000 is now free." -ForegroundColor Green
    } else {
        Write-Host "Startup cancelled. Please close the application using port 3000 and run this script again." -ForegroundColor Red
        exit 1
    }
    Write-Host ""
}

if (!(Test-Path $APP_DIR)) {
    Write-Host "Error: App directory not found: $APP_DIR" -ForegroundColor Red
    exit 1
}

if (!(Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "Error: Node.js not found. Please install Node.js first." -ForegroundColor Red
    exit 1
}

Write-Host "Project dir: $REPO_ROOT" -ForegroundColor Gray
Write-Host "App dir: $APP_DIR" -ForegroundColor Gray
Write-Host ""

Set-Location $APP_DIR

if (!(Test-Path "node_modules")) {
    Write-Host "Installing dependencies..." -ForegroundColor Yellow
    npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Error: Failed to install dependencies" -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "Dependencies found, skipping install." -ForegroundColor Green
}

if (!(Test-Path "node_modules\.prisma")) {
    Write-Host "Generating Prisma client..." -ForegroundColor Yellow
    npx prisma generate
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Error: Failed to generate Prisma client" -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "Prisma client found, skipping generation." -ForegroundColor Green
}

if (!(Test-Path "prisma\dev.db")) {
    Write-Host "Initializing database..." -ForegroundColor Yellow
    npx prisma db push
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Error: Failed to initialize database" -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "Database found, skipping initialization." -ForegroundColor Green
}

Write-Host ""
Write-Host "Starting SD-UI..." -ForegroundColor Green
Write-Host "Access: http://localhost:3000" -ForegroundColor Green
Write-Host ""
Write-Host "Press Ctrl+C to stop" -ForegroundColor Yellow
Write-Host ""

Start-Process -FilePath "cmd" -ArgumentList "/c timeout /t 8 /nobreak >nul & start http://localhost:3000" -WindowStyle Hidden

try {
    npm run dev 2>&1 | Tee-Object -FilePath $LOG_OUT
} catch {
    Write-Host "Error: $_" -ForegroundColor Red
    exit 1
}
