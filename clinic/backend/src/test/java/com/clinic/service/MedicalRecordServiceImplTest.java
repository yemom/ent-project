package com.clinic.service;

import com.clinic.entity.Appointment;
import com.clinic.entity.Doctor;
import com.clinic.entity.MedicalRecord;
import com.clinic.entity.Patient;
import com.clinic.mapper.AppointmentMapper;
import com.clinic.mapper.MedicalRecordMapper;
import com.clinic.mapper.UserMapper;
import com.clinic.repository.AppointmentRepository;
import com.clinic.repository.DoctorRepository;
import com.clinic.repository.MedicalRecordRepository;
import com.clinic.repository.PatientRepository;
import com.clinic.service.impl.MedicalRecordServiceImpl;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static com.clinic.support.TestFixtures.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class MedicalRecordServiceImplTest {

    @Mock private MedicalRecordRepository medicalRecordRepository;
    @Mock private PatientRepository patientRepository;
    @Mock private DoctorRepository doctorRepository;
    @Mock private AppointmentRepository appointmentRepository;
    private final MedicalRecordMapper medicalRecordMapper = new MedicalRecordMapper(new AppointmentMapper(new UserMapper()), new UserMapper());
    private MedicalRecordServiceImpl medicalRecordService;

    @org.junit.jupiter.api.BeforeEach
    void setUp() {
        medicalRecordService = new MedicalRecordServiceImpl(medicalRecordRepository, patientRepository, doctorRepository, appointmentRepository, medicalRecordMapper);
    }

    @Test
    void createPersistsMedicalRecord() {
        UUID patientId = UUID.randomUUID();
        UUID doctorId = UUID.randomUUID();
        UUID appointmentId = UUID.randomUUID();
        Patient patient = patientEntity(patientId);
        Doctor doctor = doctorEntity(doctorId);
        Appointment appointment = appointmentEntity(appointmentId, patient, doctor);
        when(patientRepository.findById(patientId)).thenReturn(Optional.of(patient));
        when(doctorRepository.findById(doctorId)).thenReturn(Optional.of(doctor));
        when(appointmentRepository.findById(appointmentId)).thenReturn(Optional.of(appointment));
        when(medicalRecordRepository.save(any(MedicalRecord.class))).thenAnswer(invocation -> invocation.getArgument(0));

        var response = medicalRecordService.create(medicalRecordCreateRequest(patientId, doctorId, appointmentId));

        assertTrue(response.confidential());
        assertEquals("Diagnosis", response.diagnosis());
    }

    @Test
    void updateAppliesChanges() {
        UUID patientId = UUID.randomUUID();
        UUID doctorId = UUID.randomUUID();
        UUID appointmentId = UUID.randomUUID();
        UUID recordId = UUID.randomUUID();
        Patient patient = patientEntity(patientId);
        Doctor doctor = doctorEntity(doctorId);
        Appointment appointment = appointmentEntity(appointmentId, patient, doctor);
        MedicalRecord record = medicalRecordEntity(recordId, patient, doctor, appointment);
        when(medicalRecordRepository.findById(recordId)).thenReturn(Optional.of(record));
        when(patientRepository.findById(patientId)).thenReturn(Optional.of(patient));
        when(doctorRepository.findById(doctorId)).thenReturn(Optional.of(doctor));
        when(appointmentRepository.findById(appointmentId)).thenReturn(Optional.of(appointment));
        when(medicalRecordRepository.save(any(MedicalRecord.class))).thenAnswer(invocation -> invocation.getArgument(0));

        var response = medicalRecordService.update(recordId, medicalRecordUpdateRequest(patientId, doctorId, appointmentId));

        assertEquals("Updated Diagnosis", response.diagnosis());
        assertFalse(response.confidential());
    }

    @Test
    void searchReturnsPage() {
        UUID patientId = UUID.randomUUID();
        UUID doctorId = UUID.randomUUID();
        UUID appointmentId = UUID.randomUUID();
        MedicalRecord record = medicalRecordEntity(UUID.randomUUID(), patientEntity(patientId), doctorEntity(doctorId), appointmentEntity(appointmentId, patientEntity(patientId), doctorEntity(doctorId)));
        when(medicalRecordRepository.findAll(org.mockito.ArgumentMatchers.<Specification<MedicalRecord>>any(), any(Pageable.class))).thenReturn(new PageImpl<>(List.of(record)));

        var page = medicalRecordService.search(medicalRecordSearchRequest(patientId, doctorId, appointmentId), PageRequest.of(0, 20));

        assertEquals(1, page.getTotalElements());
    }

    @Test
    void deleteRemovesMedicalRecord() {
        UUID id = UUID.randomUUID();
        MedicalRecord record = medicalRecordEntity(id, patientEntity(UUID.randomUUID()), doctorEntity(UUID.randomUUID()), null);
        when(medicalRecordRepository.findById(id)).thenReturn(Optional.of(record));

        medicalRecordService.delete(id);

        verify(medicalRecordRepository).delete(record);
    }
}
