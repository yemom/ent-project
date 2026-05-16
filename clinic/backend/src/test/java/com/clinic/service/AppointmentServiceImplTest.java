package com.clinic.service;

import com.clinic.entity.Appointment;
import com.clinic.entity.Doctor;
import com.clinic.entity.Patient;
import com.clinic.mapper.AppointmentMapper;
import com.clinic.mapper.UserMapper;
import com.clinic.repository.AppointmentRepository;
import com.clinic.repository.DoctorRepository;
import com.clinic.repository.PatientRepository;
import com.clinic.service.impl.AppointmentServiceImpl;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;
import java.util.UUID;

import static com.clinic.support.TestFixtures.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AppointmentServiceImplTest {

    @Mock private AppointmentRepository appointmentRepository;
    @Mock private PatientRepository patientRepository;
    @Mock private DoctorRepository doctorRepository;
    private final AppointmentMapper appointmentMapper = new AppointmentMapper(new UserMapper());
    private AppointmentServiceImpl appointmentService;

    @org.junit.jupiter.api.BeforeEach
    void setUp() {
        appointmentService = new AppointmentServiceImpl(appointmentRepository, patientRepository, doctorRepository, appointmentMapper);
    }

    @Test
    void createPersistsAppointment() {
        UUID patientId = UUID.randomUUID();
        UUID doctorId = UUID.randomUUID();
        String patientIdValue = patientId.toString();
        String doctorIdValue = doctorId.toString();
        Patient patient = patientEntity(patientId);
        Doctor doctor = doctorEntity(doctorId);
        when(patientRepository.findById(patientIdValue)).thenReturn(Optional.of(patient));
        when(doctorRepository.findById(doctorIdValue)).thenReturn(Optional.of(doctor));
        when(appointmentRepository.save(any(Appointment.class))).thenAnswer(invocation -> invocation.getArgument(0));

        var response = appointmentService.create(appointmentCreateRequest(patientId, doctorId));

        assertEquals("Checkup", response.reasonForVisit());
    }

    @Test
    void findByIdReturnsAppointment() {
        String id = UUID.randomUUID().toString();
        when(appointmentRepository.findById(id)).thenReturn(Optional.of(appointmentEntity(UUID.fromString(id), patientEntity(UUID.randomUUID()), doctorEntity(UUID.randomUUID()))));

        var response = appointmentService.getById(id);

        assertNotNull(response);
    }
}
