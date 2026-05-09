package com.clinic.support;

import com.clinic.dto.request.*;
import com.clinic.dto.response.*;
import com.clinic.entity.*;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.UUID;

public final class TestFixtures {

    private TestFixtures() {
    }

    public static RegisterRequest registerRequest() {
        return new RegisterRequest("patient@example.com", "Password123!", "John Patient", "+15550001", UserRole.PATIENT);
    }

    public static LoginRequest loginRequest() {
        return new LoginRequest("patient@example.com", "Password123!");
    }

    public static PatientCreateRequest patientCreateRequest() {
        return new PatientCreateRequest(
                "patient@example.com",
                "Password123!",
                "John Patient",
                "+15550001",
                LocalDate.of(1990, 1, 1),
                Gender.MALE,
                "Asthma",
                "O+",
                "Peanuts",
                "Jane Patient",
                "+15550002"
        );
    }

    public static PatientUpdateRequest patientUpdateRequest() {
        return new PatientUpdateRequest("John Updated", "+15550003", LocalDate.of(1990, 1, 1), Gender.MALE, "No history", "A+", "None", "Jane Updated", "+15550004", true);
    }

    public static DoctorCreateRequest doctorCreateRequest() {
        return new DoctorCreateRequest(
                "doctor@example.com",
                "Password123!",
                "Dr Smith",
                "+15550005",
                "Cardiology",
                "LIC-123",
                12,
                "MBBS, MD",
                BigDecimal.valueOf(100.0),
                "Experienced cardiologist"
        );
    }

    public static DoctorUpdateRequest doctorUpdateRequest() {
        return new DoctorUpdateRequest("Dr Smith Updated", "+15550006", "Neurology", "LIC-456", 15, "MBBS, MD, DM", BigDecimal.valueOf(150.0), "Updated bio", true, false);
    }

    public static AppointmentCreateRequest appointmentCreateRequest(UUID patientId, UUID doctorId) {
        return new AppointmentCreateRequest(patientId, doctorId, LocalDateTime.now().plusDays(1), 30, "SCHEDULED", "Checkup", "Bring reports");
    }

    public static AppointmentUpdateRequest appointmentUpdateRequest(UUID patientId, UUID doctorId) {
        return new AppointmentUpdateRequest(patientId, doctorId, LocalDateTime.now().plusDays(2), 45, AppointmentStatus.CONFIRMED, "Follow-up", "Updated notes", true, LocalDateTime.now(), null, null, null);
    }

    public static AppointmentSearchRequest appointmentSearchRequest(UUID patientId, UUID doctorId) {
        return new AppointmentSearchRequest(patientId, doctorId, AppointmentStatus.SCHEDULED, LocalDateTime.now().minusDays(1), LocalDateTime.now().plusDays(1), "check");
    }

    public static MedicalRecordCreateRequest medicalRecordCreateRequest(UUID patientId, UUID doctorId, UUID appointmentId) {
        return new MedicalRecordCreateRequest(patientId, doctorId, appointmentId, "Diagnosis", "Treatment", "Prescription", "Tests", "BP 120/80", true, LocalDate.now().plusDays(7), "Notes", LocalDate.now(), "CONSULTATION", true);
    }

    public static MedicalRecordUpdateRequest medicalRecordUpdateRequest(UUID patientId, UUID doctorId, UUID appointmentId) {
        return new MedicalRecordUpdateRequest(patientId, doctorId, appointmentId, "Updated Diagnosis", "Updated Treatment", "Updated Prescription", "Updated Tests", "BP 110/70", false, null, "Updated Notes", LocalDate.now(), "FOLLOW_UP", false);
    }

    public static MedicalRecordSearchRequest medicalRecordSearchRequest(UUID patientId, UUID doctorId, UUID appointmentId) {
        return new MedicalRecordSearchRequest(patientId, doctorId, appointmentId, LocalDate.now().minusDays(1), LocalDate.now().plusDays(1), true, "diag");
    }

    public static UserSummaryResponse userSummary(UUID id, String name, String email, UserRole role) {
        return new UserSummaryResponse(id, name, email, role);
    }

    public static AuthResponse authResponse(String token) {
        return AuthResponse.of(token, Instant.now().plusSeconds(3600), userSummary(UUID.randomUUID(), "John Patient", "patient@example.com", UserRole.PATIENT));
    }

