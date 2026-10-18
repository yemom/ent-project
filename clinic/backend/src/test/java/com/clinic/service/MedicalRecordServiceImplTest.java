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
import com.clinic.repository.MedicalRecordAmendmentRepository;
import com.clinic.repository.MedicalRecordRepository;
import com.clinic.repository.PatientRepository;
import com.clinic.security.CurrentUser;
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
    @Mock private MedicalRecordAmendmentRepository amendmentRepository;
    @Mock private PatientRepository patientRepository;
    @Mock private DoctorRepository doctorRepository;
    @Mock private AppointmentRepository appointmentRepository;
    @Mock private CurrentUser currentUser;
    private final MedicalRecordMapper medicalRecordMapper = new MedicalRecordMapper(new AppointmentMapper(), new UserMapper());
    private MedicalRecordServiceImpl medicalRecordService;

    @org.junit.jupiter.api.BeforeEach
    void setUp() {
        medicalRecordService = new MedicalRecordServiceImpl(medicalRecordRepository, amendmentRepository,
                patientRepository, doctorRepository, appointmentRepository, medicalRecordMapper, currentUser);
    }

    @Test
    void createPersistsMedicalRecord() {
        UUID patientId = UUID.randomUUID();
        UUID doctorId = UUID.randomUUID();
        UUID appointmentId = UUID.randomUUID();
        String patientIdValue = patientId.toString();
        String doctorIdValue = doctorId.toString();
        String appointmentIdValue = appointmentId.toString();
        Patient patient = patientEntity(patientId);
        Doctor doctor = doctorEntity(doctorId);
        Appointment appointment = appointmentEntity(appointmentId, patient, doctor);
        when(patientRepository.findById(patientIdValue)).thenReturn(Optional.of(patient));
        when(doctorRepository.findById(doctorIdValue)).thenReturn(Optional.of(doctor));
        when(appointmentRepository.findById(appointmentIdValue)).thenReturn(Optional.of(appointment));
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
        String patientIdValue = patientId.toString();
        String doctorIdValue = doctorId.toString();
        String appointmentIdValue = appointmentId.toString();
        String recordIdValue = recordId.toString();
        Patient patient = patientEntity(patientId);
        Doctor doctor = doctorEntity(doctorId);
        Appointment appointment = appointmentEntity(appointmentId, patient, doctor);
        MedicalRecord record = medicalRecordEntity(UUID.fromString(recordIdValue), patient, doctor, appointment);
        when(medicalRecordRepository.findById(recordIdValue)).thenReturn(Optional.of(record));
        when(patientRepository.findById(patientIdValue)).thenReturn(Optional.of(patient));
        when(doctorRepository.findById(doctorIdValue)).thenReturn(Optional.of(doctor));
        when(appointmentRepository.findById(appointmentIdValue)).thenReturn(Optional.of(appointment));
        when(medicalRecordRepository.save(any(MedicalRecord.class))).thenAnswer(invocation -> invocation.getArgument(0));

        var response = medicalRecordService.update(recordIdValue, medicalRecordUpdateRequest(patientId, doctorId, appointmentId));

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
    void amendWritesImmutableHistoryInsteadOfSilentUpdate() {
        UUID patientId = UUID.randomUUID();
        UUID doctorId = UUID.randomUUID();
        UUID recordId = UUID.randomUUID();
        Patient patient = patientEntity(patientId);
        Doctor doctor = doctorEntity(doctorId);
        MedicalRecord record = medicalRecordEntity(recordId, patient, doctor, null);

        when(medicalRecordRepository.findById(recordId.toString())).thenReturn(Optional.of(record));
        when(amendmentRepository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));
        when(medicalRecordRepository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));
        when(currentUser.userId()).thenReturn("doctor-1");
        when(currentUser.require())
                .thenReturn(new com.clinic.security.CustomUserPrincipal(doctor));

        var response = medicalRecordService.amend(recordId.toString(), medicalRecordAmendRequest());

        assertEquals("Updated Diagnosis", response.diagnosis());
        var amendmentCaptor = org.mockito.ArgumentCaptor.forClass(
                com.clinic.entity.MedicalRecordAmendment.class);
        verify(amendmentRepository).save(amendmentCaptor.capture());
        var amendment = amendmentCaptor.getValue();
        assertTrue(amendment.getFields().contains("diagnosis"));
        assertTrue(amendment.getPreviousValues().contains("diagnosis=Diagnosis"));
        assertEquals("Correcting the diagnosis after review", amendment.getReason());
    }

    @Test
    void signedRecordCannotBeUpdatedDirectly() {
        UUID recordId = UUID.randomUUID();
        MedicalRecord record = medicalRecordEntity(recordId, patientEntity(UUID.randomUUID()),
                doctorEntity(UUID.randomUUID()), null);
        record.sign("doctor-1");

        when(medicalRecordRepository.findById(recordId.toString())).thenReturn(Optional.of(record));

        assertThrows(com.clinic.exception.BadRequestException.class, () -> medicalRecordService.update(
                recordId.toString(),
                medicalRecordUpdateRequest(UUID.randomUUID(), UUID.randomUUID(), UUID.randomUUID())));
        verifyNoInteractions(amendmentRepository);
    }

    @Test
    void deleteRemovesMedicalRecord() {
        String id = UUID.randomUUID().toString();
        MedicalRecord record = medicalRecordEntity(UUID.fromString(id), patientEntity(UUID.randomUUID()), doctorEntity(UUID.randomUUID()), null);
        when(medicalRecordRepository.findById(id)).thenReturn(Optional.of(record));

        medicalRecordService.delete(id);

        verify(medicalRecordRepository).delete(record);
    }
}
