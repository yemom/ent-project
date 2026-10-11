package com.clinic.repository;

import com.clinic.entity.Medicine;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

@Repository
public interface MedicineRepository extends JpaRepository<Medicine, String> {

    Optional<Medicine> findByCode(String code);

    boolean existsByCode(String code);

    boolean existsByCodeAndIdNot(String code, String id);

    List<Medicine> findAllByActiveTrueOrderByNameAsc();

    Page<Medicine> findAllByActiveTrue(Pageable pageable);

    long countByActiveTrue();

    /**
     * Total live stock per medicine, excluding batches already past expiry.
     *
     * <p>Expired lots are deliberately excluded: they are not usable stock, and
     * including them would let an expiring medicine look plentiful and suppress a
     * low-stock alert that is genuinely warranted.
     */
    @Query("""
            select b.medicine.id, sum(b.quantity)
            from StockBatch b
            where b.deleted = false
              and b.expiryDate > :today
            group by b.medicine.id
            """)
    List<Object[]> totalLiveStockByMedicine(@Param("today") java.time.LocalDate today);

    /** Medicines at or below their reorder level, i.e. the low-stock list. */
    @Query("""
            select m from Medicine m
            where m.active = true
              and m.deleted = false
              and coalesce((
                    select sum(b.quantity) from StockBatch b
                    where b.medicine.id = m.id
                      and b.deleted = false
                      and b.expiryDate > :today
              ), 0) <= m.reorderLevel
            order by m.name asc
            """)
    List<Medicine> findLowStock(@Param("today") java.time.LocalDate today);

    /** Medicines with no usable stock at all. */
    @Query("""
            select m from Medicine m
            where m.active = true
              and m.deleted = false
              and not exists (
                    select 1 from StockBatch b
                    where b.medicine.id = m.id
                      and b.deleted = false
                      and b.quantity > 0
                      and b.expiryDate > :today
              )
            order by m.name asc
            """)
    List<Medicine> findOutOfStock(@Param("today") java.time.LocalDate today);

    /** Total purchase value currently held across live batches. */
    @Query("""
            select coalesce(sum(b.quantity * b.unitCost), 0)
            from StockBatch b
            where b.deleted = false and b.expiryDate > :today
            """)
    BigDecimal totalStockValue(@Param("today") java.time.LocalDate today);
}