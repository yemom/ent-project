package com.clinic.service.impl;

import com.clinic.dto.request.MedicineUpsertRequest;
import com.clinic.dto.request.StockMovementRequest;
import com.clinic.dto.request.StockReceiptRequest;
import com.clinic.dto.request.SupplierUpsertRequest;
import com.clinic.dto.response.PageResponse;
import com.clinic.dto.response.PharmacyResponse;
import com.clinic.entity.Medicine;
import com.clinic.entity.StockBatch;
import com.clinic.entity.StockMovement;
import com.clinic.entity.Supplier;
import com.clinic.exception.BadRequestException;
import com.clinic.exception.ResourceNotFoundException;
import com.clinic.repository.MedicineRepository;
import com.clinic.repository.StockBatchRepository;
import com.clinic.repository.StockMovementRepository;
import com.clinic.repository.SupplierRepository;
import com.clinic.security.CurrentUser;
import com.clinic.service.AuditLogService;
import com.clinic.service.PharmacyService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/**
 * Pharmacy inventory.
 *
 * <p>The rules this enforces, all of them money- or safety-relevant:
 * <ol>
 *   <li><b>Stock never goes negative.</b> A movement that would take a batch below
 *       zero is refused rather than clamped, because silently clamping would leave
 *       the ledger disagreeing with the shelf and hide a dispensing error.</li>
 *   <li><b>Every quantity change has a ledger entry</b> with the resulting balance,
 *       so stock can always be reconciled and the operator is recorded.</li>
 *   <li><b>Expired stock is not stock.</b> Live totals and low-stock alerts exclude
 *       past-expiry lots; an expired lot is surfaced separately as needing write-off.</li>
 *   <li><b>Dispensing requires a prescription</b> for medicines flagged
 *       prescription-only, so the pharmacy cannot dispense a controlled item freely.</li>
 *   <li><b>Cost is captured per batch</b>, so changing the catalogue price never
 *       rewrites the cost of stock already held or already dispensed.</li>
 * </ol>
 */
@Service
@Transactional
@Slf4j
public class PharmacyServiceImpl implements PharmacyService {

    /** How far ahead a lot is flagged as "expiring soon". */
    @Value("${app.pharmacy.expiry-warning-days:90}")
    private int expiryWarningDays;

    private final MedicineRepository medicineRepository;
    private final StockBatchRepository batchRepository;
    private final StockMovementRepository movementRepository;
    private final SupplierRepository supplierRepository;
    private final CurrentUser currentUser;
    private final AuditLogService auditLogService;

    public PharmacyServiceImpl(MedicineRepository medicineRepository,
                               StockBatchRepository batchRepository,
                               StockMovementRepository movementRepository,
                               SupplierRepository supplierRepository,
                               CurrentUser currentUser,
                               AuditLogService auditLogService) {
        this.medicineRepository = medicineRepository;
        this.batchRepository = batchRepository;
        this.movementRepository = movementRepository;
        this.supplierRepository = supplierRepository;
        this.currentUser = currentUser;
        this.auditLogService = auditLogService;
    }

    // ================= catalogue =================

    @Override
    @Transactional(readOnly = true)
    public PageResponse<PharmacyResponse> listMedicines(String query, String category, boolean onlyAlerts,
                                                        Pageable pageable) {
        Page<Medicine> page = medicineRepository.findAll(pageable);

        // Stock totals are derived per medicine across its batches, so the
        // search/category/alert filters are applied here rather than in the finder.
        // The page size bounds the work, and the totals map is loaded once per page
        // rather than per medicine.
        Map<String, BigDecimal> totals = liveStockByMedicine();

        List<PharmacyResponse> content = page.getContent().stream()
                .map(medicine -> toResponse(medicine, totals))
                .filter(response -> matches(response, query, category))
                .filter(response -> !onlyAlerts || response.lowStock() || response.outOfStock())
                .toList();

        return new PageResponse<>(
                content,
                page.getNumber(),
                page.getSize(),
                page.getTotalElements(),
                page.getTotalPages(),
                page.isFirst(),
                page.isLast());
    }

