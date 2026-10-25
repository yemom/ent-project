#!/usr/bin/env pwsh
#
# Runs the real Flyway chain against a real PostgreSQL.
#
# Why this exists:
#
#   The normal test suite runs on H2 with Flyway switched off, because the
#   migrations contain PostgreSQL triggers and DO blocks that H2 cannot execute. That
#   is a deliberate trade-off, but it has a sharp edge: a migration can be completely
#   broken against PostgreSQL and every local check still passes. V16 did exactly
#   that -- it created an index on a column that did not exist, and only the first
#   production deploy found it.
#
#   Nothing short of running the migrations on PostgreSQL closes that gap, so this
#   script does exactly that and nothing more.
#
# Requires a local PostgreSQL (psql/initdb/pg_ctl on PATH, or in Program Files).
# ASCII only: PowerShell 5.1 reads this file as ANSI without a BOM.
param(
  # Reuse an already-running cluster instead of starting a throwaway one.
  [switch]$UseRunningInstance,
  # Connection for the target database.
  [string]$Host_ = "localhost",
  # 0 picks a free port automatically, which avoids colliding with another local
  # cluster and with the application's own test port.
  [int]$Port = 0,
  [string]$User_ = "postgres",
  [string]$Database = ""
)

$ErrorActionPreference = "Continue"
# This file lives in <repo>/clinic/scripts, so the parent is <repo>/clinic and the
# backend sits directly beneath it. Appending "clinic" again would look for
# clinic/clinic/backend and silently find nothing.
$root = Split-Path -Parent $PSScriptRoot
$backend = Join-Path $root "backend"

# Native tools (psql, initdb, pg_ctl) write notices and progress to stderr as a
# matter of course. With ErrorActionPreference = "Stop", Windows PowerShell 5.1 turns
# that into a terminating error, so a perfectly healthy server start would abort the
# script on a single NOTICE line. Success is judged on exit codes throughout.

function Find-PgBin {
  $onPath = Get-Command initdb -ErrorAction SilentlyContinue
  if ($onPath) { return (Split-Path -Parent $onPath.Source) }
  foreach ($major in @("18", "17", "16", "15", "14")) {
    $candidate = "C:\Program Files\PostgreSQL\$major\bin"
    if (Test-Path (Join-Path $candidate "initdb.exe")) { return $candidate }
  }
  throw "PostgreSQL not found. Install it, or pass -UseRunningInstance to target an existing server."
}

$pgBin = Find-PgBin
$tempRoot = Join-Path $env:TEMP ("clinic-pg-verify-" + [Guid]::NewGuid().ToString("N"))
$dataDir = Join-Path $tempRoot "data"
$logFile = Join-Path $tempRoot "server.log"
$startedHere = $false
$databaseCreated = $false
$app = $null
$savedEnvironment = @{}
$environmentKeys = @(
  "SPRING_PROFILES_ACTIVE", "SPRING_DATASOURCE_URL", "SPRING_DATASOURCE_USERNAME",
  "SPRING_DATASOURCE_PASSWORD", "SPRING_FLYWAY_ENABLED",
  "SPRING_JPA_HIBERNATE_DDL_AUTO", "APP_JWT_SECRET", "APP_RATE_LIMIT_ENABLED",
  "CORS_ALLOWED_ORIGINS", "PORT", "SUPER_ADMIN_NAME", "SUPER_ADMIN_EMAIL",
  "SUPER_ADMIN_PASSWORD"
)
foreach ($key in $environmentKeys) { $savedEnvironment[$key] = [Environment]::GetEnvironmentVariable($key, "Process") }

# Always use a fresh, uniquely named database. In particular, never drop a
# caller-supplied database when -UseRunningInstance is selected.
if ([string]::IsNullOrWhiteSpace($Database)) {
  $Database = "clinic_migration_check_$([Guid]::NewGuid().ToString('N').Substring(0, 12))"
}
if ($Database -notmatch '^[A-Za-z][A-Za-z0-9_]{0,62}$') {
  throw "Database name must be a simple PostgreSQL identifier."
}

