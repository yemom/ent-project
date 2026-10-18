#requires -Version 5
<#
    End-to-end rehearsal of the Reception → Appointments workflow against a running
    backend. Proves the flow the front desk uses: sign in, pick a real patient and a
    real doctor, book, read back, filter, reschedule, change status, cancel, and
    confirm persistence after a reload.

    Usage: powershell -File scripts/verify-appointments.ps1 -BaseUrl http://localhost:8090/api/v1
#>
param(
    [string]$BaseUrl = "http://localhost:8090/api/v1",
    [string]$AdminEmail = "reception.test@clinic.local",
    [string]$AdminPassword = "TestPassw0rd!2026"
)

$ErrorActionPreference = "Stop"
$script:pass = 0
$script:fail = 0

function Assert-True([bool]$Condition, [string]$Because, $Detail = $null) {
    if ($Condition) {
        $script:pass++
        Write-Host "  PASS  $Because" -ForegroundColor Green
    } else {
        $script:fail++
        Write-Host "  FAIL  $Because" -ForegroundColor Red
        if ($null -ne $Detail) { Write-Host "        $Detail" -ForegroundColor DarkGray }
    }
}

function Invoke-Api {
    param(
        [string]$Method,
        [string]$Path,
        [object]$Body = $null,
        [string]$Token = $script:token,
        [switch]$AllowStatus
    )
    $headers = @{ "Content-Type" = "application/json" }
    if ($Token) { $headers.Authorization = "Bearer $Token" }

    $params = @{
        Method = $Method
        Uri = "$BaseUrl$Path"
        Headers = $headers
        TimeoutSec = 30
    }
    if ($null -ne $Body) { $params.Body = ($Body | ConvertTo-Json -Depth 6 -Compress) }

    try {
        $response = Invoke-WebRequest @params -UseBasicParsing
        return [pscustomobject]@{ Status = [int]$response.StatusCode; Body = $response.Content }
    } catch {
        $status = 0
        $content = ""
        if ($_.Exception.Response) {
            $status = [int]$_.Exception.Response.StatusCode
            $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
            $content = $reader.ReadToEnd()
        }
        return [pscustomobject]@{ Status = $status; Body = $content }
    }
}

Write-Host "`n=== 1. Sign in as the administrator who provisions staff ===" -ForegroundColor Cyan

# The Super Admin is used only to provision accounts. It holds no
# `patient:register` and no clinical permission, so it is deliberately NOT used to
# drive the booking flow — that would prove nothing about the receptionist.
$login = Invoke-Api -Method POST -Path "/auth/login" -Body @{ email = $AdminEmail; password = $AdminPassword } -Token $null
Assert-True ($login.Status -eq 200) "sign in returns 200" "status=$($login.Status) body=$($login.Body)"
$adminToken = ($login.Body | ConvertFrom-Json).accessToken

Write-Host "`n=== 2. Provision a receptionist and a doctor ===" -ForegroundColor Cyan

$stamp = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
$staffPassword = "Schedul3Pass!"

$receptionist = Invoke-Api -Method POST -Path "/admin/users/accounts" -Token $adminToken -Body @{
    fullName = "Amina Yusuf"
    email = "reception.$stamp@clinic.local"
    password = $staffPassword
    role = "RECEPTIONIST"
}
Assert-True ($receptionist.Status -eq 201) "receptionist account created" "status=$($receptionist.Status) body=$($receptionist.Body)"
$receptionistEmail = "reception.$stamp@clinic.local"

$doctor = Invoke-Api -Method POST -Path "/admin/users/accounts" -Token $adminToken -Body @{
    fullName = "Dr Adaeze Okafor"
    email = "doctor.$stamp@clinic.local"
    password = $staffPassword
    role = "DOCTOR"
    specialization = "Cardiology"
    licenseNumber = "LIC-$stamp"
    yearsOfExperience = 9
    available = $true
}
Assert-True ($doctor.Status -eq 201) "doctor account created" "status=$($doctor.Status) body=$($doctor.Body)"
$doctorId = ($doctor.Body | ConvertFrom-Json).user.id

Write-Host "`n=== 3. The receptionist signs in ===" -ForegroundColor Cyan

