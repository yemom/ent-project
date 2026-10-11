package com.clinic.service;

import com.clinic.dto.request.MedicineUpsertRequest;
import com.clinic.dto.request.StockMovementRequest;
import com.clinic.dto.request.StockReceiptRequest;
import com.clinic.dto.request.SupplierUpsertRequest;
import com.clinic.dto.response.PageResponse;
import com.clinic.dto.response.PharmacyResponse;
import com.clinic.entity.StockMovement;
import org.springframework.data.domain.Pageable;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

/**
 * Pharmacy catalogue, stock ledger and alerts.
 *
 * <p>Writes carry {@code inventory:manage} / {@code batch:manage} (pharmacist and
 * admin); dispensing carries {@code prescription:dispense}.
 */
public interface PharmacyService {

    // ---------------- catalogue ----------------

    PageResponse<PharmacyResponse> listMedicines(String query, String category, boolean onlyAlerts,
                                                 Pageable pageable);

    PharmacyResponse getMedicine(String id);

    PharmacyResponse.MedicineView createMedicine(MedicineUpsertRequest request);

    PharmacyResponse.MedicineView updateMedicine(String id, MedicineUpsertRequest request);

    void deleteMedicine(String id);

    List<String> listCategories();

    // ---------------- stock ----------------

    PageResponse<PharmacyResponse.BatchView> listBatches(String medicineId, Pageable pageable);

    PharmacyResponse.MovementView receiveStock(StockReceiptRequest request);

    PharmacyResponse.MovementView recordMovement(StockMovementRequest request);

    PageResponse<PharmacyResponse.MovementView> listMovements(String medicineId, StockMovement.Kind kind,
                                                                Pageable pageable);

    // ---------------- suppliers ----------------

    List<PharmacyResponse.SupplierView> listSuppliers();

    PharmacyResponse.SupplierView createSupplier(SupplierUpsertRequest request);

    PharmacyResponse.SupplierView updateSupplier(String id, SupplierUpsertRequest request);

    // ---------------- alerts & reporting ----------------

    PharmacyResponse.AlertsView alerts();

    /**
     * Inventory and dispensing figures for the dashboard.
     *
     * <p>Stock value, purchase value received and cost of goods dispensed are kept
     * distinct: a delivery is not a cost until the stock is dispensed, and neither is
     * revenue.
     */
    Map<String, Object> inventorySummary(LocalDateTime from, LocalDateTime to);
}