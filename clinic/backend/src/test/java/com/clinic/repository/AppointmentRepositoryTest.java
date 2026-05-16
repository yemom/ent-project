package com.clinic.repository;

import com.clinic.entity.Appointment;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.test.context.ActiveProfiles;

import java.util.UUID;

import static com.clinic.support.TestFixtures.*;
import static org.junit.jupiter.api.Assertions.*;

@DataJpaTest
@ActiveProfiles("test")
class AppointmentRepositoryTest {

    @Autowired
    private AppointmentRepository appointmentRepository;

    @Autowired
    private UserRepository userRepository;

    @Test
    void saveAndFind() {
        var patient = userRepository.save(patientEntity(UUID.randomUUID()));
        var doctor = userRepository.save(doctorEntity(UUID.randomUUID()));
        Appointment appt = appointmentEntity(UUID.randomUUID(), patient, doctor);
        appointmentRepository.save(appt);

        assertTrue(appointmentRepository.findById(appt.getId()).isPresent());
    }
}