$deskLogin = Invoke-Api -Method POST -Path "/auth/login" -Body @{ email = $receptionistEmail; password = $staffPassword } -Token $null
Assert-True ($deskLogin.Status -eq 200) "receptionist can sign in" "status=$($deskLogin.Status) body=$($deskLogin.Body)"
$script:token = ($deskLogin.Body | ConvertFrom-Json).accessToken
Assert-True (($deskLogin.Body | ConvertFrom-Json).user.role -eq "RECEPTIONIST") "the session really is a receptionist"

Write-Host "`n=== 4. Register the patients the appointment needs ===" -ForegroundColor Cyan

# Registration number is what lets reception tell two patients apart, so the
# booking flow has to carry it all the way to the appointment response.
$patient = Invoke-Api -Method POST -Path "/front-desk/patients" -Body @{
    fullName = "Wanjiru Kamau"
    email = "patient.$stamp@clinic.local"
    password = $staffPassword
    phone = "+254700000001"
    gender = "FEMALE"
    registrationNumber = "REG-$stamp"
}
Assert-True ($patient.Status -eq 201) "patient registered at the front desk" "status=$($patient.Status) body=$($patient.Body)"
$patientId = ($patient.Body | ConvertFrom-Json).id

$other = Invoke-Api -Method POST -Path "/front-desk/patients" -Body @{
    fullName = "Wanjiru Kamau"
    email = "patient.other.$stamp@clinic.local"
    password = $staffPassword
    phone = "+254700000002"
    registrationNumber = "REG-$stamp-B"
}
Assert-True ($other.Status -eq 201) "a second patient with the same name is registered" "status=$($other.Status)"
$otherPatientId = ($other.Body | ConvertFrom-Json).id

Write-Host "`n=== 5. Patient and doctor directories are readable ===" -ForegroundColor Cyan

$directory = Invoke-Api -Method GET -Path "/patients/search?fullName=Wanjiru&size=10"
Assert-True ($directory.Status -eq 200) "patient search returns 200" "status=$($directory.Status)"
$dirContent = ($directory.Body | ConvertFrom-Json).content
Assert-True ($dirContent.Count -ge 2) "search finds both patients with the same name" "count=$($dirContent.Count)"
Assert-True ($null -ne ($dirContent | Where-Object { $_.registrationNumber -eq "REG-$stamp" })) "the directory carries the registration number"

$doctorList = Invoke-Api -Method GET -Path "/doctors/search?active=true&size=100"
Assert-True ($doctorList.Status -eq 200) "doctor directory returns 200" "status=$($doctorList.Status)"
Assert-True (($doctorList.Body | ConvertFrom-Json).content.id -contains $doctorId) "the new doctor appears in the directory"

Write-Host "`n=== 6. Book an appointment ===" -ForegroundColor Cyan

$slot = (Get-Date).AddDays(3)
$slotIso = "{0}T09:00:00" -f $slot.ToString("yyyy-MM-dd")

$book = Invoke-Api -Method POST -Path "/appointments" -Body @{
    patientId = $patientId
    doctorId = $doctorId
    appointmentDate = $slotIso
    duration = 30
    reasonForVisit = "Annual check-up"
    notes = "First visit"
}
Assert-True ($book.Status -eq 201) "appointment created (201)" "status=$($book.Status) body=$($book.Body)"
$appointment = $book.Body | ConvertFrom-Json
Write-Host "        booked $($appointment.id)"

Assert-True ($appointment.status -eq "SCHEDULED") "a new booking starts SCHEDULED" "status=$($appointment.status)"
Assert-True ($appointment.patient.id -eq $patientId) "the response names the patient"
Assert-True ($appointment.patient.registrationNumber -eq "REG-$stamp") "the response carries the registration number" "got=$($appointment.patient.registrationNumber)"
Assert-True ($appointment.doctor.id -eq $doctorId) "the response names the doctor"
Assert-True ($appointment.doctor.specialization -ne $null) "the response carries the specialisation" "got=$($appointment.doctor.specialization)"

Write-Host "`n=== 7. It persists and survives a reload ===" -ForegroundColor Cyan

