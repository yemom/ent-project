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
}
