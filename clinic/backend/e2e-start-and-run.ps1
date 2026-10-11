# Restarts the E2E backend on a fresh in-memory database, then runs the suite.
#
# The database is in-memory, so a restart is what makes the run reproducible:
# otherwise the second run trips over "Email already exists" from the first.
param(
  [switch]$SkipRestart
)

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

if (-not $SkipRestart) {
  # The database is in-memory, so a fresh JVM is the only way to get a clean run.
  # That makes killing the old backend mandatory rather than tidiness: if it
  # survives, the new JVM cannot bind the port, the old one keeps serving its
  # stale database, and the suite fails on "email already exists" for reasons that
  # have nothing to do with the code.
  #
  # Matched on the listening port rather than only on the command line, because a
  # JVM started with an absolute path, or whose CommandLine is not readable, still
  # holds the port.
  $testPort = 8090
  $owners = @(Get-NetTCPConnection -LocalPort $testPort -State Listen -ErrorAction SilentlyContinue |
    Select-Object -ExpandProperty OwningProcess -Unique)
  $byCommand = @(Get-CimInstance Win32_Process -Filter "Name='java.exe'" |
    Where-Object { $_.CommandLine -like "*clinicl*.jar*" } |
    Select-Object -ExpandProperty ProcessId)

  $targets = @($owners + $byCommand | Sort-Object -Unique)
  foreach ($pid_ in $targets) {
    Write-Output "Stopping stale backend (PID $pid_)"
    Stop-Process -Id $pid_ -Force -ErrorAction SilentlyContinue
  }

  # Waits for the port to actually free up rather than sleeping a fixed amount.
  for ($i = 0; $i -lt 30; $i++) {
    if (-not (Get-NetTCPConnection -LocalPort $testPort -State Listen -ErrorAction SilentlyContinue)) { break }
    Start-Sleep -Seconds 1
  }
  if (Get-NetTCPConnection -LocalPort $testPort -State Listen -ErrorAction SilentlyContinue) {
    throw "Port $testPort is still in use after stopping the stale backend."
  }

  # A >=64 byte secret: HS512 rejects anything shorter and the app now refuses to
  # start, which is the behaviour we want in production too.
  if (-not (Test-Path "e2e-secret.txt")) {
    $secret = [Convert]::ToBase64String((1..64 | ForEach-Object { Get-Random -Minimum 0 -Maximum 256 }))
    Set-Content -Path "e2e-secret.txt" -Value $secret -NoNewline
  }
  $secret = Get-Content "e2e-secret.txt" -Raw

  $env:SPRING_PROFILES_ACTIVE = "e2e"
  $env:SPRING_DATASOURCE_URL = "jdbc:h2:mem:clinice;MODE=PostgreSQL;DB_CLOSE_DELAY=-1;DATABASE_TO_UPPER=false"
  $env:SPRING_DATASOURCE_USERNAME = "sa"
  $env:SPRING_DATASOURCE_PASSWORD = ""
  # Flyway is off and the schema comes from the JPA model, because the migrations
  # contain PostgreSQL triggers H2 cannot execute. Migration validity is covered by
  # schema.sql and reviewed against Postgres syntax instead.
  $env:SPRING_JPA_HIBERNATE_DDL_AUTO = "create-drop"
  $env:SPRING_FLYWAY_ENABLED = "false"

  # Off by default here, and overridable from the environment. This suite fires
  # several hundred requests within a couple of minutes against a single account,
  # which a limiter tuned for human traffic correctly rejects with 429. That
  # protection belongs in production, not in a scripted test run.
  if ($null -eq $env:APP_RATE_LIMIT_ENABLED) { $env:APP_RATE_LIMIT_ENABLED = "false" }

  # The frontend the Playwright suite starts (3100) plus a normal `npm run dev` (3000).
  # Both are local-only origins.
  $env:CORS_ALLOWED_ORIGINS = "http://localhost:3000,http://localhost:3100"

  # The production variable names. Values are read from .env.local rather than
  # hardcoded: a harness that boots the app for testing still must not carry a live
  # credential in a committed file. e2e-run.ps1 needs the same two variables, and
  # they are inherited by the child process it launches below.
  if (Test-Path ".env.local") {
    Get-Content ".env.local" | ForEach-Object {
      if ($_ -match '^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$') {
        $name = $Matches[1]
        $value = $Matches[2].Trim().Trim('"').Trim("'")
        if ($name -like "SUPER_ADMIN_*") { Set-Item -Path "env:$name" -Value $value }
      }
    }
  }

  if (-not $env:SUPER_ADMIN_PASSWORD) {
    throw @"
No SUPER_ADMIN_PASSWORD available.

Put your Super Admin credentials in backend/.env.local (git-ignored) as:

  SUPER_ADMIN_EMAIL=you@example.com
  SUPER_ADMIN_PASSWORD=...

Or export the variables before running this script. They must not be committed.
"@
  }
  $env:SUPER_ADMIN_NAME = if ($env:SUPER_ADMIN_NAME) { $env:SUPER_ADMIN_NAME } else { "Super Admin" }
  Write-Output "Bootstrapping Super Admin: $env:SUPER_ADMIN_EMAIL"

  $env:APP_JWT_SECRET = $secret
  $env:SERVER_PORT = "$testPort"

  Start-Process -FilePath "java" -ArgumentList "-jar", "target\clinicl-1.0.0.jar" `
    -NoNewWindow -RedirectStandardOutput "e2e-backend.log" -RedirectStandardError "e2e-backend.err"

  $up = $false
  for ($i = 0; $i -lt 60; $i++) {
    Start-Sleep -Seconds 2
    try {
      $health = Invoke-RestMethod -Uri "http://localhost:8090/api/v1/health" -TimeoutSec 3
      Write-Output "Backend up: $($health.status)"
      $up = $true
      break
    } catch {}
  }
  if (-not $up) {
    Write-Output "Backend failed to start:"
    Get-Content "e2e-backend.log" -Tail 30
    exit 1
  }
}

& "$PSScriptRoot\e2e-run.ps1"