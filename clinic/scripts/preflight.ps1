#!/usr/bin/env pwsh
#
# Fails fast if something is already occupying a port or a build directory.
#
# Run before verify-all.ps1. Every failure mode this checks for has cost a full
# verification cycle at least once:
#
#   - A Next.js dev server left running shares .next with next build. The build then
#     fails with ENOENT on .next/server/pages-manifest.json, an error that looks
#     like a source problem but is really two processes fighting over one directory.
#   - A stale backend on the E2E port makes the suite talk to yesterday's build.
#
# ASCII only on purpose: PowerShell 5.1 reads these files as ANSI unless they carry
# a BOM, and a smart quote or em dash in a comment silently breaks parsing.
param()

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$problems = @()

Write-Output "Checking for conflicting processes..."

# --- Next.js: any node process inside the frontend tree --------------------------
$frontend = (Resolve-Path (Join-Path $root "clinic\frontend") -ErrorAction SilentlyContinue).Path
$node = @(Get-CimInstance Win32_Process -Filter "Name='node.exe'" -ErrorAction SilentlyContinue)

foreach ($process in $node) {
  if ($process.CommandLine -and $frontend -and $process.CommandLine -like "*$frontend*") {
    if ($process.CommandLine -like "*next*dev*") { $kind = "dev server" }
    elseif ($process.CommandLine -like "*next*build*") { $kind = "build" }
    elseif ($process.CommandLine -like "*playwright*") { $kind = "Playwright" }
    else { $kind = "node process" }
    $problems += "A $kind is running (PID $($process.ProcessId)). Stop it first:"
    $problems += "    Stop-Process -Id $($process.ProcessId) -Force"
  }
}

# --- A stale backend on the port the suites use -----------------------------------
# Only a JVM is treated as a blocker. Other things legitimately hold 8080 on a
# developer machine (Apache httpd, a WSL relay, the Docker backend) and blocking on
# those would make this script impossible to run on a normal workstation. The backend
# is told to listen on 8090 for tests anyway.
$backendPorts = @(8090)
foreach ($port in $backendPorts) {
  $listeners = @(Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue)
  foreach ($conn in $listeners) {
    $proc = Get-Process -Id $conn.OwningProcess -ErrorAction SilentlyContinue
    if ($proc -and $proc.ProcessName -eq "java") {
      $problems += "Port $port is held by a JVM (PID $($conn.OwningProcess)). Stop it first:"
      $problems += "    Stop-Process -Id $($conn.OwningProcess) -Force"
    } else {
      Write-Output "  note: port $port is held by $($proc.ProcessName); ignoring it."
    }
  }
}

# --- Report on build directories without blocking --------------------------------
foreach ($dir in @("clinic\frontend\.next", "clinic\backend\target")) {
  $path = Join-Path $root $dir
  if (Test-Path $path) {
    $bytes = (Get-ChildItem $path -Recurse -File -ErrorAction SilentlyContinue |
      Measure-Object -Property Length -Sum).Sum
    $sizeMb = [math]::Round(($bytes / 1MB), 1)
    Write-Output "  note: $dir exists ($sizeMb MB) and will be rebuilt."
  }
}

Write-Output ""
if ($problems.Count -gt 0) {
  Write-Output "Cannot start verification:"
  $problems | ForEach-Object { Write-Output "  - $_" }
  Write-Output ""
  Write-Output "Each of these makes a later stage fail for reasons unrelated to the code."
  exit 1
}

Write-Output "No conflicting processes. Safe to verify."
exit 0