# Asking the OS for a free port rather than hard-coding one: a fixed port collides
# with any other local PostgreSQL, and the resulting "could not create any TCP/IP
# sockets" error points at PostgreSQL rather than at the real cause.
if ($Port -eq 0) {
  $listener = New-Object System.Net.Sockets.TcpListener([System.Net.IPAddress]::Loopback, 0)
  $listener.Start()
  $Port = $listener.LocalEndpoint.Port
  $listener.Stop()
}

Write-Output "PostgreSQL binaries: $pgBin"
Write-Output "Port: $Port"

# ------------------------------------------------------------------ start server
if ($UseRunningInstance) {
  Write-Output "Using the running server on port $Port."
}
else {
  New-Item -ItemType Directory -Path $tempRoot | Out-Null

  Write-Output "Creating a throwaway cluster..."
  & (Join-Path $pgBin "initdb.exe") -D $dataDir -U $User_ -A trust --encoding=UTF8 --locale=C 2>&1 |
  Select-Object -Last 2
  if ($LASTEXITCODE -ne 0) { throw "initdb failed" }

  Write-Output "Starting on port $Port..."
  # Launched detached rather than with `pg_ctl ... start` inline. On Windows a
  # foreground pg_ctl can block the calling shell indefinitely, which reads as a
  # hung script rather than as a server that started. -w makes it wait for the
  # server to accept connections before returning, which is what we actually want.
  Start-Process -FilePath (Join-Path $pgBin "pg_ctl.exe") `
    -ArgumentList "-D `"$dataDir`" -l `"$logFile`" -o `"-p $Port -c listen_addresses=127.0.0.1`" -w start" `
    -NoNewWindow | Out-Null
  $startedHere = $true

  $ready = $false
  for ($i = 0; $i -lt 30; $i++) {
    Start-Sleep -Seconds 1
    $probe = Start-Job -ScriptBlock {
      param($exe, $a) & $exe @a 2>&1
    } -ArgumentList (Join-Path $pgBin "psql.exe"), @("-h", $Host_, "-p", "$Port", "-U", $User_, "-w", "-tAc", "SELECT 1")
    if (Wait-Job $probe -Timeout 10) {
      $r = Receive-Job $probe
      if ($r -match "1") { $ready = $true }
    }
    else {
      Stop-Job $probe
    }
    Remove-Job $probe -Force -ErrorAction SilentlyContinue
    if ($ready) { break }
  }
  if (-not $ready) { throw "the server did not become ready within 30s; see $logFile" }
}

$psql = Join-Path $pgBin "psql.exe"

# `-w` makes psql fail fast instead of blocking on an interactive password prompt.
# Without it, connecting to a password-protected server hangs the whole script
# forever, which is indistinguishable from a server that will not start.
$psqlArgs = @("-h", $Host_, "-p", "$Port", "-U", $User_, "-w")

