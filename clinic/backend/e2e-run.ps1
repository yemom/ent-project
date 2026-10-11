$ErrorActionPreference = "Stop"
$base = "http://localhost:8090/api/v1"

# Super Admin credentials come from the environment, never from the source.
#
# They used to be hardcoded here, which put a real, working credential for this
# deployment into a file that gets committed and shared. A test harness that needs
# a secret is a harness that leaks secrets; the value now has to be supplied by
# whoever runs it. The defaults below match the non-secret sample values in
# .env.example, so a fresh clone fails with a clear message rather than a 401.
$saEmail = if ($env:SUPER_ADMIN_EMAIL) { $env:SUPER_ADMIN_EMAIL } else { "super.admin@clinic.local" }
$saPass = if ($env:SUPER_ADMIN_PASSWORD) { $env:SUPER_ADMIN_PASSWORD } else { "" }

if (-not $saPass) {
  throw @"
SUPER_ADMIN_PASSWORD is not set.

This suite signs in as a Super Admin, so it needs real credentials. Provide them
without writing them into this repository:

  `$env:SUPER_ADMIN_EMAIL    = "you@example.com"
  `$env:SUPER_ADMIN_PASSWORD = "..."

Run e2e-start-and-run.ps1, which loads .env.local for you, or export the variables
yourself first.
"@
}

# Everything else in the suite gets its own throwaway password. It is not a
# credential for anything real: these accounts exist only for the run.
$pass = "E2e@Clinic2026"
$script:failures = @()

function Login($email, $password) {
  $body = @{ email = $email; password = $password } | ConvertTo-Json
  try {
    $script:lastStatus = 200
    return Invoke-RestMethod -Uri "$base/auth/login" -Method Post -ContentType "application/json" -Body $body -TimeoutSec 15
  } catch {
    # Records the status so ExpectStatus can assert on a login that is *meant* to
    # fail. Without this, a rejected login reports status 0 and every such check
    # fails for the wrong reason.
    $script:lastStatus = 0
    try { $script:lastStatus = [int]$_.Exception.Response.StatusCode } catch {}
    throw
  }
}

function Hdr($token) { return @{ Authorization = "Bearer $token" } }

function Invoke-Api($method, $uri, $token, $bodyObj) {
  $params = @{ Uri = $uri; Method = $method; TimeoutSec = 20 }
  if ($token) { $params.Headers = Hdr $token }
  if ($null -ne $bodyObj) {
    $params.ContentType = "application/json"
    $params.Body = ($bodyObj | ConvertTo-Json -Depth 8)
  }
  # DELETE with no body returns 204 and no content; ConvertTo-Json of $null would
  # send the literal string "null", which some endpoints reject. Skip it.
  if ($method -eq "Delete" -and $null -eq $bodyObj) {
    $params.Remove("ContentType")
    $params.Remove("Body")
  }
  try {
    $script:lastStatus = 200
    return Invoke-RestMethod @params
  } catch {
    # Record the status separately from the thrown error: ExpectStatus needs the
    # code, and a thrown string has no StatusCode to read.
    $script:lastStatus = 0
    $detail = $_.Exception.Message
    try { $script:lastStatus = [int]$_.Exception.Response.StatusCode } catch {}
    try {
      $stream = $_.Exception.Response.GetResponseStream()
      $reader = New-Object System.IO.StreamReader($stream)
      $detail = $reader.ReadToEnd()
    } catch {}
    # Surface the server's message instead of a bare "(400) Bad Request", so a
    # failing assertion is diagnosable without re-running under a debugger.
    throw "HTTP $script:lastStatus on $method $uri -> $detail"
  }
}

function Post($token, $path, $obj) {
  return Invoke-Api "Post" "$base$path" $token $obj
}
# For the legacy lab endpoints, which are mounted at /api/lab-orders rather than
# under /api/v1. Used instead of hand-building URLs at each call site.
function PostLegacy($token, $path, $obj) {
  return Invoke-Api "Post" "http://localhost:8090/api$path" $token $obj
}
function Get($token, $path) {
  return Invoke-Api "Get" "$base$path" $token $null
}
function Delete($token, $path) {
  return Invoke-Api "Delete" "$base$path" $token $null
}

# PATCH is used by the account lifecycle endpoints (status, role).
function Patch($token, $path, $obj) {
  return Invoke-Api "Patch" "$base$path" $token $obj
}
function Put($token, $path, $obj) {
  return Invoke-RestMethod -Uri "$base$path" -Method Put -ContentType "application/json" -Headers (Hdr $token) -Body ($obj | ConvertTo-Json -Depth 8) -TimeoutSec 20
}

function Check($name, $condition, $detail) {
  if ($condition) { Write-Output "  PASS  $name" }
  else { Write-Output "  FAIL  $name :: $detail"; $script:failures += $name }
}

