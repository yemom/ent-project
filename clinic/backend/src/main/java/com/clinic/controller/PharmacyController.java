package com.clinic.controller;

import com.clinic.dto.request.MedicineUpsertRequest;
import com.clinic.dto.request.StockMovementRequest;
import com.clinic.dto.request.StockReceiptRequest;
import com.clinic.dto.request.SupplierUpsertRequest;
import com.clinic.dto.response.PageResponse;
import com.clinic.dto.response.PharmacyResponse;
import com.clinic.entity.StockMovement;
import com.clinic.service.PharmacyService;
import jakarta.validation.Valid;
import lombok.extern.slf4j.Slf4j;
import org.springdoc.core.annotations.ParameterObject;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

/**
 * Pharmacy inventory.
 *
 * <p>Catalogue and ledger writes need {@code inventory:manage} or
 * {@code batch:manage} (pharmacist and admin); dispensing additionally needs
 * {@code prescription:dispense}. Reads are open to any signed-in clinical role
 * because stock levels matter when prescribing.
 */
@RestController
@RequestMapping("/api/v1/pharmacy")
@Slf4j
public class PharmacyController {

    private final PharmacyService pharmacyService;

    public PharmacyController(PharmacyService pharmacyService) {
        this.pharmacyService = pharmacyService;
    }

    // ---------------- catalogue ----------------

    @GetMapping("/medicines")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<PageResponse<PharmacyResponse>> listMedicines(
            @RequestParam(required = false) String q,
            @RequestParam(required = false) String category,
            @RequestParam(defaultValue = "false") boolean alertsOnly,
            @PageableDefault(size = 20, sort = "name", direction = Sort.Direction.ASC)
            @ParameterObject Pageable pageable) {
        return ResponseEntity.ok(pharmacyService.listMedicines(q, category, alertsOnly, pageable));
    }

    @GetMapping("/medicines/{id}")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<PharmacyResponse> getMedicine(@PathVariable String id) {
        return ResponseEntity.ok(pharmacyService.getMedicine(id));
    }

    @PostMapping("/medicines")
    @PreAuthorize("hasAuthority('PERM_inventory:manage') or hasAuthority('PERM_batch:manage')")
    public ResponseEntity<PharmacyResponse.MedicineView> createMedicine(
            @Valid @RequestBody MedicineUpsertRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(pharmacyService.createMedicine(request));
    }

    @PutMapping("/medicines/{id}")
    @PreAuthorize("hasAuthority('PERM_inventory:manage') or hasAuthority('PERM_batch:manage')")
    public ResponseEntity<PharmacyResponse.MedicineView> updateMedicine(
            @PathVariable String id, @Valid @RequestBody MedicineUpsertRequest request) {
        return ResponseEntity.ok(pharmacyService.updateMedicine(id, request));
    }

    @DeleteMapping("/medicines/{id}")
    @PreAuthorize("hasAuthority('PERM_inventory:manage')")
    public ResponseEntity<Void> deleteMedicine(@PathVariable String id) {
        pharmacyService.deleteMedicine(id);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/categories")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<List<String>> categories() {
        return ResponseEntity.ok(pharmacyService.listCategories());
    }

    // ---------------- stock ----------------

    @GetMapping("/batches")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<PageResponse<PharmacyResponse.BatchView>> listBatches(
            @RequestParam(required = false) String medicineId,
            @PageableDefault(size = 50, sort = "expiryDate", direction = Sort.Direction.ASC)
            @ParameterObject Pageable pageable) {
        return ResponseEntity.ok(pharmacyService.listBatches(medicineId, pageable));
    }

    @PostMapping("/receipts")
    @PreAuthorize("hasAuthority('PERM_batch:manage') or hasAuthority('PERM_inventory:manage')")
    public ResponseEntity<PharmacyResponse.MovementView> receiveStock(
            @Valid @RequestBody StockReceiptRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(pharmacyService.receiveStock(request));
    }

    /**
     * Records a movement that removes or returns stock.
     *
     * <p>Dispensing requires {@code prescription:dispense}; the other kinds are
     * stock corrections and need {@code batch:manage}.
     */
    @PostMapping("/movements")
    @PreAuthorize("hasAuthority('PERM_batch:manage') or hasAuthority('PERM_prescription:dispense')")
    public ResponseEntity<PharmacyResponse.MovementView> recordMovement(
            @Valid @RequestBody StockMovementRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(pharmacyService.recordMovement(request));
    }

    @GetMapping("/movements")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<PageResponse<PharmacyResponse.MovementView>> listMovements(
            @RequestParam(required = false) String medicineId,
            @RequestParam(required = false) String kind,
            @PageableDefault(size = 25, sort = "performedAt", direction = Sort.Direction.DESC)
            @ParameterObject Pageable pageable) {
        StockMovement.Kind parsed = kind == null || kind.isBlank()
                ? null
                : StockMovement.Kind.valueOf(kind.toUpperCase());
        return ResponseEntity.ok(pharmacyService.listMovements(medicineId, parsed, pageable));
    }

    // ---------------- suppliers ----------------

    @GetMapping("/suppliers")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<List<PharmacyResponse.SupplierView>> listSuppliers() {
        return ResponseEntity.ok(pharmacyService.listSuppliers());
    }

    @PostMapping("/suppliers")
    @PreAuthorize("hasAuthority('PERM_inventory:manage') or hasAuthority('PERM_batch:manage')")
    public ResponseEntity<PharmacyResponse.SupplierView> createSupplier(
            @Valid @RequestBody SupplierUpsertRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(pharmacyService.createSupplier(request));
    }

    @PutMapping("/suppliers/{id}")
    @PreAuthorize("hasAuthority('PERM_inventory:manage') or hasAuthority('PERM_batch:manage')")
    public ResponseEntity<PharmacyResponse.SupplierView> updateSupplier(
            @PathVariable String id, @Valid @RequestBody SupplierUpsertRequest request) {
        return ResponseEntity.ok(pharmacyService.updateSupplier(id, request));
    }

    // ---------------- alerts & reporting ----------------

    @GetMapping("/alerts")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<PharmacyResponse.AlertsView> alerts() {
        return ResponseEntity.ok(pharmacyService.alerts());
    }

    @GetMapping("/summary")
    @PreAuthorize("hasAuthority('PERM_report:read') or hasAuthority('PERM_inventory:manage')")
    public ResponseEntity<Map<String, Object>> summary(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        LocalDateTime start = from != null ? from.atStartOfDay() : null;
        LocalDateTime end = to != null ? to.plusDays(1).atStartOfDay() : null;
        return ResponseEntity.ok(pharmacyService.inventorySummary(start, end));
    }
}