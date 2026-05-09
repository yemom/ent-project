package com.clinic.repository;

import com.clinic.entity.MedicalRecord;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.test.context.ActiveProfiles;

import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static com.clinic.support.TestFixtures.*;

@DataJpaTest
@ActiveProfiles("test")
class MedicalRecordRepositoryTest {

    @Autowired
    private MedicalRecordRepository medicalRecordRepository;

    @Test
    void saveAndFindById() {
        MedicalRecord record = medicalRecordEntity(UUID.randomUUID(), patientEntity(UUID.randomUUID()), doctorEntity(UUID.randomUUID()), null);
        MedicalRecord saved = medicalRecordRepository.save(record);

        assertTrue(medicalRecordRepository.findById(saved.getId()).isPresent());
    }
}