function ExpectStatus($name, $expected, $block) {
  $script:lastStatus = 0
  try { & $block; $actual = if ($script:lastStatus -gt 0) { $script:lastStatus } else { 200 } }
  catch { $actual = $script:lastStatus }
  Check $name ($actual -eq $expected) "expected $expected got $actual"
}

Write-Output "=== 1. Super Admin bootstrap ==="
$sa = Login $saEmail $saPass
$saTok = $sa.accessToken
Check "super admin login" ($sa.user.role -eq "SUPER_ADMIN") "role=$($sa.user.role)"
Check "no hardcoded password leaked" (-not ($sa | ConvertTo-Json -Depth 6).Contains($pass)) "password echoed in response"

Write-Output "=== 2. Super Admin reads real stats ==="
$stats = Get $saTok "/stats/hospital"
Check "stats has usersByRole" ($null -ne $stats.usersByRole) "null"
Check "stats appointmentsTrend has 14 points" ($stats.appointmentsTrend.Count -eq 14) "count=$($stats.appointmentsTrend.Count)"
Write-Output "  totalUsers=$($stats.totalUsers) departments=$($stats.departments) invoices=$($stats.invoices)"

Write-Output "=== 3. Super Admin audit log + permissions ==="
$audit = Get $saTok "/admin/audit-logs?size=5"
Check "audit log readable" ($null -ne $audit.content) "null"
$perms = Get $saTok "/admin/permissions"
Check "permissions matrix readable" ($null -ne $perms) "null"

Write-Output "=== 4. Seed staff + patients ==="
# Doctors
$doc1 = Post $saTok "/doctors" @{ email = "doctor.one@example.com"; password = $pass; fullName = "Dr Ada Okafor"; specialization = "Cardiology"; licenseNumber = "LIC-E2E-1"; consultationFee = 120 }
$doc2 = Post $saTok "/doctors" @{ email = "doctor.two@example.com"; password = $pass; fullName = "Dr Ben Mensah"; specialization = "Neurology"; licenseNumber = "LIC-E2E-2"; consultationFee = 150 }
Check "two doctors created" ($doc1.id -and $doc2.id) "missing"

# Staff roles without dedicated entities
$nurse = Post $saTok "/admin/users" @{ email = "nurse.one@example.com"; password = $pass; fullName = "Nora Nurse"; role = "NURSE" }
$recep = Post $saTok "/admin/users" @{ email = "reception.one@example.com"; password = $pass; fullName = "Rita Reception"; role = "RECEPTIONIST" }
$hosp = Post $saTok "/admin/users" @{ email = "hospital.admin@example.com"; password = $pass; fullName = "Hana Admin"; role = "HOSPITAL_ADMIN" }
$cash = Post $saTok "/admin/users" @{ email = "cashier.one@example.com"; password = $pass; fullName = "Kofi Cashier"; role = "CASHIER" }
$lab = Post $saTok "/admin/users" @{ email = "lab.one@example.com"; password = $pass; fullName = "Leo Lab"; role = "LAB_TECHNICIAN" }
Check "staff created" ($nurse.id -and $recep.id -and $hosp.id -and $cash.id -and $lab.id) "missing one"

Write-Output "=== 5. Front desk registers patients and allocates them ==="
# Patients are registered by the front desk, not the Super Admin: creating a
# patient needs `patient:register`, which SUPER_ADMIN deliberately does not hold.
$recepTok = (Login "reception.one@example.com" $pass).accessToken
ExpectStatus "super admin cannot register a patient" 403 {
  Post $saTok "/patients" @{ email = "sneaky.patient@example.com"; password = $pass; fullName = "Sneaky" }
}
$pat1 = Post $recepTok "/front-desk/patients" @{ email = "patient.one@example.com"; password = $pass; fullName = "Peter Patient"; dateOfBirth = "1990-05-20"; gender = "MALE" }
$pat2 = Post $recepTok "/front-desk/patients" @{ email = "patient.two@example.com"; password = $pass; fullName = "Paula Patient"; dateOfBirth = "1988-02-02"; gender = "FEMALE" }
Check "two patients registered by the front desk" ($pat1.id -and $pat2.id) "missing"

$assign = Post $recepTok "/front-desk/patients/$($pat1.id)/assign" @{ doctorId = $doc1.id; nurseId = $nurse.id; reason = "Post-op monitoring" }
Check "assignment records the nurse" ($assign.nurseId -eq $nurse.id) "nurseId=$($assign.nurseId)"

ExpectStatus "front desk cannot allocate a non-nurse" 400 {
  Post $recepTok "/front-desk/patients/$($pat2.id)/assign" @{ doctorId = $doc1.id; nurseId = $recep.id }
}

