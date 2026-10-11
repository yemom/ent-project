package com.clinic.repository;

import com.clinic.entity.Ward;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface WardRepository extends JpaRepository<Ward, String> {

    Optional<Ward> findByCode(String code);

    boolean existsByCode(String code);

    @EntityGraph(attributePaths = "department")
    List<Ward> findAllByActiveTrueOrderByNameAsc();

    @EntityGraph(attributePaths = "department")
    Page<Ward> findByDepartmentId(String departmentId, Pageable pageable);

    @EntityGraph(attributePaths = "department")
    Page<Ward> findAll(Pageable pageable);

    long countByActiveTrue();
}