$list = Invoke-Api -Method GET -Path "/appointments?size=50"
$persisted = ($list.Body | ConvertFrom-Json).content | Where-Object { $_.id -eq $appointment.id }
Assert-True ($null -ne $persisted) "the appointment is in the listing after a fresh read"
Assert-True ($persisted.patient.registrationNumber -eq "REG-$stamp") "and still carries the registration number"

$single = Invoke-Api -Method GET -Path "/appointments/$($appointment.id)"
Assert-True ($single.Status -eq 200) "it is readable by id" "status=$($single.Status)"

Write-Host "`n=== 8. Booking rules are enforced by the server ===" -ForegroundColor Cyan

$overlap = Invoke-Api -Method POST -Path "/appointments" -Body @{
    patientId = $otherPatientId
    doctorId = $doctorId
    appointmentDate = ("{0}T09:15:00" -f $slot.ToString("yyyy-MM-dd"))
    duration = 30
}
Assert-True ($overlap.Status -eq 409) "an overlapping booking is refused with 409" "status=$($overlap.Status) body=$($overlap.Body)"
Assert-True (($overlap.Body | ConvertFrom-Json).message -match "already booked") "and the message names the conflict" "$($overlap.Body)"

$adjacent = Invoke-Api -Method POST -Path "/appointments" -Body @{
    patientId = $otherPatientId
    doctorId = $doctorId
    appointmentDate = ("{0}T09:30:00" -f $slot.ToString("yyyy-MM-dd"))
    duration = 30
}
Assert-True ($adjacent.Status -eq 201) "a slot starting as the previous one ends is accepted" "status=$($adjacent.Status)"

$past = Invoke-Api -Method POST -Path "/appointments" -Body @{
    patientId = $patientId
    doctorId = $doctorId
    appointmentDate = "2020-01-01T09:00:00"
    duration = 30
}
Assert-True ($past.Status -eq 400) "a backdated booking is refused with 400" "status=$($past.Status)"

$badStatus = Invoke-Api -Method POST -Path "/appointments" -Body @{
    patientId = $patientId
    doctorId = $doctorId
    appointmentDate = ("{0}T11:00:00" -f $slot.ToString("yyyy-MM-dd"))
    duration = 30
    status = "PENDING"
}
Assert-True ($badStatus.Status -eq 400) "an unknown status is refused with 400" "status=$($badStatus.Status)"
Assert-True (($badStatus.Body | ConvertFrom-Json).message -match "SCHEDULED") "and the message lists the valid statuses" "$($badStatus.Body)"

$missing = Invoke-Api -Method POST -Path "/appointments" -Body @{
    patientId = "00000000-0000-0000-0000-000000000000"
    doctorId = $doctorId
    appointmentDate = ("{0}T11:00:00" -f $slot.ToString("yyyy-MM-dd"))
    duration = 30
}
Assert-True ($missing.Status -eq 404) "an unknown patient is refused with 404" "status=$($missing.Status)"

$incomplete = Invoke-Api -Method POST -Path "/appointments" -Body @{
    doctorId = $doctorId
    appointmentDate = ("{0}T11:00:00" -f $slot.ToString("yyyy-MM-dd"))
}
Assert-True ($incomplete.Status -eq 400) "a missing patient id is refused with 400" "status=$($incomplete.Status)"

Write-Host "`n=== 9. Filtering ===" -ForegroundColor Cyan

$byStatus = Invoke-Api -Method GET -Path "/appointments/search?status=SCHEDULED&size=50"
Assert-True ($byStatus.Status -eq 200) "status filter returns 200" "status=$($byStatus.Status)"
$matched = @(($byStatus.Body | ConvertFrom-Json).content | Where-Object { $_.id -eq $appointment.id })
Assert-True ($matched.Count -eq 1) "the booking matches its own status" "count=$($matched.Count)"

$byDoctor = Invoke-Api -Method GET -Path "/appointments/search?doctorId=$doctorId&size=50"
$doctorRows = @((($byDoctor.Body | ConvertFrom-Json).content))
Assert-True ($doctorRows.Count -eq 2) "doctor filter returns both of that doctor's bookings" "count=$($doctorRows.Count)"