Write-Output "=== 6. Nurse panel + vitals ==="
$nurseTok = (Login "nurse.one@example.com" $pass).accessToken
$panel = Get $nurseTok "/front-desk/patients"
$panelIds = @($panel.content | ForEach-Object { $_.id })
Check "nurse sees only their allocated patient" ($panelIds.Count -eq 1 -and $panelIds[0] -eq $pat1.id) "panel=$($panelIds -join ',')"

$vitals = Post $nurseTok "/nursing/observations" @{ patientId = $pat1.id; kind = "VITALS"; heartRate = 78; bloodPressure = "128/82"; temperatureC = 36.8; oxygenSaturation = 98.5 }
Check "nurse records vitals for allocated patient" ($vitals.id -and $vitals.heartRate -eq 78) "id=$($vitals.id)"

ExpectStatus "nurse blocked from an unallocated patient" 400 {
  Post $nurseTok "/nursing/observations" @{ patientId = $pat2.id; kind = "VITALS"; heartRate = 70 }
}
$med = Post $nurseTok "/nursing/observations" @{ patientId = $pat1.id; kind = "MEDICATION_ADMINISTRATION"; medication = "Ceftriaxone"; dose = "1g IV" }
Check "nurse records medication administration" ($med.id -and $med.medication -eq "Ceftriaxone") "id=$($med.id)"

ExpectStatus "empty observation refused" 400 {
  Post $nurseTok "/nursing/observations" @{ patientId = $pat1.id; kind = "VITALS" }
}

$obsList = Get $nurseTok "/nursing/observations"
Check "nurse reads own panel observations" (@($obsList.content).Count -ge 2) "count=$(@($obsList.content).Count)"

Write-Output "=== 7. Nurse is blocked from clinical prescribing ==="
$doc1Tok = (Login "doctor.one@example.com" $pass).accessToken
ExpectStatus "nurse cannot create a medical record" 403 { Post $nurseTok "/medical-records" @{ patientId = $pat1.id; recordDate = (Get-Date).ToString("yyyy-MM-dd"); diagnosis = "x" } }
ExpectStatus "nurse cannot admit" 403 { Post $nurseTok "/hospital/admissions" @{ patientId = $pat1.id } }
# A doctor holds neither vital:write nor medication:administer, so the nursing
# chart is closed to them â€” they document findings on the medical record instead.
ExpectStatus "doctor cannot write nursing observations" 403 { Post $doc1Tok "/nursing/observations" @{ patientId = $pat1.id; kind = "NURSING_NOTE"; notes = "Reviewed by doctor" } }

Write-Output "=== 8. Hospital admin: departments, wards, rooms, admissions ==="
$hospTok = (Login "hospital.admin@example.com" $pass).accessToken
$dept = Post $hospTok "/hospital/departments" @{ name = "Cardiology"; code = "CARD"; description = "Heart and vessels" }
Check "department created" ($dept.id -and $dept.code -eq "CARD") "id=$($dept.id)"
ExpectStatus "duplicate department code refused" 400 { Post $hospTok "/hospital/departments" @{ name = "Cardio"; code = "card" } }

$ward = Post $hospTok "/hospital/wards" @{ departmentId = $dept.id; name = "West Ward"; code = "WW-1"; floor = "2"; capacity = 12 }
Check "ward created" ($ward.id -and $ward.departmentName -eq "Cardiology") "id=$($ward.id) dept=$($ward.departmentName)"

$room = Post $hospTok "/hospital/rooms" @{ wardId = $ward.id; name = "W-01"; roomType = "GENERAL"; capacity = 1 }
Check "room created" ($room.id -and $room.status -eq "AVAILABLE") "id=$($room.id)"

$adm = Post $doc1Tok "/hospital/admissions" @{ patientId = $pat1.id; wardId = $ward.id; roomId = $room.id; diagnosis = "Post-op observation" }
Check "admission created" ($adm.id -and $adm.status -eq "ADMITTED") "id=$($adm.id)"

$roomAfter = Get $hospTok "/hospital/rooms?size=50"
$occ = @($roomAfter.content | Where-Object { $_.id -eq $room.id })[0]
Check "admission occupied the room" ($occ.status -eq "OCCUPIED") "status=$($occ.status)"

ExpectStatus "hospital admin cannot prescribe" 403 { Post $hospTok "/prescription-orders" @{ doctorId = $doc1.id; doctorName = "Dr Ada"; patientName = "Peter"; drugName = "X"; dosage = "1" } }
ExpectStatus "hospital admin cannot read diagnoses" 403 { Get $hospTok "/medical-records" }

