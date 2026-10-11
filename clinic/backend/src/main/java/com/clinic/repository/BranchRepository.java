package com.clinic.repository;

import com.clinic.entity.Branch;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

@Repository
public interface BranchRepository extends JpaRepository<Branch, String>, JpaSpecificationExecutor<Branch> {

    boolean existsByCode(String code);

    @Query("SELECT b FROM Branch b WHERE b.deleted = false AND " +
           "(LOWER(b.name) LIKE LOWER(CONCAT('%', :q, '%')) OR " +
           "LOWER(b.code) LIKE LOWER(CONCAT('%', :q, '%')))")
    Page<Branch> search(@Param("q") String q, Pageable pageable);
}