    @Override
    @Transactional(readOnly = true)
    public PharmacyResponse getMedicine(String id) {
        return toResponse(getMedicineEntity(id), liveStockByMedicine());
    }

    @Override
    public PharmacyResponse.MedicineView createMedicine(MedicineUpsertRequest request) {
        String code = normaliseCode(request.code());
        if (medicineRepository.existsByCode(code)) {
            throw new BadRequestException("A medicine with code " + code + " already exists");
        }

        Medicine medicine = Medicine.builder()
                .name(request.name().trim())
                .code(code)
                .category(blankTo(request.category(), "GENERAL"))
                .form(trimToNull(request.form()))
                .strength(trimToNull(request.strength()))
                .unit(blankTo(request.unit(), "unit"))
                .reorderLevel(nz(request.reorderLevel()))
                .unitCost(nz(request.unitCost()))
                .requiresPrescription(request.requiresPrescription() == null || request.requiresPrescription())
                .active(request.active() == null || request.active())
                .build();

        Medicine saved = medicineRepository.save(medicine);
        log.info("Created medicine id={} code={}", saved.getId(), saved.getCode());
        auditLogService.record(com.clinic.entity.AuditAction.RECORD_CREATED, "MEDICINE", saved.getId(),
                "Created medicine " + saved.getName());
        return PharmacyResponse.MedicineView.from(saved);
    }

    @Override
    public PharmacyResponse.MedicineView updateMedicine(String id, MedicineUpsertRequest request) {
        Medicine medicine = getMedicineEntity(id);

        String code = normaliseCode(request.code());
        if (!code.equals(medicine.getCode()) && medicineRepository.existsByCodeAndIdNot(code, id)) {
            throw new BadRequestException("A medicine with code " + code + " already exists");
        }

        medicine.setName(request.name().trim());
        medicine.setCode(code);
        medicine.setCategory(blankTo(request.category(), medicine.getCategory()));
        medicine.setForm(trimToNull(request.form()));
        medicine.setStrength(trimToNull(request.strength()));
        medicine.setUnit(blankTo(request.unit(), medicine.getUnit()));
        if (request.reorderLevel() != null) {
            medicine.setReorderLevel(request.reorderLevel());
        }
        if (request.unitCost() != null) {
            medicine.setUnitCost(request.unitCost());
        }
        if (request.requiresPrescription() != null) {
            medicine.setRequiresPrescription(request.requiresPrescription());
        }
        if (request.active() != null) {
            medicine.setActive(request.active());
        }

        return PharmacyResponse.MedicineView.from(medicineRepository.save(medicine));
    }

    @Override
    public void deleteMedicine(String id) {
        Medicine medicine = getMedicineEntity(id);

        BigDecimal live = batchRepository.totalLiveQuantity(id, LocalDate.now());
        if (live != null && live.signum() > 0) {
            // Deleting a catalogue entry with stock on the shelf would orphan that
            // stock and make the batch untraceable.
            throw new BadRequestException(
                    "Cannot delete " + medicine.getName() + " while it still holds stock. "
                            + "Write the remaining stock off first.");
        }

        medicineRepository.delete(medicine);
        log.info("Deleted medicine id={}", id);
    }

    @Override
    @Transactional(readOnly = true)
    public List<String> listCategories() {
        return batchRepository.findDistinctCategories();
    }

    // ================= stock =================