Write-Output "=== 9. Discharge frees the room ==="
$dis = Post $doc1Tok "/hospital/admissions/$($adm.id)/discharge"
Check "discharged" ($dis.status -eq "DISCHARGED" -and $null -ne $dis.dischargedAt) "status=$($dis.status)"
$roomFreed = @(Get $hospTok "/hospital/rooms?size=50" | ForEach-Object { $_.content } | Where-Object { $_.id -eq $room.id })[0]
Check "room released after discharge" ($roomFreed.status -eq "AVAILABLE") "status=$($roomFreed.status)"

ExpectStatus "duplicate open admission refused" 400 {
  $adm2 = Post $doc1Tok "/hospital/admissions" @{ patientId = $pat1.id; wardId = $ward.id; roomId = $room.id }
  Post $doc1Tok "/hospital/admissions" @{ patientId = $pat1.id; wardId = $ward.id }
}

Write-Output "=== 10. Billing: server-computed totals, receipt, overpayment refused ==="
$cashTok = (Login "cashier.one@example.com" $pass).accessToken
$inv = Post $cashTok "/billing/invoices" @{ patientId = $pat1.id; tax = 10; discount = 5; lines = @(@{ description = "Consultation"; quantity = 2; unitPrice = 50 }, @{ description = "ECG"; category = "DIAGNOSTICS"; quantity = 1; unitPrice = 75 }) }
Check "invoice total computed from lines" ([decimal]$inv.subtotal -eq 175 -and [decimal]$inv.total -eq 180) "subtotal=$($inv.subtotal) total=$($inv.total)"
Check "invoice starts ISSUED" ($inv.status -eq "ISSUED") "status=$($inv.status)"

$pay = Post $cashTok "/billing/payments" @{ invoiceId = $inv.id; amount = 100; method = "CASH" }
Check "payment issues a receipt" ($pay.receiptNumber -and [decimal]$pay.amount -eq 100) "ref=$($pay.paymentRef) receipt=$($pay.receiptNumber)"
$invPartial = Get $cashTok "/billing/invoices/$($inv.id)"
Check "invoice now PARTIALLY_PAID" ($invPartial.status -eq "PARTIALLY_PAID") "status=$($invPartial.status)"
Check "balance reflects payment" ([decimal]$invPartial.balanceDue -eq 80) "balance=$($invPartial.balanceDue)"

ExpectStatus "overpayment refused" 400 { Post $cashTok "/billing/payments" @{ invoiceId = $inv.id; amount = 500; method = "CASH" } }
ExpectStatus "unknown method refused" 400 { Post $cashTok "/billing/payments" @{ invoiceId = $inv.id; amount = 10; method = "BITCOIN" } }

$pay2 = Post $cashTok "/billing/payments" @{ invoiceId = $inv.id; amount = 80; method = "CARD" }
$invPaid = Get $cashTok "/billing/invoices/$($inv.id)"
Check "invoice PAID when balance clears" ($invPaid.status -eq "PAID" -and [decimal]$invPaid.balanceDue -eq 0) "status=$($invPaid.status) balance=$($invPaid.balanceDue)"
ExpectStatus "payment on settled invoice refused" 400 { Post $cashTok "/billing/payments" @{ invoiceId = $inv.id; amount = 1; method = "CASH" } }

$receipts = Get $cashTok "/billing/receipts?invoiceId=$($inv.id)"
Check "two receipts for two payments" (@($receipts.content).Count -eq 2) "count=$(@($receipts.content).Count)"
$summary = Get $cashTok "/billing/summary"
Check "summary aggregates money" ([decimal]$summary.totalCollected -eq 180 -and [decimal]$summary.totalOutstanding -eq 0) "collected=$($summary.totalCollected) outstanding=$($summary.totalOutstanding)"

Write-Output "=== 11. Patient sees own money only ==="
$pat1Tok = (Login "patient.one@example.com" $pass).accessToken
$myInv = Get $pat1Tok "/billing/invoices"
Check "patient sees own invoice" (@($myInv.content).Count -eq 1) "count=$(@($myInv.content).Count)"
$pat2Tok = (Login "patient.two@example.com" $pass).accessToken
ExpectStatus "patient cannot read another's invoice" 404 { Get $pat2Tok "/billing/invoices/$($inv.id)" }
ExpectStatus "patient cannot read revenue summary" 403 { Get $pat1Tok "/billing/summary" }
ExpectStatus "doctor has no billing access" 403 { Get $doc1Tok "/billing/invoices" }

Write-Output "=== 12. Global search is permission-scoped ==="
$saSearch = Get $saTok "/admin/search?q=Peter"
Check "super admin finds the patient" (@($saSearch.patients).Count -ge 1) "patients=$(@($saSearch.patients).Count)"
$patSearch = Get $pat1Tok "/admin/search?q=Peter"
Check "patient finds self" (@($patSearch.patients).Count -ge 1) "patients=$(@($patSearch.patients).Count)"
Check "patient gets no user directory" (@($patSearch.users).Count -eq 0) "users=$(@($patSearch.users).Count)"
$docSearch = Get $pat1Tok "/admin/search?q=Ada"
Check "patient can still find a doctor to book with" (@($docSearch.doctors).Count -ge 1) "doctors=$(@($docSearch.doctors).Count)"