$byPatient = Invoke-Api -Method GET -Path "/appointments/search?patientId=$patientId&size=50"
$patientRows = @((($byPatient.Body | ConvertFrom-Json).content))
Assert-True ($patientRows.Count -eq 1) "patient filter returns only that patient's" "count=$($patientRows.Count)"

$byDate = Invoke-Api -Method GET -Path "/appointments/search?from=$($slot.ToString('yyyy-MM-dd'))T00:00:00&to=$($slot.ToString('yyyy-MM-dd'))T23:59:59&size=50"
Assert-True ($byDate.Status -eq 200) "date-range filter returns 200" "status=$($byDate.Status)"

$byKeyword = Invoke-Api -Method GET -Path "/appointments/search?keyword=Annual&size=50"
$keywordRows = @((($byKeyword.Body | ConvertFrom-Json).content))
Assert-True ($keywordRows.Count -ge 1) "keyword filter matches the reason for visit" "count=$($keywordRows.Count)"

Write-Host "`n=== 10. Reschedule ===" -ForegroundColor Cyan

$reschedule = Invoke-Api -Method PUT -Path "/appointments/$($appointment.id)" -Body @{
    appointmentDate = ("{0}T14:00:00" -f $slot.ToString("yyyy-MM-dd"))
    duration = 45
}
Assert-True ($reschedule.Status -eq 200) "reschedule returns 200" "status=$($reschedule.Status) body=$($reschedule.Body)"
$rescheduled = $reschedule.Body | ConvertFrom-Json
Assert-True ($rescheduled.appointmentDate -match "14:00") "the new time is stored" "got=$($rescheduled.appointmentDate)"
Assert-True ($rescheduled.duration -eq 45) "the new duration is stored" "got=$($rescheduled.duration)"

$clash = Invoke-Api -Method PUT -Path "/appointments/$($appointment.id)" -Body @{
    appointmentDate = ("{0}T09:20:00" -f $slot.ToString("yyyy-MM-dd"))
}
Assert-True ($clash.Status -eq 409) "rescheduling onto an occupied slot is refused with 409" "status=$($clash.Status)"

$statusViaUpdate = Invoke-Api -Method PUT -Path "/appointments/$($appointment.id)" -Body @{ status = "COMPLETED" }
Assert-True ($statusViaUpdate.Status -eq 400) "status cannot be smuggled through the reschedule endpoint" "status=$($statusViaUpdate.Status)"

Write-Host "`n=== 11. Lifecycle ===" -ForegroundColor Cyan

$confirm = Invoke-Api -Method PUT -Path "/appointments/$($appointment.id)/status" -Body @{ status = "CONFIRMED" }
Assert-True ($confirm.Status -eq 200 -and ($confirm.Body | ConvertFrom-Json).status -eq "CONFIRMED") "SCHEDULED -> CONFIRMED"

$skip = Invoke-Api -Method PUT -Path "/appointments/$($appointment.id)/status" -Body @{ status = "NO_SHOW" }
Assert-True ($skip.Status -eq 200) "CONFIRMED -> NO_SHOW"

$revive = Invoke-Api -Method PUT -Path "/appointments/$($appointment.id)/status" -Body @{ status = "SCHEDULED" }
Assert-True ($revive.Status -eq 200) "NO_SHOW -> SCHEDULED (the desk can correct a mistake)"

$cancelViaStatus = Invoke-Api -Method PUT -Path "/appointments/$($appointment.id)/status" -Body @{ status = "CANCELLED"; reason = "Patient called" }
Assert-True ($cancelViaStatus.Status -eq 200) "SCHEDULED -> CANCELLED"
$cancelled = $cancelViaStatus.Body | ConvertFrom-Json
Assert-True ($cancelled.cancellationReason -eq "Patient called") "the cancellation reason is recorded" "got=$($cancelled.cancellationReason)"
Assert-True ($null -ne $cancelled.cancelledBy) "the cancelling role is recorded" "got=$($cancelled.cancelledBy)"

