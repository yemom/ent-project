#requires -Version 5
<#
    .SYNOPSIS
    Cross-checks every endpoint the frontend can call against a running backend.

    .DESCRIPTION
    Answers "which request is producing the 404?" with a list instead of a guess.

    Every API path literal used under frontend/src is probed. Only a 404 or a 5xx is
    treated as a defect; a 403 is the role matrix working, and a 400/415 is the API
    rejecting the deliberately empty probe body.

    The last check greps the auth client for /auth/forgot-password. The server has
    never mapped that route, so a client that still calls it can only produce a 404
    in the browser console.

    .EXAMPLE
    powershell -ExecutionPolicy Bypass -File scripts/audit-endpoints.ps1
#>
param(
    [string]$BaseUrl = "http://localhost:8090/api/v1",
    [string]$Email = "reception.test@clinic.local",
    [string]$Password = "TestPassw0rd!2026"
)

$ErrorActionPreference = 'Stop'

$login = Invoke-RestMethod -Method Post -Uri "$BaseUrl/auth/login" -ContentType "application/json" `
    -Body (@{ email = $Email; password = $Password } | ConvertTo-Json -Compress)
$headers = @{ Authorization = "Bearer $($login.accessToken)" }
$jsonHeaders = $headers.Clone()
$jsonHeaders['Content-Type'] = 'application/json'

$origin = $BaseUrl -replace '/api/v1$', ''

# label, method, path. Paths under /api/ are resolved against the origin because the
# laboratory controllers are mapped outside the /v1 prefix.
$endpoints = @(
    @('auth login', 'POST', '/auth/login'),
    @('auth register', 'POST', '/auth/register'),
    @('auth refresh', 'POST', '/auth/refresh'),
    @('auth me', 'GET', '/auth/me'),
    @('admin users', 'GET', '/admin/users?size=1'),
    @('admin users search', 'GET', '/admin/users/search?size=1'),
    @('admin permissions', 'GET', '/admin/permissions'),
    @('admin audit logs', 'GET', '/admin/audit-logs?size=1'),
    @('admin role requests', 'GET', '/admin/role-requests?page=0&size=1'),
    @('admin global search', 'GET', '/admin/search?q=a&limit=1'),
    @('appointments', 'GET', '/appointments?size=1'),
    @('appointments search', 'GET', '/appointments/search?size=1'),
    @('doctors', 'GET', '/doctors?size=1'),
    @('doctors search', 'GET', '/doctors/search?size=1'),
    @('patients', 'GET', '/patients?size=1'),
    @('patients search', 'GET', '/patients/search?size=1'),
    @('front-desk doctors', 'GET', '/front-desk/doctors'),
    @('front-desk nurses', 'GET', '/front-desk/nurses'),
    @('front-desk patient', 'GET', '/front-desk/patients/00000000-0000-0000-0000-000000000000'),
    @('medical records', 'GET', '/medical-records?size=1'),
    @('medical records search', 'GET', '/medical-records/search?size=1'),
    @('prescription orders', 'GET', '/prescription-orders?page=0&size=1'),
    @('presc orders by doctor', 'GET', '/prescription-orders/filter/by-doctor/00000000-0000-0000-0000-000000000000?page=0&size=1'),
    @('notifications', 'GET', '/notifications?size=1'),
    @('notifications count', 'GET', '/notifications/unread-count'),
    @('billing invoices', 'GET', '/billing/invoices?size=1'),
    @('billing payments', 'GET', '/billing/payments?size=1'),
    @('billing receipts', 'GET', '/billing/receipts?size=1'),
    @('billing summary', 'GET', '/billing/summary'),
    @('billing refunds', 'GET', '/billing/refunds?size=1'),
    @('branches', 'GET', '/branches?page=0&size=1'),
    @('branches search', 'GET', '/branches/search?page=0&size=1'),
    @('hospital departments', 'GET', '/hospital/departments'),
    @('hospital wards', 'GET', '/hospital/wards?size=1'),
    @('hospital rooms', 'GET', '/hospital/rooms?size=1'),
    @('hospital admissions', 'GET', '/hospital/admissions?size=1'),
    @('hospital open admissions', 'GET', '/hospital/admissions/open'),
    @('nursing observations', 'GET', '/nursing/observations?size=1'),
    @('pharmacy medicines', 'GET', '/pharmacy/medicines?size=1'),
    @('pharmacy categories', 'GET', '/pharmacy/categories'),
    @('pharmacy batches', 'GET', '/pharmacy/batches?size=1'),
    @('pharmacy movements', 'GET', '/pharmacy/movements?size=1'),
    @('pharmacy suppliers', 'GET', '/pharmacy/suppliers'),
    @('pharmacy alerts', 'GET', '/pharmacy/alerts'),
    @('pharmacy summary', 'GET', '/pharmacy/summary'),
    @('stats hospital', 'GET', '/stats/hospital'),
    @('laboratories', 'GET', '/laboratories?size=1'),
    @('laboratories search', 'GET', '/laboratories/search?size=1'),
    @('doctor availability', 'GET', '/doctor-availability?size=1'),
    @('availability by doctor', 'GET', '/doctor-availability/doctor/00000000-0000-0000-0000-000000000000'),
    @('lab orders', 'GET', '/api/lab-orders?size=1'),
    @('lab results', 'GET', '/api/lab-results?size=1'),
    @('lab notifications', 'GET', '/api/lab-notifications?userId=00000000-0000-0000-0000-000000000000')
)

$ok = @()
$forbidden = @()
$rejected = @()
$notFound = @()

foreach ($endpoint in $endpoints) {
    $label, $method, $path = $endpoint
    $uri = if ($path.StartsWith('/api/')) { "$origin$path" } else { "$BaseUrl$path" }

    try {
        $params = @{
            Method = $method
            Uri = $uri
            Headers = $jsonHeaders
            UseBasicParsing = $true
            TimeoutSec = 20
        }
        if ($method -eq 'POST') { $params.Body = '{}' }

        $response = Invoke-WebRequest @params
        $ok += "{0,-26} {1} {2} {3}" -f $label, $response.StatusCode, $method, $path
    } catch {
        $status = [int]$_.Exception.Response.StatusCode
        # A missing route or a server fault is a defect. 403 is the permission matrix
        # working. 400/415 is the API rejecting the deliberately empty probe body.
        if ($status -eq 404 -or $status -ge 500) {
            $notFound += "{0,-26} {1} {2} {3}" -f $label, $status, $method, $path
        } elseif ($status -eq 403) {
            $forbidden += "{0,-26} {1} {2} {3}" -f $label, $status, $method, $path
        } else {
            $rejected += "{0,-26} {1} {2} {3} (rejected by validation)" -f $label, $status, $method, $path
        }
    }
}

# The auth client must not call /auth/forgot-password: the server has never mapped
# it, so such a call can only ever surface as a 404 in the browser console.
$authService = Join-Path $PSScriptRoot '..\frontend\src\services\api\auth.ts'
$callsMissingRoute = Select-String -Path $authService -Pattern "'/auth/forgot-password'" -Quiet

Write-Host ("`n--- 200 / 2xx ({0}) ---" -f $ok.Count) -ForegroundColor Green
$ok | ForEach-Object { Write-Host "  $_" }

Write-Host ("`n--- 403 role gate, working as designed ({0}) ---" -f $forbidden.Count) -ForegroundColor Yellow
$forbidden | ForEach-Object { Write-Host "  $_" }

Write-Host ("`n--- rejected by validation ({0}) ---" -f $rejected.Count) -ForegroundColor DarkGray
$rejected | ForEach-Object { Write-Host "  $_" }

Write-Host ("`n--- 404 / 5xx ({0}) ---" -f $notFound.Count) -ForegroundColor Red
$notFound | ForEach-Object { Write-Host "  $_" }

Write-Host ("`nfrontend still calls POST /auth/forgot-password: {0}" -f $callsMissingRoute)
if ($callsMissingRoute) {
    $notFound += 'frontend/src/services/api/auth.ts still calls POST /auth/forgot-password'
}

if ($notFound.Count -gt 0) { exit 1 }
Write-Host "`nAll frontend-reachable endpoints resolve." -ForegroundColor Green