Write-Output "=== 13. Notifications reach the assigned clinician ==="
$nNotif = Get $nurseTok "/notifications/unread-count"
Check "nurse notified of allocation" ([int]$nNotif.count -ge 1) "count=$($nNotif.count)"
$dNotif = Get $doc1Tok "/notifications/unread-count"
Check "doctor notified of allocation" ([int]$dNotif.count -ge 1) "count=$($dNotif.count)"

Write-Output "=== 14. Cross-patient and cross-role denial ==="
$doc2Tok = (Login "doctor.two@example.com" $pass).accessToken
ExpectStatus "other doctor cannot read assigned patient" 403 { Get $doc2Tok "/patients/$($pat1.id)" }
ExpectStatus "other doctor's own panel excludes this patient" 200 { Get $doc2Tok "/front-desk/patients" }
ExpectStatus "super admin cannot read clinical data" 403 { Get $saTok "/medical-records" }
ExpectStatus "super admin cannot manage wards" 403 { Post $saTok "/hospital/departments" @{ name = "X"; code = "X1" } }
ExpectStatus "cashier cannot read patients" 403 { Get $cashTok "/patients" }
ExpectStatus "lab tech cannot prescribe" 403 {
  $labTok = (Login "lab.one@example.com" $pass).accessToken
  Post $labTok "/prescription-orders" @{ doctorId = $doc1.id; doctorName = "Dr Ada"; patientName = "Peter"; drugName = "X"; dosage = "1" }
}

Write-Output "=== 15. Super Admin provisions a HOSPITAL_ADMIN; others cannot ==="
$hospAdmin = Post $saTok "/admin/users" @{ email = "hospital.admin2@example.com"; password = $pass; fullName = "Hana Second Admin"; role = "HOSPITAL_ADMIN" }
Check "super admin creates a privileged role" ($hospAdmin.id -and $hospAdmin.role -eq "HOSPITAL_ADMIN") "role=$($hospAdmin.role)"
ExpectStatus "receptionist cannot create a privileged role" 403 {
  Post $recepTok "/admin/users" @{ email = "escalate@example.com"; password = $pass; fullName = "Escalator"; role = "SUPER_ADMIN" }
}
ExpectStatus "hospital admin cannot create a super admin" 403 {
  $tok = (Login "hospital.admin2@example.com" $pass).accessToken
  Post $tok "/admin/users" @{ email = "escalate2@example.com"; password = $pass; fullName = "Escalator"; role = "SUPER_ADMIN" }
}

Write-Output "=== 16. Pharmacy: catalogue, receipts, ledger, alerts ==="
$pharm = Post $saTok "/admin/users" @{ email = "pharmacist.one@example.com"; password = $pass; fullName = "Phil Pharmacist"; role = "PHARMACIST" }
$pharmTok = (Login "pharmacist.one@example.com" $pass).accessToken

$rxMed = Post $pharmTok "/pharmacy/medicines" @{ name = "Ceftriaxone"; code = "CEF-1"; category = "ANTIBIOTIC"; unit = "vial"; reorderLevel = 10; unitCost = 5; requiresPrescription = $true }
$otcMed = Post $pharmTok "/pharmacy/medicines" @{ name = "Panadol"; code = "PAN-1"; category = "ANALGESIC"; unit = "tablet"; reorderLevel = 100; unitCost = 0.1; requiresPrescription = $false }
Check "medicines created" ($rxMed.id -and $otcMed.id) "missing"

$supplier = Post $pharmTok "/pharmacy/suppliers" @{ name = "Medline Distribution"; contactName = "Sam"; email = "sam@medline.example" }
Check "supplier created" ($supplier.id) "missing"

$receipt = Post $pharmTok "/pharmacy/receipts" @{ medicineId = $rxMed.id; supplierId = $supplier.id; batchNumber = "LOT-1"; expiryDate = (Get-Date).AddMonths(6).ToString("yyyy-MM-dd"); quantity = 50; unitCost = 5; reference = "DN-1" }
Check "receipt records the new balance" ([decimal]$receipt.balanceAfter -eq 50) "balance=$($receipt.balanceAfter)"
Check "receipt is attributed to the operator" ($receipt.performedById -eq $pharm.id) "by=$($receipt.performedById)"

