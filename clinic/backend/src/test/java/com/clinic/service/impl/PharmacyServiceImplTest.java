package com.clinic.service.impl;

import com.clinic.dto.request.MedicineUpsertRequest;
import com.clinic.dto.request.StockMovementRequest;
import com.clinic.dto.request.StockReceiptRequest;
import com.clinic.dto.request.SupplierUpsertRequest;
import com.clinic.dto.response.PharmacyResponse;
import com.clinic.entity.Medicine;
import com.clinic.entity.StockBatch;
import com.clinic.entity.StockMovement;
import com.clinic.entity.Supplier;
import com.clinic.exception.BadRequestException;
import com.clinic.repository.MedicineRepository;
import com.clinic.repository.StockBatchRepository;
import com.clinic.repository.StockMovementRepository;
import com.clinic.repository.SupplierRepository;
import com.clinic.security.CurrentUser;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Pharmacy stock invariants.
 *
 * <p>The behaviours asserted here are the ones that would let a pharmacy lose stock
 * or misstate its books: negative stock, ledger/balance disagreement, expired stock
 * counted as usable, and dispensing without a prescription.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class PharmacyServiceImplTest {

    @Mock
    private MedicineRepository medicineRepository;

    @Mock
    private StockBatchRepository batchRepository;

    @Mock
    private StockMovementRepository movementRepository;

    @Mock
    private SupplierRepository supplierRepository;

    @Mock
    private CurrentUser currentUser;

    @Mock
    private com.clinic.service.AuditLogService auditLogService;

    private PharmacyServiceImpl service;

    private static final String MEDICINE_ID = "med-1";
    private static final String BATCH_ID = "batch-1";

    @BeforeEach
    void setUp() {
        service = new PharmacyServiceImpl(medicineRepository, batchRepository, movementRepository,
                supplierRepository, currentUser, auditLogService);

        var user = com.clinic.entity.Pharmacist.builder()
                .email("pharmacist@example.com")
                .fullName("Test Pharmacist")
                .password("x")
                .role(com.clinic.entity.UserRole.PHARMACIST)
                .employeeNumber("PH-1")
                .build();
        user.setId("pharm-1");
        var principal = new com.clinic.security.CustomUserPrincipal(user);
        lenient().when(currentUser.userId()).thenReturn("pharm-1");
        lenient().when(currentUser.require()).thenReturn(principal);
        lenient().when(currentUser.is(any())).thenReturn(false);

        lenient().when(medicineRepository.findById(anyString())).thenReturn(Optional.empty());
        lenient().when(batchRepository.findWithRelationsById(anyString())).thenReturn(Optional.empty());
        lenient().when(batchRepository.findByMedicineIdOrderByExpiryDateAsc(anyString()))
                .thenReturn(List.of());
        lenient().when(movementRepository.save(any(StockMovement.class)))
                .thenAnswer(inv -> inv.getArgument(0));
        lenient().when(batchRepository.save(any(StockBatch.class)))
                .thenAnswer(inv -> inv.getArgument(0));
        lenient().when(medicineRepository.save(any(Medicine.class)))
                .thenAnswer(inv -> inv.getArgument(0));
        lenient().when(supplierRepository.save(any(Supplier.class)))
                .thenAnswer(inv -> inv.getArgument(0));
        lenient().when(medicineRepository.totalLiveStockByMedicine(any())).thenReturn(List.of());
        lenient().when(medicineRepository.findLowStock(any())).thenReturn(List.of());
        lenient().when(medicineRepository.findOutOfStock(any())).thenReturn(List.of());
        lenient().when(batchRepository.findExpiring(any())).thenReturn(List.of());
    }

    // ---------------- catalogue ----------------

    @Test
    void rejectsDuplicateMedicineCode() {
        when(medicineRepository.existsByCode("PARA500")).thenReturn(true);

        BadRequestException error = assertThrows(BadRequestException.class, () ->
                service.createMedicine(new MedicineUpsertRequest("Paracetamol", "para500",
                        "ANALGESIC", null, "500mg", "tablet", BigDecimal.TEN, BigDecimal.ONE, true, true)));

        assertTrue(error.getMessage().contains("already exists"));
        verify(medicineRepository, never()).save(any(Medicine.class));
    }

    @Test
    void medicineCodeIsNormalisedSoCasingCannotDuplicate() {
        // "para500" and "PARA500" must not both exist.
        when(medicineRepository.existsByCode("PARA500")).thenReturn(false);
        service.createMedicine(new MedicineUpsertRequest("Paracetamol", "para500",
                null, null, null, null, null, null, null, null));

        ArgumentCaptor<Medicine> saved = ArgumentCaptor.forClass(Medicine.class);
        verify(medicineRepository).save(saved.capture());
        assertEquals("PARA500", saved.getValue().getCode());
        assertEquals("GENERAL", saved.getValue().getCategory(), "a blank category must fall back, not store null");
    }

    @Test
    void refusesToDeleteAMedicineThatStillHoldsStock() {
        when(medicineRepository.findById(MEDICINE_ID)).thenReturn(Optional.of(medicine()));
        when(batchRepository.totalLiveQuantity(MEDICINE_ID, LocalDate.now())).thenReturn(new BigDecimal("5"));

        BadRequestException error = assertThrows(BadRequestException.class,
                () -> service.deleteMedicine(MEDICINE_ID));

        assertTrue(error.getMessage().contains("holds stock"));
        verify(medicineRepository, never()).delete(any(Medicine.class));
    }

    // ---------------- receiving ----------------

    @Test
    void receivingCreatesTheBatchAndWritesALedgerEntry() {
        when(medicineRepository.findById(MEDICINE_ID)).thenReturn(Optional.of(medicine()));
        when(batchRepository.findByMedicineIdOrderByExpiryDateAsc(MEDICINE_ID)).thenReturn(List.of());

        PharmacyResponse.MovementView movement = service.receiveStock(new StockReceiptRequest(
                MEDICINE_ID, null, "B-1", LocalDate.now().plusMonths(6),
                new BigDecimal("100"), new BigDecimal("2.50"), "DN-77", "First delivery"));

        ArgumentCaptor<StockBatch> batch = ArgumentCaptor.forClass(StockBatch.class);
        verify(batchRepository).save(batch.capture());
        assertEquals(new BigDecimal("100"), batch.getValue().getQuantity());
        assertEquals("B-1", batch.getValue().getBatchNumber());
        assertEquals(new BigDecimal("2.50"), batch.getValue().getUnitCost(),
                "cost must be captured on the batch so later price changes do not rewrite history");

        assertEquals("RECEIVED", movement.kind());
        assertEquals(new BigDecimal("100"), movement.balanceAfter());
        assertEquals("pharm-1", movement.performedById());
        assertEquals("DN-77", movement.reference());
    }

    @Test
    void redeliveryOfTheSameLotTopsUpInsteadOfDuplicating() {
        when(medicineRepository.findById(MEDICINE_ID)).thenReturn(Optional.of(medicine()));
        when(batchRepository.findByMedicineIdOrderByExpiryDateAsc(MEDICINE_ID))
                .thenReturn(List.of(batch(new BigDecimal("40"))));

        service.receiveStock(new StockReceiptRequest(MEDICINE_ID, null, "B-1",
                LocalDate.now().plusMonths(6), new BigDecimal("10"), new BigDecimal("2.50"), null, null));

        ArgumentCaptor<StockBatch> saved = ArgumentCaptor.forClass(StockBatch.class);
        verify(batchRepository).save(saved.capture());
        assertEquals(new BigDecimal("50"), saved.getValue().getQuantity());
    }

    @Test
    void refusesToReceiveAnAlreadyExpiredBatch() {
        when(medicineRepository.findById(MEDICINE_ID)).thenReturn(Optional.of(medicine()));

        assertThrows(BadRequestException.class, () -> service.receiveStock(new StockReceiptRequest(
                MEDICINE_ID, null, "B-OLD", LocalDate.now().minusDays(1),
                new BigDecimal("10"), null, null, null)));

        verify(movementRepository, never()).save(any(StockMovement.class));
    }

    // ---------------- movements ----------------

    @Test
    void dispensingReducesStockAndRecordsTheNewBalance() {
        when(batchRepository.findWithRelationsById(BATCH_ID))
                .thenReturn(Optional.of(batch(new BigDecimal("50"))));

        PharmacyResponse.MovementView movement = service.recordMovement(new StockMovementRequest(
                BATCH_ID, "DISPENSED", new BigDecimal("10"), "rx-1", null, "Against prescription"));

        assertEquals(new BigDecimal("40"), movement.balanceAfter());
        assertEquals(new BigDecimal("10"), movement.quantity(), "the ledger stores a positive magnitude");
        assertEquals("rx-1", movement.prescriptionOrderId());
    }

    @Test
    void refusesToDispenseMoreThanIsHeld() {
        when(batchRepository.findWithRelationsById(BATCH_ID))
                .thenReturn(Optional.of(batch(new BigDecimal("5"))));

        BadRequestException error = assertThrows(BadRequestException.class, () ->
                service.recordMovement(new StockMovementRequest(
                        BATCH_ID, "DISPENSED", new BigDecimal("10"), "rx-1", null, null)));

        assertTrue(error.getMessage().contains("only holds"));
        verify(movementRepository, never()).save(any(StockMovement.class));
    }

    @Test
    void prescriptionOnlyMedicineCannotBeDispensedWithoutAPrescription() {
        when(batchRepository.findWithRelationsById(BATCH_ID))
                .thenReturn(Optional.of(batch(new BigDecimal("50"))));

        assertThrows(BadRequestException.class, () -> service.recordMovement(new StockMovementRequest(
                BATCH_ID, "DISPENSED", new BigDecimal("1"), null, null, null)));

        verify(movementRepository, never()).save(any(StockMovement.class));
    }

    @Test
    void overTheCounterMedicineCanBeDispensedWithoutAPrescription() {
        when(batchRepository.findWithRelationsById(BATCH_ID)).thenReturn(Optional.of(
                batch(new BigDecimal("50"), false)));

        PharmacyResponse.MovementView movement = service.recordMovement(new StockMovementRequest(
                BATCH_ID, "DISPENSED", new BigDecimal("1"), null, null, "OTC sale"));

        assertEquals(new BigDecimal("49"), movement.balanceAfter());
    }

    @Test
    void returningStockAddsItBack() {
        when(batchRepository.findWithRelationsById(BATCH_ID))
                .thenReturn(Optional.of(batch(new BigDecimal("30"))));

        PharmacyResponse.MovementView movement = service.recordMovement(new StockMovementRequest(
                BATCH_ID, "RETURNED", new BigDecimal("5"), null, null, "Unused tablets"));

        assertEquals(new BigDecimal("35"), movement.balanceAfter());
    }

    @Test
    void adjustmentDirectionFollowsTheSignOfTheQuantity() {
        when(batchRepository.findWithRelationsById(BATCH_ID))
                .thenReturn(Optional.of(batch(new BigDecimal("30"))));

        PharmacyResponse.MovementView down = service.recordMovement(new StockMovementRequest(
                BATCH_ID, "ADJUSTED", new BigDecimal("-4"), null, null, "Stock count correction"));
        assertEquals(new BigDecimal("26"), down.balanceAfter());

        when(batchRepository.findWithRelationsById(BATCH_ID))
                .thenReturn(Optional.of(batch(new BigDecimal("30"))));
        PharmacyResponse.MovementView up = service.recordMovement(new StockMovementRequest(
                BATCH_ID, "ADJUSTED", new BigDecimal("4"), null, null, "Found in shelf"));
        assertEquals(new BigDecimal("34"), up.balanceAfter());
    }

    @Test
    void zeroQuantityMovementIsRejected() {
        when(batchRepository.findWithRelationsById(BATCH_ID))
                .thenReturn(Optional.of(batch(new BigDecimal("30"))));

        assertThrows(BadRequestException.class, () -> service.recordMovement(new StockMovementRequest(
                BATCH_ID, "DAMAGED", BigDecimal.ZERO, null, null, null)));
    }

    @Test
    void unknownMovementKindIsRejectedWithTheAcceptedList() {
        // The batch must resolve first, otherwise the test would pass on the wrong
        // error (a missing batch) rather than on the rejected movement type.
        when(batchRepository.findWithRelationsById(BATCH_ID))
                .thenReturn(Optional.of(batch(new BigDecimal("30"))));

        BadRequestException error = assertThrows(BadRequestException.class, () ->
                service.recordMovement(new StockMovementRequest(BATCH_ID, "SOLD", BigDecimal.ONE, null, null, null)));

        assertTrue(error.getMessage().contains("RECEIVED"));
    }

    // ---------------- summary ----------------

    @Test
    @SuppressWarnings("unchecked")
    void summarySeparatesPurchaseValueFromCostOfGoodsSold() {
        when(medicineRepository.countByActiveTrue()).thenReturn(5L);
        when(supplierRepository.countByActiveTrue()).thenReturn(2L);
        when(medicineRepository.totalStockValue(any())).thenReturn(new BigDecimal("1000"));
        when(movementRepository.valueReceived(any(), any())).thenReturn(new BigDecimal("400"));
        when(movementRepository.costOfGoodsDispensed(any(), any())).thenReturn(new BigDecimal("150"));
        when(movementRepository.countGroupedByKind())
                .thenReturn(List.<Object[]>of(new Object[]{StockMovement.Kind.RECEIVED, 3L}));

        Map<String, Object> summary = service.inventorySummary(null, null);

        assertEquals(new BigDecimal("1000"), summary.get("stockValue"));
        // A delivery is not an expense and neither is revenue; only dispensing is COGS.
        assertEquals(new BigDecimal("400"), summary.get("valueReceivedInPeriod"));
        assertEquals(new BigDecimal("150"), summary.get("costOfGoodsDispensedInPeriod"));

        Map<String, Long> byKind = (Map<String, Long>) summary.get("movementsByKind");
        assertEquals(3L, byKind.get("RECEIVED"));
        assertEquals(0L, byKind.get("DISPENSED"), "every kind must be present so the UI never renders undefined");
    }

    @Test
    void expiredStockIsNotCountedAsLiveStock() {
        when(medicineRepository.findOutOfStock(any())).thenReturn(List.of(medicine()));
        when(medicineRepository.findLowStock(any())).thenReturn(List.of(medicine()));
        when(batchRepository.findExpiring(any(LocalDate.class))).thenReturn(List.of());

        PharmacyResponse.AlertsView alerts = service.alerts();

        assertEquals(1, alerts.outOfStock().size());
        assertFalse(alerts.lowStock().stream().anyMatch(m -> m.id().equals(MEDICINE_ID)),
                "an out-of-stock medicine must not also be listed as merely low");
    }

    // ---------------- fixtures ----------------

    private Medicine medicine() {
        Medicine medicine = Medicine.builder()
                .name("Ceftriaxone")
                .code("CEF-1")
                .category("ANTIBIOTIC")
                .unit("vial")
                .reorderLevel(new BigDecimal("20"))
                .unitCost(new BigDecimal("5"))
                .requiresPrescription(true)
                .active(true)
                .build();
        medicine.setId(MEDICINE_ID);
        return medicine;
    }

    private StockBatch batch(BigDecimal quantity) {
        return batch(quantity, true);
    }

    private StockBatch batch(BigDecimal quantity, boolean requiresPrescription) {
        Medicine medicine = medicine();
        medicine.setRequiresPrescription(requiresPrescription);

        StockBatch batch = StockBatch.builder()
                .medicine(medicine)
                .batchNumber("B-1")
                .expiryDate(LocalDate.now().plusMonths(6))
                .quantity(quantity)
                .unitCost(new BigDecimal("5"))
                .receivedAt(LocalDateTime.now())
                .build();
        batch.setId(BATCH_ID);
        return batch;
    }
}