package com.clinic.repository;

import com.clinic.entity.Doctor;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.test.context.ActiveProfiles;

import java.util.UUID;

import static com.clinic.support.TestFixtures.*;
import static org.junit.jupiter.api.Assertions.*;

@DataJpaTest
@ActiveProfiles("test")
class DoctorRepositoryTest {

    @Autowired
    private DoctorRepository doctorRepository;

    @Test
    void saveFindsDoctor() {
        Doctor doctor = doctorEntity(UUID.randomUUID());
        doctorRepository.save(doctor);

        assertTrue(doctorRepository.findByEmail("doctor@example.com").isPresent());
    }
}