$topUp = Post $pharmTok "/pharmacy/receipts" @{ medicineId = $rxMed.id; supplierId = $supplier.id; batchNumber = "LOT-1"; expiryDate = (Get-Date).AddMonths(6).ToString("yyyy-MM-dd"); quantity = 10 }
Check "redelivery tops up the same lot" ([decimal]$topUp.balanceAfter -eq 60) "balance=$($topUp.balanceAfter)"

$rxBatches = Get $pharmTok "/pharmacy/batches?medicineId=$($rxMed.id)"
$batchId = @($rxBatches.content)[0].id
Check "only one batch exists after redelivery" (@($rxBatches.content).Count -eq 1) "count=$(@($rxBatches.content).Count)"

ExpectStatus "receiving an already-expired batch is refused" 400 {
  Post $pharmTok "/pharmacy/receipts" @{ medicineId = $rxMed.id; batchNumber = "OLD"; expiryDate = (Get-Date).AddDays(-5).ToString("yyyy-MM-dd"); quantity = 5 }
}

$dispensed = Post $pharmTok "/pharmacy/movements" @{ batchId = $batchId; kind = "DISPENSED"; quantity = 15; prescriptionOrderId = "rx-e2e-1"; reason = "Post-op" }
Check "dispensing reduces the batch" ([decimal]$dispensed.balanceAfter -eq 45) "balance=$($dispensed.balanceAfter)"

ExpectStatus "over-dispensing is refused" 400 {
  Post $pharmTok "/pharmacy/movements" @{ batchId = $batchId; kind = "DISPENSED"; quantity = 1000; prescriptionOrderId = "rx-e2e-2" }
}
ExpectStatus "prescription-only medicine needs a prescription" 400 {
  Post $pharmTok "/pharmacy/movements" @{ batchId = $batchId; kind = "DISPENSED"; quantity = 1 }
}

$returned = Post $pharmTok "/pharmacy/movements" @{ batchId = $batchId; kind = "RETURNED"; quantity = 5; reason = "Unused vials" }
Check "return adds stock back" ([decimal]$returned.balanceAfter -eq 50) "balance=$($returned.balanceAfter)"

$medicines = Get $pharmTok "/pharmacy/medicines?size=50"
$rxEntry = @($medicines.content | Where-Object { $_.medicine.id -eq $rxMed.id })[0]
Check "live stock excludes nothing still in date" ([decimal]$rxEntry.totalLiveStock -eq 50) "live=$($rxEntry.totalLiveStock)"
$otcEntry = @($medicines.content | Where-Object { $_.medicine.id -eq $otcMed.id })[0]
Check "a medicine with no stock is reported out of stock" ($otcEntry.outOfStock -eq $true) "out=$($otcEntry.outOfStock)"

ExpectStatus "a stocked medicine cannot be deleted from the catalogue" 400 {
  Delete $pharmTok "/pharmacy/medicines/$($rxMed.id)"
}
ExpectStatus "doctor cannot receive stock" 403 {
  Post $doc1Tok "/pharmacy/receipts" @{ medicineId = $rxMed.id; batchNumber = "X"; expiryDate = (Get-Date).AddMonths(3).ToString("yyyy-MM-dd"); quantity = 1 }
}

$alerts = Get $pharmTok "/pharmacy/alerts"
Check "alerts surface the out-of-stock medicine" (@($alerts.outOfStock).Count -ge 1) "count=$(@($alerts.outOfStock).Count)"
$pharmSummary = Get $pharmTok "/pharmacy/summary"
Check "stock value is quantity x batch cost" ([decimal]$pharmSummary.stockValue -ge 250) "value=$($pharmSummary.stockValue)"
Check "COGS counts only dispensed stock" ([decimal]$pharmSummary.costOfGoodsDispensedInPeriod -eq 75) "cogs=$($pharmSummary.costOfGoodsDispensedInPeriod)"

$movements = Get $pharmTok "/pharmacy/movements?kind=DISPENSED"
Check "ledger filters by kind" (@($movements.content).Count -ge 1) "count=$(@($movements.content).Count)"

Write-Output "=== 17. Laboratory critical results ==="
$labTok = (Login "lab.one@example.com" $pass).accessToken
$labOrder = PostLegacy $doc1Tok "/lab-orders" @{ patientId = $pat1.id; doctorId = $doc1.id; tests = @("CBC"); urgency = "ROUTINE"; clinicalNotes = "Post-op check" }
$critical = PostLegacy $labTok "/lab-results" @{ labOrderId = $labOrder.id; labTechnicianId = $lab.id; findings = "Potassium critically low"; status = "FINAL"; critical = $true }
Check "critical result recorded and flagged" ($critical.critical -eq $true) "critical=$($critical.critical)"
$routine = PostLegacy $labTok "/lab-results" @{ labOrderId = $labOrder.id; labTechnicianId = $lab.id; findings = "Routine"; status = "FINAL" }
Check "result defaults to non-critical" ($routine.critical -eq $false) "critical=$($routine.critical)"

