#!/usr/bin/env pwsh
#
# Runs every check that has to pass before this is deployable, in the order that
# fails fastest. Each stage stops the script, so you never read a green frontend
# build while the backend is actually broken.
#
# Usage from the repository root:
#   ./scripts/verify-all.ps1
#
# Super Admin credentials are required for the end-to-end suites and are read from
# the environment (or backend/.env.local). They are never written into the repository;
# see the note in e2e-start-and-run.ps1.
param(
  # Skips the suites that need a running backend and a browser.
  [switch]$SkipE2E
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$failures = @()

# Refuses to start if a dev server, a build or a stale backend is already running.
# A leftover Next.js dev server shares `.next` with `next build` and turns a clean
# source tree into a build failure with an ENOENT that looks like a source bug.
$preflight = Join-Path $PSScriptRoot "preflight.ps1"
if (Test-Path $preflight) {
  Write-Output "Running preflight..."
  & $preflight
  if ($LASTEXITCODE -ne 0) { exit 1 }
}

function Stage {
  param([string]$Name, [string]$Dir, [scriptblock]$Body)
  Write-Output ""
  Write-Output "=============================================================="
  Write-Output "  $Name"
  Write-Output "=============================================================="
  Push-Location (Join-Path $root $Dir)
  # Native commands write progress and warnings to stderr. With
  # ErrorActionPreference = "Stop" PowerShell turns that into a terminating error,
  # so a perfectly successful `mvn test` would be reported as failed purely because
  # a Java agent printed a WARNING. Success is therefore judged only on the exit
  # code, and stderr is allowed through untouched.
  $previousPreference = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  try {
    & $Body
    if ($LASTEXITCODE -ne 0) { throw "$Name failed (exit $LASTEXITCODE)" }
  } catch {
    Write-Output "FAILED: $($_.Exception.Message)"
    $script:failures += $Name
  } finally {
    $ErrorActionPreference = $previousPreference
    Pop-Location
  }
}

# --------------------------------------------------------------------- backend

Stage -Name "Backend: mvn clean test" -Dir "backend" -Body {
  # `clean` is not optional. A stale target/classes masks real compiler errors behind
  # confusing runtime failures, which is the single most expensive trap in this build.
  mvn -o clean test
}

Stage -Name "Backend: package" -Dir "backend" -Body { mvn -o clean package -DskipTests }

if ($SkipE2E) {
  Write-Output ""
  Write-Output "Skipping end-to-end suites (-SkipE2E)."
} else {
  Stage -Name "Backend: API end-to-end suite" -Dir "backend" -Body {
    # The suite boots the backend itself so the run starts from an empty in-memory
    # database; without that, the second run collides with the first run's accounts.
    #
    # The rate limiter is disabled: this suite fires several hundred requests in a
    # couple of minutes against one account, which a limiter tuned for human traffic
    # correctly rejects with 429. That protection belongs in production, not in a
    # test run.
    $env:APP_RATE_LIMIT_ENABLED = "false"
    & ./e2e-start-and-run.ps1
  }
}

# -------------------------------------------------------------------- frontend

Stage -Name "Frontend: typecheck" -Dir "frontend" -Body { npx tsc --noEmit }

Stage -Name "Frontend: production build" -Dir "frontend" -Body {
  # Deletes .next first: a stale incremental cache produces errors that do not exist
  # in the source, and successes that do not either.
  Remove-Item -Recurse -Force .next -ErrorAction SilentlyContinue
  npm run build
}

if (-not $SkipE2E) {
  Stage -Name "Frontend: Playwright end-to-end suite" -Dir "frontend" -Body {
    npx playwright test
  }
}

# ---------------------------------------------------------------------- summary

Write-Output ""
Write-Output "=============================================================="
if ($failures.Count -eq 0) {
  Write-Output "  ALL CHECKS PASSED"
  Write-Output "=============================================================="
  exit 0
}

Write-Output "  FAILED STAGES ($($failures.Count)):"
$failures | ForEach-Object { Write-Output "    - $_" }
Write-Output "=============================================================="
exit 1