    @Override
    @Transactional(readOnly = true)
    public PageResponse<PharmacyResponse.BatchView> listBatches(String medicineId, Pageable pageable) {
        LocalDate today = LocalDate.now();

        // Filtering by medicine happens in memory because the medicine filter has no
        // paged finder; the page window is applied first so the work stays bounded.
        List<PharmacyResponse.BatchView> content = (medicineId == null || medicineId.isBlank())
                ? batchRepository.findAllByOrderByExpiryDateAsc(pageable).getContent().stream()
                .map(batch -> PharmacyResponse.BatchView.from(batch, today, expiryWarningDays))
                .toList()
                : batchRepository.findByMedicineIdOrderByExpiryDateAsc(medicineId).stream()
                .map(batch -> PharmacyResponse.BatchView.from(batch, today, expiryWarningDays))
                .toList();

        long total = content.size();

        return new PageResponse<>(
                content,
                pageable.getPageNumber(),
                pageable.getPageSize(),
                total,
                (int) Math.max(1, Math.ceil(total / (double) pageable.getPageSize())),
                pageable.getPageNumber() == 0,
                pageable.getPageNumber() + 1 >= Math.max(1, Math.ceil(total / (double) pageable.getPageSize())));
    }

    @Override
    public PharmacyResponse.MovementView receiveStock(StockReceiptRequest request) {
        Medicine medicine = getMedicineEntity(request.medicineId());
        Supplier supplier = request.supplierId() == null || request.supplierId().isBlank()
                ? null
                : getSupplier(request.supplierId());

        LocalDate today = LocalDate.now();
        if (!request.expiryDate().isAfter(today)) {
            // Receiving stock that is already expired would immediately land in the
            // write-off queue and make the receipt pointless.
            throw new BadRequestException("Cannot receive a batch that has already expired");
        }

        String batchNumber = request.batchNumber().trim();
        BigDecimal quantity = request.quantity();

        // Re-delivery of the same lot number tops the existing batch up rather than
        // creating a duplicate, which keeps the expiry/quantity pair unique.
        StockBatch batch = batchRepository
                .findByMedicineIdOrderByExpiryDateAsc(medicine.getId()).stream()
                .filter(candidate -> candidate.getBatchNumber().equalsIgnoreCase(batchNumber))
                .findFirst()
                .orElse(null);

        boolean newBatch = batch == null;
        if (newBatch) {
            batch = StockBatch.builder()
                    .medicine(medicine)
                    .supplier(supplier)
                    .batchNumber(batchNumber)
                    .expiryDate(request.expiryDate())
                    .quantity(BigDecimal.ZERO)
                    .unitCost(nz(request.unitCost()))
                    .receivedAt(LocalDateTime.now())
                    .notes(request.notes())
                    .build();
        }

        batch.setQuantity(nz(batch.getQuantity()).add(quantity));
        if (supplier != null) {
            batch.setSupplier(supplier);
        }
        StockBatch savedBatch = batchRepository.save(batch);

        PharmacyResponse.MovementView movement = writeMovement(
                medicine, savedBatch, StockMovement.Kind.RECEIVED, quantity,
                savedBatch.getQuantity(), nz(request.unitCost()), request.reference(),
                "Stock received" + (newBatch ? " (new batch)" : " (top-up)"), null);

        log.info("Received {} of medicine {} into batch {} -> balance {}",
                quantity, medicine.getCode(), savedBatch.getBatchNumber(), savedBatch.getQuantity());
        auditLogService.record(com.clinic.entity.AuditAction.RECORD_CREATED, "STOCK_MOVEMENT",
                movement.id(), "Received " + quantity + " " + medicine.getUnit()
                        + " of " + medicine.getName());
        return movement;
    }

