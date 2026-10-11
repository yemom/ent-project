package com.clinic.repository;

import com.clinic.entity.StockBatch;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

@Repository
public interface StockBatchRepository extends JpaRepository<StockBatch, String> {

    @EntityGraph(attributePaths = {"medicine", "supplier"})
    Optional<StockBatch> findWithRelationsById(String id);

    boolean existsByMedicineIdAndBatchNumber(String medicineId, String batchNumber);

    @EntityGraph(attributePaths = {"medicine", "supplier"})
    List<StockBatch> findByMedicineIdOrderByExpiryDateAsc(String medicineId);

    @EntityGraph(attributePaths = {"medicine", "supplier"})
    Page<StockBatch> findAllByOrderByExpiryDateAsc(Pageable pageable);

    /** Usable lots, nearest to expiry first — the order stock should be dispensed in. */
    @EntityGraph(attributePaths = {"medicine", "supplier"})
    @Query("""
            select b from StockBatch b
            where b.medicine.id = :medicineId
              and b.deleted = false
              and b.quantity > 0
              and b.expiryDate > :today
            order by b.expiryDate asc
            """)
    List<StockBatch> findUsableBatches(@Param("medicineId") String medicineId,
                                       @Param("today") LocalDate today);

    /** Lots expiring on or before {@code deadline} that still hold stock. */
    @EntityGraph(attributePaths = {"medicine", "supplier"})
    @Query("""
            select b from StockBatch b
            where b.deleted = false
              and b.quantity > 0
              and b.expiryDate <= :deadline
            order by b.expiryDate asc
            """)
    List<StockBatch> findExpiring(@Param("deadline") LocalDate deadline);

    long countByExpiryDateLessThanEqualAndQuantityGreaterThanAndDeletedFalse(LocalDate date, BigDecimal qty);

    @Query("""
            select coalesce(sum(b.quantity), 0)
            from StockBatch b
            where b.medicine.id = :medicineId and b.deleted = false and b.expiryDate > :today
            """)
    BigDecimal totalLiveQuantity(@Param("medicineId") String medicineId,
                                 @Param("today") LocalDate today);

    /** Distinct categories present in the catalogue, for the filter dropdown. */
    @Query("select distinct m.category from Medicine m where m.deleted = false order by m.category")
    List<String> findDistinctCategories();
}