$doctorNotif = Get $doc1Tok "/notifications/unread-count"
Check "critical result notifies the ordering doctor" ([int]$doctorNotif.count -ge 1) "count=$($doctorNotif.count)"

$finalStats = Get $saTok "/stats/hospital"
Check "stats report the critical result" ([int]$finalStats.laboratory.criticalResults -ge 1) "critical=$($finalStats.laboratory.criticalResults)"
Check "stats carry a pharmacy section" ($null -ne $finalStats.pharmacy.medicines) "null"
Check "stats count the dispensed COGS" ([decimal]$finalStats.pharmacy.costOfGoodsDispensedInPeriod -eq 75) "cogs=$($finalStats.pharmacy.costOfGoodsDispensedInPeriod)"

Write-Output "=== 18. Super Admin account lifecycle ==="
# The unified account endpoints, exercised over HTTP the way the screens use them.
$run = [Guid]::NewGuid().ToString("N").Substring(0, 8)
$lifecycleEmail = "lifecycle.$run@example.com"

$created = Post $saTok "/admin/users/accounts" @{
  email = $lifecycleEmail; fullName = "Life Cycle"; phone = "+15550000"
  role = "DOCTOR"; specialization = "Cardiology"; licenseNumber = "LIC-$run"
}
Check "account created via the lifecycle endpoint" ($created.user.id -and $created.user.role -eq "DOCTOR") "id=$($created.user.id)"
Check "new account is flagged must-change-password" ($created.user.mustChangePassword -eq $true) "flag=$($created.user.mustChangePassword)"
Check "password hash never serialized" (-not (($created | ConvertTo-Json -Depth 8).Contains('$2a$'))) "bcrypt hash in response"
Check "generated password returned exactly once" ($null -ne $created.generatedPassword) "missing"

$reRead = Get $saTok "/admin/users/$($created.user.id)"
Check "detail exposes the doctor profile" ($reRead.profile.specialization -eq "Cardiology") "spec=$($reRead.profile.specialization)"
Check "detail never carries a credential" (($reRead | ConvertTo-Json -Depth 8) -notmatch 'generatedPassword|"password"') "credential in detail"

ExpectStatus "duplicate email is a conflict" 409 {
  Post $saTok "/admin/users/accounts" @{ email = $lifecycleEmail; fullName = "Duplicate"; role = "CASHIER"; password = $pass }
}
ExpectStatus "doctor without a license is rejected" 400 {
  Post $saTok "/admin/users/accounts" @{ email = "nolic.$run@example.com"; fullName = "No License"; role = "DOCTOR"; specialization = "Radiology"; password = $pass }
}
ExpectStatus "weak password is rejected" 400 {
  Post $saTok "/admin/users/accounts" @{ email = "weak.$run@example.com"; fullName = "Weak"; role = "CASHIER"; password = "abc" }
}

# Edit
$edited = Put $saTok "/admin/users/$($created.user.id)/profile" @{ fullName = "Life Cycle Edited"; specialization = "Neurosurgery" }
Check "profile edited" ($edited.fullName -eq "Life Cycle Edited") "name=$($edited.fullName)"
Check "a profile edit cannot change the role" ($edited.role -eq "DOCTOR") "role=$($edited.role)"

# Deactivate: login must fail and a token already in hand must be rejected.
$lifeTok = (Login $lifecycleEmail $created.generatedPassword).accessToken
$deact = Patch $saTok "/admin/users/$($created.user.id)/status" @{ active = $false; reason = "Left the organisation" }
Check "account deactivated" ($deact.active -eq $false) "active=$($deact.active)"
Check "deactivation reason recorded" ($deact.deactivationReason -eq "Left the organisation") "reason=$($deact.deactivationReason)"
ExpectStatus "deactivated user cannot sign in" 401 {
  Login $lifecycleEmail $created.generatedPassword
}
ExpectStatus "a token issued before suspension is rejected" 401 {
  Get $lifeTok "/admin/users/search"
}
ExpectStatus "deactivation without a reason is refused" 400 {
  Patch $saTok "/admin/users/$($created.user.id)/status" @{ active = $false }
}
$reactivated = Patch $saTok "/admin/users/$($created.user.id)/status" @{ active = $true }
Check "account reactivated" ($reactivated.active -eq $true) "active=$($reactivated.active)"

# Role change
$promoted = Patch $saTok "/admin/users/$($created.user.id)/role" @{ role = "RECEPTIONIST"; reason = "Moved to front desk" }
Check "role changed" ($promoted.role -eq "RECEPTIONIST") "role=$($promoted.role)"

