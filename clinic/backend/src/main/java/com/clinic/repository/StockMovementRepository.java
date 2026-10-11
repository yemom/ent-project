package com.clinic.repository;

import com.clinic.entity.StockMovement;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface StockMovementRepository extends JpaRepository<StockMovement, String> {

    @EntityGraph(attributePaths = {"medicine"})
    Page<StockMovement> findAllByOrderByPerformedAtDesc(Pageable pageable);

    @EntityGraph(attributePaths = {"medicine"})
    Page<StockMovement> findByMedicineIdOrderByPerformedAtDesc(String medicineId, Pageable pageable);

    @EntityGraph(attributePaths = {"medicine"})
    Page<StockMovement> findByKindOrderByPerformedAtDesc(StockMovement.Kind kind, Pageable pageable);

    @EntityGraph(attributePaths = {"medicine"})
    List<StockMovement> findByMedicineIdOrderByPerformedAtDesc(String medicineId);

    @Query("select m.kind, count(m) from StockMovement m group by m.kind")
    List<Object[]> countGroupedByKind();

    /**
     * Cost of goods actually dispensed in a window.
     *
     * <p>Only DISPENSED counts: a RECEIVED is stock on the shelf, not a cost
     * incurred, and treating it as expense would double-count every purchase against
     * the matching dispense.
     */
    @Query("""
            select coalesce(sum(m.quantity * m.unitCost), 0)
            from StockMovement m
            where m.kind = com.clinic.entity.StockMovement.Kind.DISPENSED
              and m.performedAt between :from and :to
            """)
    BigDecimal costOfGoodsDispensed(@Param("from") LocalDateTime from, @Param("to") LocalDateTime to);

    /** Value of stock received in a window — purchasing activity, not revenue. */
    @Query("""
            select coalesce(sum(m.quantity * m.unitCost), 0)
            from StockMovement m
            where m.kind = com.clinic.entity.StockMovement.Kind.RECEIVED
              and m.performedAt between :from and :to
            """)
    BigDecimal valueReceived(@Param("from") LocalDateTime from, @Param("to") LocalDateTime to);
}