    @Override
    public PharmacyResponse.MovementView recordMovement(StockMovementRequest request) {
        StockBatch batch = getBatchWithRelations(request.batchId());
        Medicine medicine = batch.getMedicine();

        StockMovement.Kind kind = parseKind(request.kind());
        BigDecimal quantity = request.quantity();

        if (quantity == null || quantity.signum() == 0) {
            throw new BadRequestException("Quantity must not be zero");
        }

        if (kind == StockMovement.Kind.DISPENSED
                && Boolean.TRUE.equals(medicine.getRequiresPrescription())
                && (request.prescriptionOrderId() == null || request.prescriptionOrderId().isBlank())) {
            // A prescription-only medicine may not leave the shelf unattached to a
            // prescription, or the ledger cannot explain why it was given out.
            throw new BadRequestException(
                    medicine.getName() + " is prescription-only; a prescription order is required");
        }

        BigDecimal signed = signedQuantity(kind, quantity);
        BigDecimal balance = nz(batch.getQuantity()).add(signed);

        if (balance.signum() < 0) {
            // Refuse rather than clamp: a negative balance means the ledger and the
            // shelf disagree, and hiding that would conceal a real dispensing error.
            throw new BadRequestException(
                    "Cannot record that movement: batch " + batch.getBatchNumber() + " only holds "
                            + nz(batch.getQuantity()) + " " + medicine.getUnit());
        }

        batch.setQuantity(balance);
        StockBatch savedBatch = batchRepository.save(batch);

        PharmacyResponse.MovementView movement = writeMovement(
                medicine, savedBatch, kind, quantity.abs(), balance, nz(savedBatch.getUnitCost()),
                request.reference(), request.reason(), request.prescriptionOrderId());

        log.info("Stock movement kind={} medicine={} qty={} balance={} by={}",
                kind, medicine.getCode(), quantity.abs(), balance, currentUser.userId());
        auditLogService.record(com.clinic.entity.AuditAction.RECORD_AMENDED, "STOCK_MOVEMENT",
                movement.id(), kind + " " + quantity.abs() + " of " + medicine.getName());
        return movement;
    }

    @Override
    @Transactional(readOnly = true)
    public PageResponse<PharmacyResponse.MovementView> listMovements(String medicineId, StockMovement.Kind kind,
                                                                      Pageable pageable) {
        Page<StockMovement> page;
        if (kind != null) {
            page = movementRepository.findByKindOrderByPerformedAtDesc(kind, pageable);
        } else if (medicineId != null && !medicineId.isBlank()) {
            page = movementRepository.findByMedicineIdOrderByPerformedAtDesc(medicineId, pageable);
        } else {
            page = movementRepository.findAllByOrderByPerformedAtDesc(pageable);
        }
        return PageResponse.of(page.map(PharmacyResponse.MovementView::from));
    }

    // ================= suppliers =================

    @Override
    @Transactional(readOnly = true)
    public List<PharmacyResponse.SupplierView> listSuppliers() {
        return supplierRepository.findAllByActiveTrueOrderByNameAsc().stream()
                .map(PharmacyResponse.SupplierView::from)
                .toList();
    }

    @Override
    public PharmacyResponse.SupplierView createSupplier(SupplierUpsertRequest request) {
        String name = request.name().trim();
        if (supplierRepository.existsByNameIgnoreCase(name)) {
            throw new BadRequestException("A supplier named " + name + " already exists");
        }

        Supplier supplier = Supplier.builder()
                .name(name)
                .contactName(trimToNull(request.contactName()))
                .email(trimToNull(request.email()))
                .phone(trimToNull(request.phone()))
                .address(trimToNull(request.address()))
                .active(request.active() == null || request.active())
                .build();

        return PharmacyResponse.SupplierView.from(supplierRepository.save(supplier));
    }

    @Override
    public PharmacyResponse.SupplierView updateSupplier(String id, SupplierUpsertRequest request) {
        Supplier supplier = getSupplier(id);
        String name = request.name().trim();
        if (!name.equalsIgnoreCase(supplier.getName())
                && supplierRepository.existsByNameIgnoreCaseAndIdNot(name, id)) {
            throw new BadRequestException("A supplier named " + name + " already exists");
        }

        supplier.setName(name);
        supplier.setContactName(trimToNull(request.contactName()));
        supplier.setEmail(trimToNull(request.email()));
        supplier.setPhone(trimToNull(request.phone()));
        supplier.setAddress(trimToNull(request.address()));
        if (request.active() != null) {
            supplier.setActive(request.active());
        }

        return PharmacyResponse.SupplierView.from(supplierRepository.save(supplier));
    }

