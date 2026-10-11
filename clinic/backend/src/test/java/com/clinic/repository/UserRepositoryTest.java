package com.clinic.repository;

import com.clinic.entity.Patient;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.test.context.ActiveProfiles;

import java.util.UUID;

import static com.clinic.support.TestFixtures.*;
import static org.junit.jupiter.api.Assertions.*;

@DataJpaTest
@ActiveProfiles("test")
class UserRepositoryTest {

    @Autowired
    private UserRepository userRepository;

    @Test
    void findByEmailReturnsSavedUser() {
        Patient patient = patientEntity(UUID.randomUUID());
        userRepository.save(patient);

        assertTrue(userRepository.findByEmail("patient@example.com").isPresent());
        assertTrue(userRepository.findByEmailAndActiveTrue("patient@example.com").isPresent());
    }

    @Test
    void deleteUsesSoftDeleteSemantics() {
        Patient patient = patientEntity(UUID.randomUUID());
        Patient saved = userRepository.save(patient);

        userRepository.delete(saved);

        assertTrue(userRepository.findById(saved.getId()).isEmpty());
        assertTrue(userRepository.findByEmailAndActiveTrue("patient@example.com").isEmpty());
    }

    @Test
    void searchHandlesAllNullFiltersWithoutException() {
        Patient patient = patientEntity(UUID.randomUUID());
        userRepository.save(patient);

        org.springframework.data.domain.Page<com.clinic.entity.User> page = userRepository.search(
                null, null, null, null, null,
                org.springframework.data.domain.PageRequest.of(0, 10));

        assertNotNull(page);
        assertFalse(page.isEmpty());
    }

    @Test
    void searchFiltersByRoleAndDepartment() {
        Patient patient = patientEntity(UUID.randomUUID());
        patient.setDepartment("cardiology");
        userRepository.save(patient);

        org.springframework.data.domain.Page<com.clinic.entity.User> match = userRepository.search(
                com.clinic.entity.UserRole.PATIENT, true, null, "cardiology", null,
                org.springframework.data.domain.PageRequest.of(0, 10));
        assertFalse(match.isEmpty());

        org.springframework.data.domain.Page<com.clinic.entity.User> noMatch = userRepository.search(
                com.clinic.entity.UserRole.CASHIER, null, null, null, null,
                org.springframework.data.domain.PageRequest.of(0, 10));
        assertTrue(noMatch.isEmpty());
    }
}