$completeCancelled = Invoke-Api -Method PUT -Path "/appointments/$($appointment.id)/status" -Body @{ status = "COMPLETED" }
Assert-True ($completeCancelled.Status -eq 400) "a cancelled appointment cannot jump to COMPLETED" "status=$($completeCancelled.Status)"

Write-Host "`n=== 12. Cancellation frees the slot ===" -ForegroundColor Cyan

$rebook = Invoke-Api -Method POST -Path "/appointments" -Body @{
    patientId = $patientId
    doctorId = $doctorId
    appointmentDate = ("{0}T14:00:00" -f $slot.ToString("yyyy-MM-dd"))
    duration = 45
}
Assert-True ($rebook.Status -eq 201) "the slot a cancelled booking held can be booked again" "status=$($rebook.Status) body=$($rebook.Body)"
$rebookedId = ($rebook.Body | ConvertFrom-Json).id

Assert-True ($null -ne $rebookedId) "the rebooking returned an id" "id=$rebookedId"
$cancel = Invoke-Api -Method DELETE -Path "/appointments/$($rebookedId)?reason=Test%20teardown"
Assert-True ($cancel.Status -eq 204) "cancel returns 204" "status=$($cancel.Status)"

$afterCancel = Invoke-Api -Method GET -Path "/appointments/$($rebookedId)"
Assert-True ($afterCancel.Status -eq 200) "a cancelled appointment is kept, not deleted" "status=$($afterCancel.Status)"
Assert-True (($afterCancel.Body | ConvertFrom-Json).status -eq "CANCELLED") "and reads back as cancelled"

Write-Host "`n=== 13. Role boundaries ===" -ForegroundColor Cyan

$patientLogin = Invoke-Api -Method POST -Path "/auth/login" -Body @{ email = "patient.$stamp@clinic.local"; password = $staffPassword } -Token $null
$patientToken = ($patientLogin.Body | ConvertFrom-Json).accessToken
Assert-True ($null -ne $patientToken) "the registered patient can sign in"

$patientOwn = Invoke-Api -Method GET -Path "/appointments/$($appointment.id)" -Token $patientToken
Assert-True ($patientOwn.Status -eq 200) "a patient can open their own appointment" "status=$($patientOwn.Status)"

$otherBooking = Invoke-Api -Method GET -Path "/appointments" -Token $patientToken
$otherIds = ($otherBooking.Body | ConvertFrom-Json).content | Where-Object { $_.patient.id -ne $patientId }
if ($otherIds) {
    $foreign = Invoke-Api -Method GET -Path "/appointments/$($otherIds[0].id)" -Token $patientToken
    Assert-True ($foreign.Status -eq 403) "a patient is refused another patient's appointment" "status=$($foreign.Status)"
}

$patientBookingForOther = Invoke-Api -Method POST -Path "/appointments" -Token $patientToken -Body @{
    patientId = $otherPatientId
    doctorId = $doctorId
    appointmentDate = ("{0}T16:00:00" -f $slot.ToString("yyyy-MM-dd"))
    duration = 30
}
Assert-True ($patientBookingForOther.Status -eq 403) "a patient cannot book on someone else's behalf" "status=$($patientBookingForOther.Status)"

$patientStatus = Invoke-Api -Method PUT -Path "/appointments/$($appointment.id)/status" -Token $patientToken -Body @{ status = "CONFIRMED" }
Assert-True ($patientStatus.Status -eq 403) "a patient cannot move an appointment through its lifecycle" "status=$($patientStatus.Status)"

$patientRecords = Invoke-Api -Method GET -Path "/medical-records" -Token $patientToken
Assert-True ($patientRecords.Status -eq 403) "a patient still cannot reach clinical records" "status=$($patientRecords.Status)"

$anon = Invoke-Api -Method GET -Path "/appointments" -Token "not-a-token"
Assert-True ($anon.Status -eq 401) "an unauthenticated caller gets 401" "status=$($anon.Status)"

Write-Host "`n=========================================" -ForegroundColor Cyan
Write-Host " passed: $script:pass    failed: $script:fail" -ForegroundColor $(if ($script:fail -eq 0) { "Green" } else { "Red" })
Write-Host "=========================================" -ForegroundColor Cyan

if ($script:fail -gt 0) { exit 1 }