    // ================= alerts & reporting =================

    @Override
    @Transactional(readOnly = true)
    public PharmacyResponse.AlertsView alerts() {
        LocalDate today = LocalDate.now();

        List<PharmacyResponse.MedicineView> outOfStock = medicineRepository.findOutOfStock(today).stream()
                .map(PharmacyResponse.MedicineView::from)
                .toList();
        List<PharmacyResponse.MedicineView> lowStock = medicineRepository.findLowStock(today).stream()
                .filter(medicine -> medicineRepository.findOutOfStock(today).stream()
                        .noneMatch(candidate -> candidate.getId().equals(medicine.getId())))
                .map(PharmacyResponse.MedicineView::from)
                .toList();

        List<PharmacyResponse.BatchView> expiringSoon = batchRepository
                .findExpiring(today.plusDays(expiryWarningDays)).stream()
                .filter(batch -> !batch.isExpired(today))
                .map(batch -> PharmacyResponse.BatchView.from(batch, today, expiryWarningDays))
                .toList();

        List<PharmacyResponse.BatchView> expired = batchRepository
                .findExpiring(today).stream()
                .filter(batch -> batch.isExpired(today))
                .map(batch -> PharmacyResponse.BatchView.from(batch, today, expiryWarningDays))
                .toList();

        return new PharmacyResponse.AlertsView(outOfStock, lowStock, expiringSoon, expired);
    }

    @Override
    @Transactional(readOnly = true)
    public Map<String, Object> inventorySummary(LocalDateTime from, LocalDateTime to) {
        LocalDateTime start = from != null ? from : LocalDate.now().withDayOfMonth(1).atStartOfDay();
        LocalDateTime end = to != null ? to : LocalDateTime.now();
        LocalDate today = LocalDate.now();

        Map<String, Object> summary = new LinkedHashMap<>();
        summary.put("medicines", medicineRepository.countByActiveTrue());
        summary.put("suppliers", supplierRepository.countByActiveTrue());
        summary.put("stockValue", nz(medicineRepository.totalStockValue(today)));
        summary.put("valueReceivedInPeriod", nz(movementRepository.valueReceived(start, end)));
        summary.put("costOfGoodsDispensedInPeriod",
                nz(movementRepository.costOfGoodsDispensed(start, end)));

        Map<String, Long> byKind = new LinkedHashMap<>();
        for (StockMovement.Kind kind : StockMovement.Kind.values()) {
            byKind.put(kind.name(), 0L);
        }
        movementRepository.countGroupedByKind().forEach(row -> {
            if (row[0] instanceof StockMovement.Kind kind) {
                byKind.put(kind.name(), ((Number) row[1]).longValue());
            }
        });
        summary.put("movementsByKind", byKind);

        summary.put("outOfStock", medicineRepository.findOutOfStock(today).size());
        summary.put("lowStock", medicineRepository.findLowStock(today).size());
        summary.put("expiringSoon", batchRepository.findExpiring(today.plusDays(expiryWarningDays)).stream()
                .filter(batch -> !batch.isExpired(today))
                .count());
        summary.put("expired", batchRepository.findExpiring(today).stream()
                .filter(batch -> batch.isExpired(today))
                .count());

        return summary;
    }

    // ================= helpers =================

