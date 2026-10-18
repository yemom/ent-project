package com.clinic.security;

import com.clinic.entity.Appointment;
import com.clinic.entity.AppointmentStatus;
import com.clinic.entity.Doctor;
import com.clinic.entity.MedicalRecord;
import com.clinic.entity.Patient;
import com.clinic.entity.PatientAssignment;
import com.clinic.entity.User;
import com.clinic.entity.UserRole;
import com.clinic.repository.AppointmentRepository;
import com.clinic.repository.MedicalRecordRepository;
import com.clinic.repository.PatientAssignmentRepository;
import com.clinic.repository.PatientRepository;
import com.clinic.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

import java.time.LocalDate;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Who may read which clinical records.
 *
 * <p>Written as a full-stack test against the real security filter chain because the
 * failure mode this guards against is exactly the one a unit test cannot see: a
 * method-security expression that reads correctly while the endpoint it guards
 * returns another patient's chart.
 *
 * <p>The scenario is the historical gap: {@code own_record:read} was granted to
 * PATIENT in the permission matrix, but no endpoint consumed it, so a patient's own
 * Records page answered 403. The obvious "fix" of granting PATIENT
 * {@code diagnosis:write} would have handed every patient the ability to create,
 * amend and sign any chart in the hospital, so this suite pins the narrow
 * alternative instead.
 */
