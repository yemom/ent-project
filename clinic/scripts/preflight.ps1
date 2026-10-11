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
# This file lives in <repo>/clinic/scripts, so the parent is <repo>/clinic and the
# frontend sits directly beneath it.
$root = Split-Path -Parent $PSScriptRoot
$problems = @()

Write-Output "Checking for conflicting processes..."

# --- Next.js: any node process that could be touching .next ----------------------
# Matches on the command line rather than on a path, because a process launched
# from another directory (npm run dev from a parent folder, or a Playwright
# webServer) will not contain this project's path in its command line, yet will
# still write into the same .next directory.
$node = @(Get-CimInstance Win32_Process -Filter "Name='node.exe'" -ErrorAction SilentlyContinue)

foreach ($process in $node) {
  $cmd = $process.CommandLine
  if (-not $cmd) { continue }

  $isNext = $cmd -like "*next*" -or $cmd -like "*playwright*"
  if (-not $isNext) { continue }

  if ($cmd -like "*next*dev*" -or $cmd -like "*next-server*") { $kind = "Next.js dev server" }
  elseif ($cmd -like "*next*build*") { $kind = "Next.js build" }
  elseif ($cmd -like "*playwright*") { $kind = "Playwright" }
  else { $kind = "Next.js process" }

  $problems += "A $kind is running (PID $($process.ProcessId)). Stop it first:"
  $problems += "    Stop-Process -Id $($process.ProcessId) -Force"
}

# --- The dev ports the frontend uses ---------------------------------------------
# Only a Node process counts as a blocker. Other things legitimately hold 3000 on a
# developer machine (Docker Desktop, Apache, an IDE proxy) and refusing to run
# because of them would make this script unusable outside a clean CI container.
foreach ($port in @(3000, 3100)) {
  $listeners = @(Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue)
  foreach ($conn in $listeners) {
    $proc = Get-Process -Id $conn.OwningProcess -ErrorAction SilentlyContinue
    if ($proc -and $proc.ProcessName -eq "node") {
      $problems += "Port $port is held by node (PID $($conn.OwningProcess)). Stop it before verifying:"
      $problems += "    Stop-Process -Id $($conn.OwningProcess) -Force"
    } else {
      Write-Output "  note: port $port is held by $($proc.ProcessName); ignoring it."
    }
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
foreach ($dir in @("frontend\.next", "backend\target")) {
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
