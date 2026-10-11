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
        return new AppointmentCreateRequest(patientId.toString(), doctorId.toString(), LocalDateTime.now().plusDays(1), 30, "SCHEDULED", "Checkup", "Bring reports");
    }

    public static AppointmentUpdateRequest appointmentUpdateRequest(UUID patientId, UUID doctorId) {
        return new AppointmentUpdateRequest(patientId.toString(), doctorId.toString(), LocalDateTime.now().plusDays(2), 45, AppointmentStatus.CONFIRMED, "Follow-up", "Updated notes", true, LocalDateTime.now(), null, null, null);
    }

    public static AppointmentSearchRequest appointmentSearchRequest(UUID patientId, UUID doctorId) {
        return new AppointmentSearchRequest(patientId.toString(), doctorId.toString(), AppointmentStatus.SCHEDULED, LocalDateTime.now().minusDays(1), LocalDateTime.now().plusDays(1), "check");
    }

    public static MedicalRecordCreateRequest medicalRecordCreateRequest(UUID patientId, UUID doctorId, UUID appointmentId) {
        return new MedicalRecordCreateRequest(patientId.toString(), doctorId.toString(), appointmentId.toString(), "Diagnosis", "Treatment", "Prescription", "Tests", "BP 120/80", true, LocalDate.now().plusDays(7), "Notes", LocalDate.now(), "CONSULTATION", true);
    }

    public static MedicalRecordUpdateRequest medicalRecordUpdateRequest(UUID patientId, UUID doctorId, UUID appointmentId) {
        return new MedicalRecordUpdateRequest(patientId.toString(), doctorId.toString(), appointmentId.toString(), "Updated Diagnosis", "Updated Treatment", "Updated Prescription", "Updated Tests", "BP 110/70", false, null, "Updated Notes", LocalDate.now(), "FOLLOW_UP", false);
    }

    public static MedicalRecordAmendRequest medicalRecordAmendRequest() {
        return new MedicalRecordAmendRequest(
                "Correcting the diagnosis after review",
                "Updated Diagnosis",
                "Updated Treatment",
                null,
                null,
                null,
                "Updated Notes",
                false,
                null,
                "FOLLOW_UP",
                false);
    }

    public static BreakGlassAccessRequest breakGlassAccessRequest() {
        return new BreakGlassAccessRequest("Emergency trauma case, patient unconscious on arrival");
    }

    public static RegisterPatientRequest registerPatientRequest() {
        return new RegisterPatientRequest(
                "Jane New", "jane.new@example.com", null, "+15550010",
                "1992-04-05", "FEMALE", "A+", "John Doe", "+15550011",
                "branch-1", null);
    }

    public static AssignPatientRequest assignPatientRequest(String doctorId) {
        return new AssignPatientRequest(doctorId, null, "Cardiology", "Walk-in referral");
    }

    /** Same, but with a nurse named alongside the doctor. */
    public static AssignPatientRequest assignPatientRequest(String doctorId, String nurseId) {
        return new AssignPatientRequest(doctorId, nurseId, "Cardiology", "Walk-in referral");
    }

    public static CheckInPatientRequest checkInPatientRequest() {
        return new CheckInPatientRequest(true, null, "Arrived at reception");
    }

    public static PatientDemographicsResponse patientDemographicsResponse(UUID id) {
        return new PatientDemographicsResponse(
                id.toString(), "REG-1234", "John Patient", "patient@example.com", "+15550001",
                LocalDate.of(1990, 1, 1), "MALE", "O+", "Jane Patient", "+15550002",
                "branch-1", true, LocalDateTime.now().toString(), "doctor-1", "Dr Smith");
    }

    public static PatientAssignmentResponse patientAssignmentResponse(UUID patientId, UUID doctorId) {
        return new PatientAssignmentResponse(
                UUID.randomUUID().toString(), patientId.toString(), "John Patient",
                doctorId.toString(), "Dr Smith", null, "Cardiology", 1,
                "reception-1", "Front Desk", "Walk-in referral", true,
                Instant.now(), null);
    }

    public static NotificationResponse notificationResponse(String id, NotificationType type) {
        return new NotificationResponse(id, type.name(), "Lab result ready",
                "A result is ready for review", "ref-1", "/doctor/laboratory",
                null, false, Instant.now());
    }

    public static AuditLog auditLogEntity(UUID id, AuditAction action) {
        return AuditLog.builder()
                .id(id.toString())
                .actorId("actor-1")
                .actorEmail("actor@example.com")
                .actorRole(UserRole.DOCTOR)
                .action(action)
                .targetType("MEDICAL_RECORD")
                .targetId("record-1")
                .reason("Reviewed")
                .createdAt(LocalDateTime.now())
                .build();
    }

    public static MedicalRecordSearchRequest medicalRecordSearchRequest(UUID patientId, UUID doctorId, UUID appointmentId) {
        return new MedicalRecordSearchRequest(patientId.toString(), doctorId.toString(), appointmentId.toString(), LocalDate.now().minusDays(1), LocalDate.now().plusDays(1), true, "diag");
    }

    public static UserSummaryResponse userSummary(UUID id, String name, String email, UserRole role) {
        return new UserSummaryResponse(id.toString(), name, email, role, true);
    }

    public static AuthResponse authResponse(String token) {
        return AuthResponse.of(token, Instant.now().plusSeconds(3600), userSummary(UUID.randomUUID(), "John Patient", "patient@example.com", UserRole.PATIENT));
    }

    public static PatientResponse patientResponse(UUID id) {
        return new PatientResponse(id.toString(), "patient@example.com", "John Patient", "+15550001", UserRole.PATIENT, LocalDate.of(1990, 1, 1), Gender.MALE, "Asthma", "O+", "Peanuts", "Jane Patient", "+15550002", true, LocalDateTime.now(), LocalDateTime.now());
    }

    public static DoctorResponse doctorResponse(UUID id) {
        return new DoctorResponse(id.toString(), "doctor@example.com", "Dr Smith", "+15550005", UserRole.DOCTOR, "Cardiology", "LIC-123", 12, "MBBS, MD", BigDecimal.valueOf(100.0), "Experienced cardiologist", true, true, LocalDateTime.now(), LocalDateTime.now());
    }

    public static AppointmentResponse appointmentResponse(UUID id, UUID patientId, UUID doctorId) {
        return new AppointmentResponse(id.toString(), userSummary(patientId, "John Patient", "patient@example.com", UserRole.PATIENT), userSummary(doctorId, "Dr Smith", "doctor@example.com", UserRole.DOCTOR), LocalDateTime.now().plusDays(1), 30, AppointmentStatus.SCHEDULED, "Checkup", "Bring reports", false, null, null, null, null, LocalDateTime.now(), LocalDateTime.now());
    }

    public static MedicalRecordResponse medicalRecordResponse(UUID id, UUID patientId, UUID doctorId, UUID appointmentId) {
        return new MedicalRecordResponse(id.toString(), userSummary(patientId, "John Patient", "patient@example.com", UserRole.PATIENT), userSummary(doctorId, "Dr Smith", "doctor@example.com", UserRole.DOCTOR), new AppointmentSummaryResponse(appointmentId.toString(), LocalDateTime.now().plusDays(1), 30, AppointmentStatus.SCHEDULED, "Checkup"), "Diagnosis", "Treatment", "Prescription", "Tests", "BP 120/80", true, LocalDate.now().plusDays(7), "Notes", LocalDate.now(), "CONSULTATION", true, LocalDateTime.now(), LocalDateTime.now());
    }

    public static Patient patientEntity(UUID id) {
        return Patient.builder()
                .id(id.toString())
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
                .id(id.toString())
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
