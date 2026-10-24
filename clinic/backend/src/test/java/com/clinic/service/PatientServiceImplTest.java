package com.clinic.service;

import com.clinic.entity.Doctor;
import com.clinic.entity.Patient;
import com.clinic.exception.BadRequestException;
import com.clinic.exception.ResourceNotFoundException;
import com.clinic.mapper.PatientMapper;
import com.clinic.repository.DoctorRepository;
import com.clinic.repository.PatientAssignmentRepository;
import com.clinic.repository.PatientRepository;
import com.clinic.repository.UserRepository;
import com.clinic.security.CurrentUser;
import com.clinic.service.impl.PatientServiceImpl;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static com.clinic.support.TestFixtures.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class PatientServiceImplTest {

    @Mock private PatientRepository patientRepository;
    @Mock private UserRepository userRepository;
    @Mock private DoctorRepository doctorRepository;
    @Mock private PatientAssignmentRepository assignmentRepository;
    @Mock private CurrentUser currentUser;
    @Mock private NotificationService notificationService;
    @Mock private AuditLogService auditLogService;
    private final PatientMapper patientMapper = new PatientMapper();
    @Mock private PasswordEncoder passwordEncoder;

    private PatientServiceImpl patientService;

    @org.junit.jupiter.api.BeforeEach
    void setUp() {
        patientService = new PatientServiceImpl(patientRepository, userRepository, doctorRepository,
                assignmentRepository, patientMapper, passwordEncoder, currentUser,
                notificationService, auditLogService);
    }

    @Test
    void createEncodesPasswordAndPersists() {
        when(userRepository.existsByEmail("patient@example.com")).thenReturn(false);
        when(passwordEncoder.encode("Password123!")).thenReturn("encoded-password");
        when(patientRepository.save(any(Patient.class))).thenAnswer(invocation -> invocation.getArgument(0));

        var response = patientService.create(patientCreateRequest());

        assertEquals("patient@example.com", response.email());
        verify(patientRepository).save(argThat(patient -> "encoded-password".equals(patient.getPassword()) && patient.getRole() != null));
    }

    @Test
    void createRejectsDuplicateEmail() {
        when(userRepository.existsByEmail("patient@example.com")).thenReturn(true);

        assertThrows(BadRequestException.class, () -> patientService.create(patientCreateRequest()));
        verifyNoInteractions(patientRepository);
    }

    @Test
    void assignToDoctorNotifiesThatDoctor() {
        UUID patientId = UUID.randomUUID();
        UUID doctorId = UUID.randomUUID();
        Patient patient = patientEntity(patientId);
        Doctor doctor = doctorEntity(doctorId);

        when(patientRepository.findById(patientId.toString())).thenReturn(Optional.of(patient));
        when(doctorRepository.findById(doctorId.toString())).thenReturn(Optional.of(doctor));
        when(assignmentRepository.findByPatientIdAndReleasedAtIsNull(patientId.toString()))
                .thenReturn(Optional.empty());
        // The persisted assignment is what keys the notification, so it needs an id.
        // Without one the discriminator is null and the test would pass on a weaker
        // matcher than the behaviour it is meant to pin.
        UUID assignmentId = UUID.randomUUID();
        when(assignmentRepository.save(any())).thenAnswer(invocation -> {
            com.clinic.entity.PatientAssignment saved = invocation.getArgument(0);
            saved.setId(assignmentId.toString());
            return saved;
        });
        when(currentUser.userId()).thenReturn("reception-1");
        when(currentUser.require()).thenReturn(new com.clinic.security.CustomUserPrincipal(patient));

        var response = patientService.assignToDoctor(patientId.toString(), assignPatientRequest(doctorId.toString()));

        assertEquals(doctorId.toString(), response.doctorId());
        assertTrue(response.active());
        // `…Once`, not the plain overload: the assignment row is the event key, so a
        // receptionist pressing Assign twice produces one notification rather than
        // stacking duplicates in the doctor's bell. The plain overload was the bug.
        verify(notificationService).createForUserOnce(eq(doctorId.toString()),
                eq(com.clinic.entity.NotificationType.PATIENT_ASSIGNED), anyString(), anyString(),
                eq(patientId.toString()), anyString(),
                eq("PATIENT_ASSIGNED"), eq(assignmentId.toString()));
    }

    @Test
    void assignRejectsInactiveDoctor() {
        UUID patientId = UUID.randomUUID();
        UUID doctorId = UUID.randomUUID();
        Patient patient = patientEntity(patientId);
        Doctor doctor = doctorEntity(doctorId);
        doctor.setActive(false);

        when(patientRepository.findById(patientId.toString())).thenReturn(Optional.of(patient));
        when(doctorRepository.findById(doctorId.toString())).thenReturn(Optional.of(doctor));

        assertThrows(BadRequestException.class,
                () -> patientService.assignToDoctor(patientId.toString(), assignPatientRequest(doctorId.toString())));
    }

    @Test
    void branchScopedCallerCannotReadAnotherBranchsPatient() {
        UUID patientId = UUID.randomUUID();
        Patient patient = patientEntity(patientId);
        patient.setBranchId("branch-a");

        when(patientRepository.findById(patientId.toString())).thenReturn(Optional.of(patient));
        when(currentUser.isBranchScoped()).thenReturn(true);
        when(currentUser.branchId()).thenReturn("branch-b");

        // Cross-branch access resolves as "not found" so the id is not confirmed.
        assertThrows(ResourceNotFoundException.class, () -> patientService.getById(patientId.toString()));
    }

    @Test
    void branchScopedCallerCanReadTheirOwnBranchsPatient() {
        UUID patientId = UUID.randomUUID();
        Patient patient = patientEntity(patientId);
        patient.setBranchId("branch-a");

        when(patientRepository.findById(patientId.toString())).thenReturn(Optional.of(patient));
        when(currentUser.isBranchScoped()).thenReturn(true);
        when(currentUser.branchId()).thenReturn("branch-a");

        assertEquals(patientId.toString(), patientService.getById(patientId.toString()).id());
    }

    @Test
    void superAdminWithoutABranchIsUnscoped() {
        UUID patientId = UUID.randomUUID();
        Patient patient = patientEntity(patientId);
        patient.setBranchId("branch-a");

        when(patientRepository.findById(patientId.toString())).thenReturn(Optional.of(patient));
        when(currentUser.isBranchScoped()).thenReturn(false);

        assertEquals(patientId.toString(), patientService.getById(patientId.toString()).id());
    }

}