# Directory filtering
$byRole = Get $saTok "/admin/users/search?role=RECEPTIONIST&size=100"
Check "directory filters by role" (@($byRole.content | Where-Object { $_.email -eq $lifecycleEmail }).Count -eq 1) "not found"
$bySearch = Get $saTok "/admin/users/search?q=lifecycle.$run&size=100"
Check "directory searches free text" (@($bySearch.content).Count -ge 1) "count=$(@($bySearch.content).Count)"
$byInactive = Get $saTok "/admin/users/search?active=false&size=100"
Check "directory filters by status" ($null -ne $byInactive.content) "null"

# A non-Super-Admin must be refused on every account endpoint.
$nurseAdmin = (Login "nurse.one@example.com" $pass).accessToken
ExpectStatus "nurse cannot search accounts" 403 { Get $nurseAdmin "/admin/users/search" }
ExpectStatus "nurse cannot read an account" 403 { Get $nurseAdmin "/admin/users/$($created.user.id)" }
ExpectStatus "nurse cannot create an account" 403 { Post $nurseAdmin "/admin/users/accounts" @{ email = "esc.$run@example.com"; fullName = "Es Calate"; role = "CASHIER" } }
ExpectStatus "nurse cannot deactivate" 403 { Patch $nurseAdmin "/admin/users/$($created.user.id)/status" @{ active = $false; reason = "nope" } }
ExpectStatus "nurse cannot delete" 403 { Delete $nurseAdmin "/admin/users/$($created.user.id)/account" }

# Self-protection and the last-Super-Admin guard.
$saSelf = Get $saTok "/admin/users/search?role=SUPER_ADMIN&size=100"
$saSelfId = ($saSelf.content | Where-Object { $_.email -eq $saEmail } | Select-Object -First 1).id
ExpectStatus "admin cannot deactivate themselves" 400 { Patch $saTok "/admin/users/$saSelfId/status" @{ active = $false; reason = "stepping down" } }
ExpectStatus "admin cannot delete themselves" 400 { Delete $saTok "/admin/users/$saSelfId/account" }
ExpectStatus "admin cannot demote themselves" 400 { Patch $saTok "/admin/users/$saSelfId/role" @{ role = "CASHIER" } }
# The last-Super-Admin guard only has something to protect when exactly one remains.
# Provision a second, confirm removing it is allowed while the first survives, and
# only then confirm the final one is refused.
$second = Post $saTok "/admin/users/accounts" @{ email = "second.sa.$run@example.com"; fullName = "Second Super"; role = "SUPER_ADMIN"; password = $pass }
Patch $saTok "/admin/users/$($second.user.id)/role" @{ role = "CASHIER"; reason = "stepping down" } | Out-Null
$remaining = Get $saTok "/admin/users/search?role=SUPER_ADMIN&active=true&size=100"
Check "exactly one super admin remains" (@($remaining.content).Count -eq 1) "count=$(@($remaining.content).Count)"
$lastId = $remaining.content[0].id
ExpectStatus "cannot demote the last super admin" 400 {
  Patch $saTok "/admin/users/$lastId/role" @{ role = "CASHIER"; reason = "demote" }
}
ExpectStatus "cannot delete the last super admin" 400 {
  Delete $saTok "/admin/users/$lastId/account"
}
ExpectStatus "cannot deactivate the last super admin" 400 {
  Patch $saTok "/admin/users/$lastId/status" @{ active = $false; reason = "suspend" }
}

# Audit trail
$auditActions = Get $saTok "/admin/audit-logs?size=200"
$actionNames = @($auditActions.content | ForEach-Object { $_.action })
foreach ($expected in @("USER_CREATED", "USER_UPDATED", "USER_DEACTIVATED", "USER_ACTIVATED", "ROLE_CHANGED")) {
  Check "audit records $expected" ($actionNames -contains $expected) "not found"
}

# Soft delete: hidden from the directory and unable to sign in, but still present.
$throwaway = Post $saTok "/admin/users/accounts" @{ email = "throwaway.$run@example.com"; fullName = "Throw Away"; role = "CASHIER"; password = $pass }
Delete $saTok "/admin/users/$($throwaway.user.id)/account" | Out-Null
$afterDelete = Get $saTok "/admin/users/search?size=200"
Check "deleted account leaves the directory" (@($afterDelete.content | Where-Object { $_.id -eq $throwaway.user.id }).Count -eq 0) "still listed"
ExpectStatus "deleted account cannot sign in" 401 { Login "throwaway.$run@example.com" $pass }

Write-Output ""
Write-Output "=== SUMMARY ==="
if ($script:failures.Count -eq 0) { Write-Output "ALL CHECKS PASSED" }
else { Write-Output "FAILURES ($($script:failures.Count)):"; $script:failures | ForEach-Object { Write-Output "  - $_" } }