    public static PatientResponse patientResponse(UUID id) {
        return new PatientResponse(id, "patient@example.com", "John Patient", "+15550001", UserRole.PATIENT, LocalDate.of(1990, 1, 1), Gender.MALE, "Asthma", "O+", "Peanuts", "Jane Patient", "+15550002", true, LocalDateTime.now(), LocalDateTime.now());
    }

    public static DoctorResponse doctorResponse(UUID id) {
        return new DoctorResponse(id, "doctor@example.com", "Dr Smith", "+15550005", UserRole.DOCTOR, "Cardiology", "LIC-123", 12, "MBBS, MD", BigDecimal.valueOf(100.0), "Experienced cardiologist", true, true, LocalDateTime.now(), LocalDateTime.now());
    }

    public static AppointmentResponse appointmentResponse(UUID id, UUID patientId, UUID doctorId) {
        return new AppointmentResponse(id, userSummary(patientId, "John Patient", "patient@example.com", UserRole.PATIENT), userSummary(doctorId, "Dr Smith", "doctor@example.com", UserRole.DOCTOR), LocalDateTime.now().plusDays(1), 30, AppointmentStatus.SCHEDULED, "Checkup", "Bring reports", false, null, null, null, null, LocalDateTime.now(), LocalDateTime.now());
    }

    public static MedicalRecordResponse medicalRecordResponse(UUID id, UUID patientId, UUID doctorId, UUID appointmentId) {
        return new MedicalRecordResponse(id, userSummary(patientId, "John Patient", "patient@example.com", UserRole.PATIENT), userSummary(doctorId, "Dr Smith", "doctor@example.com", UserRole.DOCTOR), new AppointmentSummaryResponse(appointmentId, LocalDateTime.now().plusDays(1), 30, AppointmentStatus.SCHEDULED, "Checkup"), "Diagnosis", "Treatment", "Prescription", "Tests", "BP 120/80", true, LocalDate.now().plusDays(7), "Notes", LocalDate.now(), "CONSULTATION", true, LocalDateTime.now(), LocalDateTime.now());
    }

    public static Patient patientEntity(UUID id) {
        return Patient.builder()
                .id(id)
                .email("patient@example.com")
                .password("encoded")
                .fullName("John Patient")
                .phone("+15550001")
                .role(UserRole.PATIENT)
                .dateOfBirth(LocalDate.of(1990, 1, 1))
                .gender(Gender.MALE)
                .medicalHistory("Asthma")
                .bloodType("O+")
                .allergies("Peanuts")
                .emergencyContactName("Jane Patient")
                .emergencyContactPhone("+15550002")
                .active(true)
                .build();
    }

    public static Doctor doctorEntity(UUID id) {
        return Doctor.builder()
                .id(id)
                .email("doctor@example.com")
                .password("encoded")
                .fullName("Dr Smith")
                .phone("+15550005")
                .role(UserRole.DOCTOR)
                .specialization("Cardiology")
                .licenseNumber("LIC-123")
                .yearsOfExperience(12)
                .qualifications("MBBS, MD")
                .consultationFee(BigDecimal.valueOf(100.0))
                .bio("Experienced cardiologist")
                .active(true)
                .available(true)
                .build();
    }

    public static Appointment appointmentEntity(UUID id, Patient patient, Doctor doctor) {
        return Appointment.builder()
                .patient(patient)
                .doctor(doctor)
                .appointmentDate(LocalDateTime.now().plusDays(1))
                .duration(30)
                .status(AppointmentStatus.SCHEDULED)
                .reasonForVisit("Checkup")
                .notes("Bring reports")
                .reminderSent(false)
                .build();
    }

    public static MedicalRecord medicalRecordEntity(UUID id, Patient patient, Doctor doctor, Appointment appointment) {
        return MedicalRecord.builder()
                .patient(patient)
                .doctor(doctor)
                .appointment(appointment)
                .diagnosis("Diagnosis")
                .treatment("Treatment")
                .prescription("Prescription")
                .testResults("Tests")
                .vitalSigns("BP 120/80")
                .followUpRequired(true)
                .followUpDate(LocalDate.now().plusDays(7))
                .notes("Notes")
                .recordDate(LocalDate.now())
                .medicalRecordType("CONSULTATION")
                .isConfidential(true)
                .build();
    }
}