function Invoke-Psql {
  param([string]$Sql, [string]$Database = $null)
  $a = @($psqlArgs)
  if ($Database) { $a += @("-d", $Database) }
  $a += @("-c", $Sql)
  $job = Start-Job -ScriptBlock { param($exe, $arguments) & $exe @arguments 2>&1 } `
    -ArgumentList $psql, $a
  try {
    if (Wait-Job $job -Timeout 30) { Receive-Job $job } else { Stop-Job $job; return "TIMEOUT" }
  }
  finally {
    Remove-Job $job -Force -ErrorAction SilentlyContinue
  }
}

try {
  Write-Output ""
  Write-Output "Creating an isolated check database..."
  $created = Invoke-Psql "CREATE DATABASE $Database;"
  if ($created -match "ERROR|TIMEOUT") { throw "could not create ${Database}: $created" }
  $databaseCreated = $true

  # ------------------------------------------------------------------- run the app
  $jar = Get-ChildItem (Join-Path $backend "target") -Filter "clinicl-*.jar" -ErrorAction SilentlyContinue |
  Select-Object -First 1
  if (-not $jar) {
    throw "No jar in backend\target. Run: mvn -o clean package -DskipTests"
  }

  $appPort = 8097
  $log = Join-Path $tempRoot "app.log"
  $err = Join-Path $tempRoot "app.err"

  Write-Output ""
  Write-Output "Starting the application against PostgreSQL..."
  $env:SPRING_PROFILES_ACTIVE = "prod"
  $env:SPRING_DATASOURCE_URL = "jdbc:postgresql://${Host_}:${Port}/${Database}"
  $env:SPRING_DATASOURCE_USERNAME = $User_
  # The throwaway local cluster uses trust auth. For -UseRunningInstance, this
  # value is passed to the app only; the database user must independently have
  # access to create and use the isolated database above.
  $env:SPRING_DATASOURCE_PASSWORD = if ([string]::IsNullOrEmpty($savedEnvironment["SPRING_DATASOURCE_PASSWORD"])) {
    [Guid]::NewGuid().ToString("N")
  } else { $savedEnvironment["SPRING_DATASOURCE_PASSWORD"] }
  $env:SPRING_FLYWAY_ENABLED = "true"
  $env:SPRING_JPA_HIBERNATE_DDL_AUTO = "validate"
  $env:APP_JWT_SECRET = [Convert]::ToBase64String((1..64 | ForEach-Object { Get-Random -Minimum 0 -Maximum 256 }))
  $env:APP_RATE_LIMIT_ENABLED = "false"
  $env:CORS_ALLOWED_ORIGINS = "http://localhost:3100"
  $env:PORT = "$appPort"
  $env:SUPER_ADMIN_NAME = "Migration Check"
  $env:SUPER_ADMIN_EMAIL = "migration-check@example.invalid"
  $env:SUPER_ADMIN_PASSWORD = [Guid]::NewGuid().ToString("N") + "!aA1"

  # Quote the jar path explicitly; the repository path contains spaces.
  $app = Start-Process -FilePath "java" `
    -ArgumentList "-jar `"$($jar.FullName)`"" `
    -WorkingDirectory $backend `
    -NoNewWindow -PassThru `
    -RedirectStandardOutput $log -RedirectStandardError $err

  $ready = $false
  for ($i = 0; $i -lt 90; $i++) {
    Start-Sleep -Seconds 2
    if ($app.HasExited) { break }
    try {
      $health = Invoke-RestMethod -Uri "http://localhost:$appPort/actuator/health/readiness" -TimeoutSec 3
      if ($health.status -eq "UP") { $ready = $true; break }
    }
    catch {}
  }

  Write-Output ""
  Write-Output "--- Flyway ---"
  Select-String -Path $log -Pattern "Migrating schema|Successfully applied|Current version" |
    ForEach-Object { $_.Line.Trim() }

  if (-not $ready) {
    Write-Output "Application did not become ready; sanitized startup diagnostics follow."
    Select-String -Path $log, $err -Pattern "ERROR|Caused by:|Migration V|Message    :" |
      Select-Object -First 20 | ForEach-Object { $_.Line.Trim() -replace '(?i)(password|secret|token|api.?key)\s*[=:]\s*[^ ,;]+', '$1=[redacted]' }
    throw "Application readiness failed while validating the isolated migration database."
  }

  Write-Output ""
  Write-Output "--- Applied migrations ---"
  Invoke-Psql "SELECT version || '  ' || description FROM flyway_schema_history ORDER BY installed_rank;" $Database
  Write-Output ""
  Write-Output "MIGRATIONS APPLIED CLEANLY against PostgreSQL, and the JPA model validates against the result."
}
finally {
  if ($app -and -not $app.HasExited) {
    Stop-Process -Id $app.Id -Force -ErrorAction SilentlyContinue
    Wait-Process -Id $app.Id -Timeout 10 -ErrorAction SilentlyContinue
  }

  if ($databaseCreated -and $UseRunningInstance) {
    # Cleanup is restricted to the unique database created by this invocation.
    Invoke-Psql "DROP DATABASE $Database;" | Out-Null
  }

  if ($startedHere -and (Test-Path $dataDir)) {
    Start-Process -FilePath (Join-Path $pgBin "pg_ctl.exe") `
      -ArgumentList "-D `"$dataDir`" -m fast stop" -NoNewWindow -Wait | Out-Null
  }

  foreach ($key in $environmentKeys) {
    [Environment]::SetEnvironmentVariable($key, $savedEnvironment[$key], "Process")
  }
}
