package com.clinic.repository;

import com.clinic.entity.Appointment;
import com.clinic.entity.AppointmentStatus;
import com.clinic.entity.Doctor;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.test.context.ActiveProfiles;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

import static com.clinic.support.TestFixtures.*;
import static org.junit.jupiter.api.Assertions.*;

@DataJpaTest
@ActiveProfiles("test")
class AppointmentRepositoryTest {

    /** The statuses the booking rules treat as occupying a doctor's calendar. */
    private static final List<AppointmentStatus> BLOCKING = List.of(
            AppointmentStatus.SCHEDULED,
            AppointmentStatus.CONFIRMED,
            AppointmentStatus.COMPLETED);

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

    /**
     * The query behind double-booking detection.
     *
     * <p>It has to hold on H2 as well as PostgreSQL: the binding list is what keeps
     * the `in` clause portable, and the window bounds are exclusive so a slot that
     * merely touches the edge is left to the service's overlap arithmetic.
     */
    @Test
    void findBookableInWindowReturnsOnlyAppointmentsInsideTheWindow() {
        var patient = userRepository.save(patientEntity(UUID.randomUUID()));
        var doctor = userRepository.save(doctorEntity(UUID.randomUUID()));

        LocalDateTime base = LocalDateTime.now().plusDays(2).withSecond(0).withNano(0);
        Appointment inside = appointmentRepository.save(
                appointmentEntity(UUID.randomUUID(), patient, doctor, base.plusMinutes(60)));
        appointmentRepository.save(
                appointmentEntity(UUID.randomUUID(), patient, doctor, base.plusHours(6)));

        List<Appointment> found = appointmentRepository.findBookableInWindow(
                doctor.getId(), base, base.plusMinutes(90), BLOCKING);

        assertEquals(1, found.size());
        assertEquals(inside.getId(), found.get(0).getId());
    }

    @Test
    void findBookableInWindowIgnoresSlotsThatWereCancelled() {
        var patient = userRepository.save(patientEntity(UUID.randomUUID()));
        var doctor = userRepository.save(doctorEntity(UUID.randomUUID()));

        LocalDateTime base = LocalDateTime.now().plusDays(2).withSecond(0).withNano(0);
        Appointment cancelled = appointmentEntity(UUID.randomUUID(), patient, doctor, base.plusMinutes(60));
        cancelled.setStatus(AppointmentStatus.CANCELLED);
        appointmentRepository.save(cancelled);

        assertTrue(appointmentRepository.findBookableInWindow(
                        doctor.getId(), base, base.plusMinutes(90), BLOCKING)
                .isEmpty(),
                "a cancelled appointment must not keep blocking its slot");
    }

    @Test
    void findBookableInWindowIsScopedToOneDoctor() {
        var patient = userRepository.save(patientEntity(UUID.randomUUID()));
        var first = userRepository.save(doctorEntity(UUID.randomUUID()));
        // The fixture reuses one email and one licence number, so the second doctor
        // gets distinct ones to satisfy the unique indexes on users.
        Doctor secondDoctor = doctorEntity(UUID.randomUUID());
        secondDoctor.setEmail("doctor-" + UUID.randomUUID() + "@example.com");
        secondDoctor.setLicenseNumber("LIC-" + UUID.randomUUID());
        var second = userRepository.save(secondDoctor);

        LocalDateTime base = LocalDateTime.now().plusDays(2).withSecond(0).withNano(0);
        appointmentRepository.save(appointmentEntity(UUID.randomUUID(), patient, second, base.plusMinutes(60)));

        assertTrue(appointmentRepository.findBookableInWindow(
                        first.getId(), base, base.plusMinutes(90), BLOCKING)
                .isEmpty(),
                "another doctor's diary is none of this doctor's business");
    }
}