@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:clinice_records_rbac;MODE=PostgreSQL;DB_CLOSE_DELAY=-1;DATABASE_TO_UPPER=false",
        "spring.datasource.driver-class-name=org.h2.Driver",
        "spring.datasource.username=sa",
        "spring.datasource.password=",
        "spring.jpa.hibernate.ddl-auto=create-drop",
        "spring.sql.init.mode=never",
        "spring.flyway.enabled=false",
        "app.rate-limit.enabled=false"
})
@AutoConfigureMockMvc
class MedicalRecordAuthorizationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private PatientRepository patientRepository;

    @Autowired
    private AppointmentRepository appointmentRepository;

    @Autowired
    private MedicalRecordRepository medicalRecordRepository;

    @Autowired
    private PatientAssignmentRepository assignmentRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    private String doctorId;
    private String otherDoctorId;
    private String nurseId;
    private String receptionistId;
    private String patientId;
    private String otherPatientId;

    /** The record belonging to {@link #patientId}. */
    private String ownRecordId;

    /** The record belonging to {@link #otherPatientId}. */
    private String foreignRecordId;

    @BeforeEach
    void seed() {
        SecurityContextHolder.clearContext();
        medicalRecordRepository.deleteAllInBatch();
        appointmentRepository.deleteAllInBatch();
        assignmentRepository.deleteAllInBatch();
        patientRepository.deleteAllInBatch();
        userRepository.deleteAllInBatch();

        doctorId = save(Doctor.builder().role(UserRole.DOCTOR).specialization("Cardiology")
                .licenseNumber("LIC-" + System.nanoTime()).available(true).build());
        otherDoctorId = save(Doctor.builder().role(UserRole.DOCTOR).specialization("Neurology")
                .licenseNumber("LIC-" + System.nanoTime()).available(true).build());
        nurseId = save(com.clinic.entity.AdminUser.builder().role(UserRole.NURSE).build());
        receptionistId = save(com.clinic.entity.AdminUser.builder().role(UserRole.RECEPTIONIST).build());
        patientId = savePatient("patient.one@example.com", "Patient One");
        otherPatientId = savePatient("patient.two@example.com", "Patient Two");

        ownRecordId = recordFor(patientId, doctorId, "Routine blood pressure review");
        foreignRecordId = recordFor(otherPatientId, otherDoctorId, "Confidential cardiology consult");

        // `patientId` is the clinician's assigned panel; `otherPatientId` is nobody's.
        assignmentRepository.save(PatientAssignment.builder()
                .patient(patientRepository.findById(patientId).orElseThrow())
                .doctor((Doctor) userRepository.findById(doctorId).orElseThrow())
                .assignedAt(java.time.LocalDateTime.now())
                .build());
    }

    // ------------------------------------------------------------------
    // The patient reads their own chart
    // ------------------------------------------------------------------

    @Test
    void patientCanListTheirOwnRecords() throws Exception {
        mockMvc.perform(get("/api/v1/medical-records/me").with(asUser(patientId)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(1));
    }

    @Test
    void theOwnListingNeverContainsAnotherPatientsRecord() throws Exception {
        String body = mockMvc.perform(get("/api/v1/medical-records/me").with(asUser(patientId)))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();

        assertTrue(body.contains(ownRecordId), "the patient should see their own record");
        assertFalse(body.contains(foreignRecordId), "and never somebody else's");
        assertFalse(body.contains(otherPatientId), "not even the other patient's id");
    }

    @Test
    void patientCanOpenTheirOwnRecordById() throws Exception {
        mockMvc.perform(get("/api/v1/medical-records/" + ownRecordId).with(asUser(patientId)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.diagnosis").value("Routine blood pressure review"));
    }

    @Test
    void patientCanReadTheAmendmentHistoryOfTheirOwnRecord() throws Exception {
        mockMvc.perform(get("/api/v1/medical-records/" + ownRecordId + "/amendments").with(asUser(patientId)))
                .andExpect(status().isOk());
    }

    // ------------------------------------------------------------------
    // The patient cannot reach anybody else's chart
    // ------------------------------------------------------------------

    @Test
    void patientCannotOpenAnotherPatientsRecordById() throws Exception {
        assertForbidden(patientId, get("/api/v1/medical-records/" + foreignRecordId));
    }

    @Test
    void patientCannotReadAnotherRecordsAmendmentHistory() throws Exception {
        // The amendment list must not become a way to confirm a record id exists.
        assertForbidden(patientId, get("/api/v1/medical-records/" + foreignRecordId + "/amendments"));
    }

    /**
     * The endpoint takes no patientId, so there is nothing to tamper with — and
     * passing one anyway must not change the result.
     */
    @Test
    void aPatientIdInTheQueryStringCannotWidenTheResult() throws Exception {
        String body = mockMvc.perform(get("/api/v1/medical-records/me")
                        .param("patientId", otherPatientId)
                        .with(asUser(patientId)))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();

        assertFalse(body.contains(foreignRecordId),
                "an ignored patientId parameter must not widen the listing");
    }

    @Test
    void filtersNarrowWithinTheCallersOwnRecordsAndCannotEscapeThem() throws Exception {
        mockMvc.perform(get("/api/v1/medical-records/me")
                        .param("fromDate", "1900-01-01")
                        .param("toDate", LocalDate.now().plusYears(1).toString())
                        .param("keyword", "confidential")
                        .with(asUser(patientId)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(0));
    }

    @Test
    void patientCannotUseTheClinicWideListingsToEnumerate() throws Exception {
        assertForbidden(patientId, get("/api/v1/medical-records"));
        assertForbidden(patientId, get("/api/v1/medical-records/search"));
        // Even naming their own id does not unlock the clinician search.
        assertForbidden(patientId, get("/api/v1/medical-records/search?patientId=" + patientId));
    }

    @Test
    void patientCannotWriteClinicalData() throws Exception {
        // Granting `own_record:read` must not have come with any write capability.
        assertForbidden(patientId, withBody(post("/api/v1/medical-records"), String.format(
                "{\"patientId\":\"%s\",\"recordDate\":\"%s\",\"diagnosis\":\"self-diagnosed\"}",
                patientId, LocalDate.now())));
        assertForbidden(patientId, post("/api/v1/medical-records/" + ownRecordId + "/sign"));
    }

    // ------------------------------------------------------------------
    // Clinicians keep what they had
    // ------------------------------------------------------------------

    @Test
    void aDoctorWithClinicalPermissionsKeepsClinicianAccess() throws Exception {
        mockMvc.perform(get("/api/v1/medical-records").with(asUser(doctorId)))
                .andExpect(status().isOk());
        mockMvc.perform(get("/api/v1/medical-records/search").with(asUser(doctorId)))
                .andExpect(status().isOk());
        mockMvc.perform(get("/api/v1/medical-records/" + ownRecordId).with(asUser(doctorId)))
                .andExpect(status().isOk());
    }

    @Test
    void aNurseKeepsReadByIdButNotTheClinicWideListings() throws Exception {
        // `vital:write` opens a record; it must not become clinic-wide enumeration.
        mockMvc.perform(get("/api/v1/medical-records/" + ownRecordId).with(asUser(nurseId)))
                .andExpect(status().isOk());
        assertForbidden(nurseId, get("/api/v1/medical-records/search"));
    }

    @Test
    void receptionStillHasNoClinicalAccess() throws Exception {
        assertForbidden(receptionistId, get("/api/v1/medical-records"));
        assertForbidden(receptionistId, get("/api/v1/medical-records/me"));
        assertForbidden(receptionistId, get("/api/v1/medical-records/" + ownRecordId));
    }

    // ------------------------------------------------------------------
    // Authentication
    // ------------------------------------------------------------------

    @Test
    void anonymousIsRejected() throws Exception {
        mockMvc.perform(get("/api/v1/medical-records/me"))
                .andExpect(status().isUnauthorized());
    }

    // ------------------------------------------------------------------
    // helpers
    // ------------------------------------------------------------------

    private String recordFor(String forPatientId, String forDoctorId, String diagnosis) {
        Appointment appointment = appointmentRepository.save(Appointment.builder()
                .patient(patientRepository.findById(forPatientId).orElseThrow())
                .doctor((Doctor) userRepository.findById(forDoctorId).orElseThrow())
                .appointmentDate(java.time.LocalDateTime.now().minusDays(3))
                .duration(30)
                .status(AppointmentStatus.COMPLETED)
                .reminderSent(false)
                .build());

        return medicalRecordRepository.save(MedicalRecord.builder()
                .patient(patientRepository.findById(forPatientId).orElseThrow())
                .doctor((Doctor) userRepository.findById(forDoctorId).orElseThrow())
                .appointment(appointment)
                .diagnosis(diagnosis)
                .treatment("Continue current management")
                .prescription("None")
                .testResults("Within range")
                .followUpRequired(false)
                .recordDate(LocalDate.now().minusDays(2))
                .medicalRecordType("CONSULTATION")
                .isConfidential(false)
                .build()).getId();
    }

    private String save(User user) {
        user.setEmail(user.getRole().name().toLowerCase() + "." + System.nanoTime() + "@example.com");
        user.setPassword(passwordEncoder.encode("Password123!"));
        user.setFullName("Test " + user.getRole());
        user.setActive(true);
        return userRepository.save(user).getId();
    }

    private String savePatient(String email, String name) {
        Patient patient = Patient.builder()
                .email(email)
                .password(passwordEncoder.encode("Password123!"))
                .fullName(name)
                .role(UserRole.PATIENT)
                .active(true)
                .registrationNumber("REG-" + System.nanoTime())
                .build();
        return patientRepository.save(patient).getId();
    }

    private org.springframework.test.web.servlet.request.RequestPostProcessor asUser(String userId) {
        User user = userRepository.findById(userId).orElseThrow();
        CustomUserPrincipal principal = new CustomUserPrincipal(user);
        return SecurityMockMvcRequestPostProcessors.authentication(
                new UsernamePasswordAuthenticationToken(principal, null, principal.getAuthorities()));
    }

    private MockHttpServletRequestBuilder withBody(MockHttpServletRequestBuilder builder, String json) {
        return builder.contentType(org.springframework.http.MediaType.APPLICATION_JSON).content(json);
    }

    private void assertForbidden(String userId, MockHttpServletRequestBuilder builder) throws Exception {
        mockMvc.perform(builder.with(asUser(userId))).andExpect(status().isForbidden());
    }
}