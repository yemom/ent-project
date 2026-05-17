package com.clinic.repository;

import com.clinic.entity.Laboratory;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface LaboratoryRepository extends JpaRepository<Laboratory, String>, JpaSpecificationExecutor<Laboratory> {

    Optional<Laboratory> findByName(String name);

    List<Laboratory> findByStatus(String status);

    boolean existsByName(String name);
}