    private PharmacyResponse.MovementView writeMovement(Medicine medicine, StockBatch batch,
                                                        StockMovement.Kind kind, BigDecimal quantity,
                                                        BigDecimal balanceAfter, BigDecimal unitCost,
                                                        String reference, String reason,
                                                        String prescriptionOrderId) {
        StockMovement movement = StockMovement.builder()
                .medicine(medicine)
                .batch(batch)
                .kind(kind)
                .quantity(quantity)
                .balanceAfter(balanceAfter)
                .unitCost(unitCost)
                .reference(trimToNull(reference))
                .reason(trimToNull(reason))
                .performedById(currentUser.userId())
                .performedByName(currentUser.require().getUsername())
                .prescriptionOrderId(trimToNull(prescriptionOrderId))
                .performedAt(LocalDateTime.now())
                .build();

        StockMovement saved = movementRepository.save(movement);
        return PharmacyResponse.MovementView.from(saved);
    }

    /** Live (unexpired) stock per medicine id. */
    private Map<String, BigDecimal> liveStockByMedicine() {
        Map<String, BigDecimal> totals = new java.util.HashMap<>();
        medicineRepository.totalLiveStockByMedicine(LocalDate.now())
                .forEach(row -> totals.put((String) row[0], nz((BigDecimal) row[1])));
        return totals;
    }

    private PharmacyResponse toResponse(Medicine medicine, Map<String, BigDecimal> totals) {
        BigDecimal live = totals.getOrDefault(medicine.getId(), BigDecimal.ZERO);
        BigDecimal reorder = nz(medicine.getReorderLevel());
        LocalDate today = LocalDate.now();

        return new PharmacyResponse(
                PharmacyResponse.MedicineView.from(medicine),
                live,
                reorder,
                live.compareTo(reorder) <= 0 && live.signum() > 0,
                live.signum() <= 0,
                batchRepository.findByMedicineIdOrderByExpiryDateAsc(medicine.getId()).stream()
                        .map(batch -> PharmacyResponse.BatchView.from(batch, today, expiryWarningDays))
                        .toList());
    }

    private boolean matches(PharmacyResponse response, String query, String category) {
        String needle = query == null ? "" : query.trim().toLowerCase(Locale.ROOT);
        List<String> searchable = List.of(
                response.medicine().name() == null ? "" : response.medicine().name(),
                response.medicine().code() == null ? "" : response.medicine().code(),
                response.medicine().category() == null ? "" : response.medicine().category());

        boolean matchesQuery = needle.isEmpty()
                || searchable.stream().anyMatch(value -> value.toLowerCase(Locale.ROOT).contains(needle));

        boolean matchesCategory = category == null || category.isBlank()
                || category.equalsIgnoreCase(response.medicine().category());

        return matchesQuery && matchesCategory;
    }

    private Medicine getMedicineEntity(String id) {
        return medicineRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Medicine not found: " + id));
    }

    private StockBatch getBatchWithRelations(String id) {
        return batchRepository.findWithRelationsById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Stock batch not found: " + id));
    }

    private Supplier getSupplier(String id) {
        return supplierRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Supplier not found: " + id));
    }

    private StockMovement.Kind parseKind(String value) {
        try {
            return StockMovement.Kind.valueOf(value.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException | NullPointerException e) {
            throw new BadRequestException("kind must be one of RECEIVED, DISPENSED, RETURNED, "
                    + "DAMAGED, EXPIRED, ADJUSTED");
        }
    }

    private BigDecimal signedQuantity(StockMovement.Kind kind, BigDecimal quantity) {
        return switch (kind) {
            case RECEIVED, RETURNED -> quantity.abs();
            case DISPENSED, DAMAGED, EXPIRED -> quantity.abs().negate();
            case ADJUSTED -> quantity.signum() >= 0 ? quantity.abs() : quantity.abs().negate();
        };
    }

    private static BigDecimal nz(BigDecimal value) {
        return value == null ? BigDecimal.ZERO : value;
    }

    private static String blankTo(String value, String fallback) {
        return value == null || value.isBlank() ? fallback : value.trim();
    }

    private static String trimToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    private static String normaliseCode(String code) {
        return code.trim().toUpperCase(Locale.ROOT);
    }
}