package com.clinic.service;

import com.clinic.entity.Patient;
import com.clinic.exception.BadRequestException;
import com.clinic.mapper.PatientMapper;
import com.clinic.repository.PatientRepository;
import com.clinic.repository.UserRepository;
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
    private final PatientMapper patientMapper = new PatientMapper();
    @Mock private PasswordEncoder passwordEncoder;

    private PatientServiceImpl patientService;

    @org.junit.jupiter.api.BeforeEach
    void setUp() {
        patientService = new PatientServiceImpl(patientRepository, userRepository, patientMapper, passwordEncoder);
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

}
