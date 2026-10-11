package com.clinic.dto.response;

import com.clinic.entity.Medicine;
import com.clinic.entity.StockBatch;
import com.clinic.entity.StockMovement;
import com.clinic.entity.Supplier;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

/**
 * Pharmacy read models.
 *
 * <p>Every stock figure here is derived from live batches; nothing is cached in the
 * catalogue row, so a medicine's reported quantity cannot drift from the ledger.
 */
public record PharmacyResponse(
        MedicineView medicine,
        BigDecimal totalLiveStock,
        BigDecimal reorderLevel,
        boolean lowStock,
        boolean outOfStock,
        List<BatchView> batches
) {
    public record MedicineView(
            String id,
            String name,
            String code,
            String category,
            String form,
            String strength,
            String unit,
            BigDecimal reorderLevel,
            BigDecimal unitCost,
            boolean requiresPrescription,
            boolean active,
            LocalDateTime createdAt
    ) {
        public static MedicineView from(Medicine medicine) {
            return new MedicineView(
                    medicine.getId(),
                    medicine.getName(),
                    medicine.getCode(),
                    medicine.getCategory(),
                    medicine.getForm(),
                    medicine.getStrength(),
                    medicine.getUnit(),
                    medicine.getReorderLevel(),
                    medicine.getUnitCost(),
                    Boolean.TRUE.equals(medicine.getRequiresPrescription()),
                    Boolean.TRUE.equals(medicine.getActive()),
                    medicine.getCreatedAt()
            );
        }
    }

    public record BatchView(
            String id,
            String medicineId,
            String medicineName,
            String batchNumber,
            String supplierId,
            String supplierName,
            LocalDate expiryDate,
            BigDecimal quantity,
            BigDecimal unitCost,
            BigDecimal stockValue,
            LocalDateTime receivedAt,
            String notes,
            boolean expired,
            boolean expiringSoon
    ) {
        public static BatchView from(StockBatch batch, LocalDate today, int expiryWarningDays) {
            BigDecimal quantity = batch.getQuantity() == null ? BigDecimal.ZERO : batch.getQuantity();
            BigDecimal cost = batch.getUnitCost() == null ? BigDecimal.ZERO : batch.getUnitCost();

            return new BatchView(
                    batch.getId(),
                    batch.getMedicine() != null ? batch.getMedicine().getId() : null,
                    batch.getMedicine() != null ? batch.getMedicine().getName() : null,
                    batch.getBatchNumber(),
                    batch.getSupplier() != null ? batch.getSupplier().getId() : null,
                    batch.getSupplier() != null ? batch.getSupplier().getName() : null,
                    batch.getExpiryDate(),
                    quantity,
                    cost,
                    quantity.multiply(cost),
                    batch.getReceivedAt(),
                    batch.getNotes(),
                    batch.isExpired(today),
                    batch.isExpiringWithin(today, expiryWarningDays)
            );
        }
    }

    public record MovementView(
            String id,
            String medicineId,
            String medicineName,
            String batchId,
            String batchNumber,
            String kind,
            BigDecimal quantity,
            BigDecimal balanceAfter,
            BigDecimal unitCost,
            String reference,
            String reason,
            String performedById,
            String performedByName,
            String prescriptionOrderId,
            LocalDateTime performedAt
    ) {
        public static MovementView from(StockMovement movement) {
            return new MovementView(
                    movement.getId(),
                    movement.getMedicine() != null ? movement.getMedicine().getId() : null,
                    movement.getMedicine() != null ? movement.getMedicine().getName() : null,
                    movement.getBatch() != null ? movement.getBatch().getId() : null,
                    movement.getBatch() != null ? movement.getBatch().getBatchNumber() : null,
                    movement.getKind() != null ? movement.getKind().name() : null,
                    movement.getQuantity(),
                    movement.getBalanceAfter(),
                    movement.getUnitCost(),
                    movement.getReference(),
                    movement.getReason(),
                    movement.getPerformedById(),
                    movement.getPerformedByName(),
                    movement.getPrescriptionOrderId(),
                    movement.getPerformedAt()
            );
        }
    }

    public record SupplierView(
            String id,
            String name,
            String contactName,
            String email,
            String phone,
            String address,
            boolean active,
            LocalDateTime createdAt
    ) {
        public static SupplierView from(Supplier supplier) {
            return new SupplierView(
                    supplier.getId(),
                    supplier.getName(),
                    supplier.getContactName(),
                    supplier.getEmail(),
                    supplier.getPhone(),
                    supplier.getAddress(),
                    Boolean.TRUE.equals(supplier.getActive()),
                    supplier.getCreatedAt()
            );
        }
    }

    /**
     * Alert summary for the dashboard.
     *
     * <p>Separates out-of-stock from low-stock: they need different actions, and
     * collapsing them into one number hides a medicine that cannot be dispensed at
     * all behind one that is merely running down.
     */
    public record AlertsView(
            List<MedicineView> outOfStock,
            List<MedicineView> lowStock,
            List<BatchView> expiringSoon,
            List<BatchView> expired
    ) {
    }
}