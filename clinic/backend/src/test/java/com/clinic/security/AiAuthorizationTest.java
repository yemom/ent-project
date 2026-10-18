package com.clinic.security;

import com.clinic.entity.AiConversation;
import com.clinic.entity.AiMessage;
import com.clinic.entity.AiPendingAction;
import com.clinic.entity.AdminUser;
import com.clinic.entity.Appointment;
import com.clinic.entity.AppointmentStatus;
import com.clinic.entity.Doctor;
import com.clinic.entity.Patient;
import com.clinic.entity.User;
import com.clinic.entity.UserRole;
import com.clinic.repository.AiConversationRepository;
import com.clinic.repository.AiMessageRepository;
import com.clinic.repository.AiPendingActionRepository;
import com.clinic.repository.AppointmentRepository;
import com.clinic.repository.PatientRepository;
import com.clinic.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Authorization and isolation for the AI assistant.
 *
 * <p>The properties under test are the ones that would be a real incident if they
 * broke:
 *
 * <ul>
 *   <li>a capability is reachable only by a role holding the underlying permission;</li>
 *   <li>one user cannot read another's conversation, even by guessing the id;</li>
 *   <li>one user cannot confirm another user's proposed appointment change;</li>
 *   <li>a patient cannot reach clinical or financial capabilities at all;</li>
 *   <li>with no provider configured, everything reports unavailable rather than
 *       pretending to answer.</li>
 * </ul>
 */
@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:clinicauth;MODE=PostgreSQL;DB_CLOSE_DELAY=-1;DATABASE_TO_UPPER=false",
        "spring.datasource.driver-class-name=org.h2.Driver",
        "spring.datasource.username=sa",
        "spring.datasource.password=",
        "spring.jpa.hibernate.ddl-auto=create-drop",
        "spring.sql.init.mode=never",
        "spring.flyway.enabled=false",
        "app.rate-limit.enabled=false",
        // AI is deliberately OFF for this suite: these tests are about who may ask
        // what, not about generation. Enabling it would need a provider.
        "ai.enabled=false"
})
@AutoConfigureMockMvc
class AiAuthorizationTest {

    @TestConfiguration
    static class StubMail {
        @Bean
        @org.springframework.context.annotation.Primary
        com.clinic.mail.EmailSender emailSender() {
            return new com.clinic.mail.EmailSender() {
                @Override
                public boolean isConfigured() {
                    return true;
                }

                @Override
                public void send(com.clinic.mail.EmailMessage message) {
                }
            };
        }
    }

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private PatientRepository patientRepository;

    @Autowired
    private AppointmentRepository appointmentRepository;

    @Autowired
    private AiConversationRepository conversationRepository;

    @Autowired
    private AiMessageRepository messageRepository;

    @Autowired
    private AiPendingActionRepository actionRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    private String patientId;
    private String doctorId;
    private String cashierId;
    private String otherPatientId;

    @BeforeEach
    void seed() {
        SecurityContextHolder.clearContext();
        actionRepository.deleteAllInBatch();
        messageRepository.deleteAllInBatch();
        conversationRepository.deleteAllInBatch();
        appointmentRepository.deleteAllInBatch();
        patientRepository.deleteAllInBatch();
        userRepository.deleteAllInBatch();

        doctorId = save(Doctor.builder().role(UserRole.DOCTOR).specialization("General")
                .licenseNumber("LIC-" + shortId()).available(true).build());
        cashierId = save(AdminUser.builder().role(UserRole.CASHIER).build());
        patientId = savePatient("ai.patient.one@example.com");
        otherPatientId = savePatient("ai.patient.two@example.com");
    }

    // ------------------------------------------------------------------
    // Capability visibility
    // ------------------------------------------------------------------

    @Test
    void aPatientSeesOnlyTheirOwnCapabilities() throws Exception {
        String body = mockMvc.perform(get("/api/v1/ai/capabilities").with(asUser(patientId)))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();

        assertThat(body).contains("patient_own_record");
        // A patient must never be offered financial, pharmacy or clinical reporting.
        assertThat(body)
                .doesNotContain("financial_summary")
                .doesNotContain("pharmacy_inventory")
                .doesNotContain("clinical_documentation")
                .doesNotContain("laboratory_workload");
    }

    @Test
    void aCashierSeesFinancialCapabilitiesButNotClinicalOnes() throws Exception {
        String body = mockMvc.perform(get("/api/v1/ai/capabilities").with(asUser(cashierId)))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();

        assertThat(body).contains("financial_summary");
        assertThat(body)
                .doesNotContain("clinical_documentation")
                .doesNotContain("patient_own_record");
    }

    @Test
    void aDoctorSeesTheirOwnBookButNotTheClinicWideAggregate() throws Exception {
        String body = mockMvc.perform(get("/api/v1/ai/capabilities").with(asUser(doctorId)))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();

        // `AppointmentController` grants doctors read access to the appointment book
        // by role, so the assistant must offer the same question — scoped to their own
        // panel rather than hospital-wide.
        assertThat(body).contains("my_appointments");
        // The clinic-wide aggregate stays on `appointment:manage`, which a doctor does
        // not hold. Offering it here would hand them a count they cannot get from
        // `GET /appointments`.
        assertThat(body).doesNotContain("appointment_metrics");
        assertThat(body)
                .doesNotContain("financial_summary")
                .doesNotContain("pharmacy_inventory")
                .doesNotContain("patient_own_record");
    }

    // ------------------------------------------------------------------
    // Denied capabilities
    // ------------------------------------------------------------------

    @Test
    void aPatientCannotReachTheFinancialCapabilityEvenByNamingIt() throws Exception {
        assertForbidden(patientId, chat("financial_summary", "How much did we collect last month?"));
    }

    @Test
    void aCashierCannotReachTheClinicalDocumentationCapability() throws Exception {
        assertForbidden(cashierId, chat("clinical_documentation", "Draft a visit summary"));
    }

    @Test
    void aDoctorCannotReachThePharmacyInventoryCapability() throws Exception {
        assertForbidden(doctorId, chat("pharmacy_inventory", "What is running low?"));
    }

    @Test
    void aPatientCannotReachTheAppointmentWorkloadCapability() throws Exception {
        assertForbidden(patientId, chat("staff_workload", "Which doctor is busiest?"));
    }

    @Test
    void anUnknownCapabilityIsRejectedNotSilentlyIgnored() throws Exception {
        mockMvc.perform(post("/api/v1/ai/chat").with(asUser(patientId))
                        .contentType(org.springframework.http.MediaType.APPLICATION_JSON)
                        .content("{\"capabilityId\":\"totally_made_up\",\"message\":\"hello\"}"))
                .andExpect(status().isBadRequest());
    }

    // ------------------------------------------------------------------
    // Provider disabled
    // ------------------------------------------------------------------

    @Test
    void withNoProviderEveryChatIsServiceUnavailable() throws Exception {
        mockMvc.perform(post("/api/v1/ai/chat").with(asUser(patientId))
                        .contentType(org.springframework.http.MediaType.APPLICATION_JSON)
                        .content("{\"capabilityId\":\"patient_own_record\",\"message\":\"What is in my record?\"}"))
                .andExpect(status().isServiceUnavailable());
    }

    /**
     * The access-control decision must not depend on whether AI is switched on.
     *
     * <p>This suite runs with {@code ai.enabled=false}. A caller who is not allowed
     * to ask a question still gets 403 rather than 503 — otherwise switching the
     * feature off would silently convert every authorization failure into a
     * configuration message, and switching it on would re-expose them.
     */
    @Test
    void denialIsStillADenialWhileTheFeatureIsOff() throws Exception {
        assertForbidden(patientId, chat("financial_summary", "How much did we collect?"));
        assertForbidden(doctorId, chat("pharmacy_inventory", "What is running low?"));
        assertForbidden(cashierId, chat("clinical_documentation", "Draft a summary"));
    }

    /** A request the caller may make still reports availability, not a denial. */
    @Test
    void anAllowedQuestionReachesTheAvailabilityCheck() throws Exception {
        mockMvc.perform(post("/api/v1/ai/chat").with(asUser(doctorId))
                        .contentType(org.springframework.http.MediaType.APPLICATION_JSON)
                        .content("{\"capabilityId\":\"my_appointments\",\"message\":\"What is on my list today?\"}"))
                .andExpect(status().isServiceUnavailable());
    }

    @Test
    void capabilitiesReportUnavailableRatherThanFailing() throws Exception {
        mockMvc.perform(get("/api/v1/ai/capabilities").with(asUser(patientId)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.available").value(false))
                .andExpect(jsonPath("$.unavailableReason").isNotEmpty());
    }

    @Test
    void aProposedAppointmentChangeIsAlsoUnavailableWithoutAProvider() throws Exception {
        mockMvc.perform(post("/api/v1/ai/actions/propose").with(asUser(doctorId))
                        .contentType(org.springframework.http.MediaType.APPLICATION_JSON)
                        .content(proposeBody()))
                .andExpect(status().isServiceUnavailable());
    }

    // ------------------------------------------------------------------
    // Conversation isolation
    // ------------------------------------------------------------------

    @Test
    void aConversationIsInvisibleToAnotherUser() throws Exception {
        String conversationId = conversationRepository.save(AiConversation.builder()
                .id(UUID.randomUUID().toString())
                .ownerUserId(patientId)
                .ownerRole(UserRole.PATIENT.name())
                .title("Private")
                .createdAt(LocalDateTime.now())
                .updatedAt(LocalDateTime.now())
                .deleted(false)
                .build()).getId();

        // 404, not 403: answering "forbidden" would confirm the id exists.
        mockMvc.perform(get("/api/v1/ai/conversations/" + conversationId).with(asUser(otherPatientId)))
                .andExpect(status().isNotFound());
        mockMvc.perform(get("/api/v1/ai/conversations/" + conversationId).with(asUser(patientId)))
                .andExpect(status().isOk());
    }

    @Test
    void aConversationListOnlyEverContainsYourOwn() throws Exception {
        conversationRepository.save(AiConversation.builder()
                .id(UUID.randomUUID().toString())
                .ownerUserId(patientId)
                .ownerRole(UserRole.PATIENT.name())
                .title("Mine")
                .createdAt(LocalDateTime.now())
                .updatedAt(LocalDateTime.now())
                .deleted(false)
                .build());

        String body = mockMvc.perform(get("/api/v1/ai/conversations").with(asUser(otherPatientId)))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();

        assertThat(body).isEqualTo("[]");
    }

    // ------------------------------------------------------------------
    // Proposed action isolation
    // ------------------------------------------------------------------

    @Test
    void anotherUserCannotConfirmOrRejectAProposal() throws Exception {
        String actionId = actionRepository.save(AiPendingAction.builder()
                .id(UUID.randomUUID().toString())
                .ownerUserId(doctorId)
                .conversationId("")
                .actionType(AiPendingAction.TYPE_BOOK_APPOINTMENT)
                .status(AiPendingAction.STATUS_PROPOSED)
                .description("Book something")
                .payload("{\"patientId\":\"p\",\"doctorId\":\"d\"}")
                .createdAt(LocalDateTime.now())
                .expiresAt(LocalDateTime.now().plusMinutes(10))
                .build()).getId();

        mockMvc.perform(post("/api/v1/ai/actions/" + actionId + "/confirm").with(asUser(patientId)))
                .andExpect(status().isNotFound());
        mockMvc.perform(delete("/api/v1/ai/actions/" + actionId).with(asUser(patientId)))
                .andExpect(status().isNotFound());
        mockMvc.perform(post("/api/v1/ai/actions/" + actionId + "/confirm").with(asUser(cashierId)))
                .andExpect(status().isNotFound());
    }

    // ------------------------------------------------------------------
    // Authentication
    // ------------------------------------------------------------------

    @Test
    void anonymousIsRejectedEverywhere() throws Exception {
        mockMvc.perform(get("/api/v1/ai/capabilities")).andExpect(status().isUnauthorized());
        mockMvc.perform(get("/api/v1/ai/conversations")).andExpect(status().isUnauthorized());
        mockMvc.perform(post("/api/v1/ai/chat").contentType(org.springframework.http.MediaType.APPLICATION_JSON)
                .content("{\"capabilityId\":\"appointment_metrics\",\"message\":\"hi\"}"))
                .andExpect(status().isUnauthorized());
        mockMvc.perform(get("/api/v1/ai/actions/pending")).andExpect(status().isUnauthorized());
    }

    @Test
    void aPatientCannotSeeAPatientsPendingActionsForAnotherPatient() throws Exception {
        actionRepository.save(AiPendingAction.builder()
                .id(UUID.randomUUID().toString())
                .ownerUserId(patientId)
                .conversationId("")
                .actionType(AiPendingAction.TYPE_CANCEL)
                .status(AiPendingAction.STATUS_PROPOSED)
                .description("Cancel")
                .payload("{}")
                .createdAt(LocalDateTime.now())
                .expiresAt(LocalDateTime.now().plusMinutes(10))
                .build());

        String body = mockMvc.perform(get("/api/v1/ai/actions/pending").with(asUser(otherPatientId)))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();

        assertThat(body).isEqualTo("[]");
    }

    // ------------------------------------------------------------------
    // helpers
    // ------------------------------------------------------------------

    private MockHttpServletRequestBuilder chat(String capabilityId, String message) throws Exception {
        return post("/api/v1/ai/chat")
                .contentType(org.springframework.http.MediaType.APPLICATION_JSON)
                .content("{\"capabilityId\":\"" + capabilityId + "\",\"message\":\"" + message + "\"}");
    }

    private String proposeBody() {
        return ("{\"type\":\"BOOK\",\"patientId\":\"" + patientId + "\",\"doctorId\":\"" + doctorId
                + "\",\"appointmentDate\":\"2030-01-02T09:00\",\"durationMinutes\":30}");
    }

    private void assertForbidden(String userId, MockHttpServletRequestBuilder builder) throws Exception {
        mockMvc.perform(builder.with(asUser(userId))).andExpect(status().isForbidden());
    }

    private org.springframework.test.web.servlet.request.RequestPostProcessor asUser(String userId) {
        User user = userRepository.findById(userId).orElseThrow();
        CustomUserPrincipal principal = new CustomUserPrincipal(user);
        return SecurityMockMvcRequestPostProcessors.authentication(
                new UsernamePasswordAuthenticationToken(principal, null, principal.getAuthorities()));
    }

    private String save(User user) {
        user.setEmail(user.getRole().name().toLowerCase() + "." + shortId() + "@example.com");
        user.setPassword(passwordEncoder.encode("Password123!"));
        user.setFullName("Test " + user.getRole());
        user.setActive(true);
        return userRepository.save(user).getId();
    }

    private String savePatient(String email) {
        Patient patient = Patient.builder()
                .email(email)
                .password(passwordEncoder.encode("Password123!"))
                .fullName("Patient")
                .role(UserRole.PATIENT)
                .active(true)
                .registrationNumber("REG-" + shortId())
                .build();
        return patientRepository.save(patient).getId();
    }


    private static String shortId() {
        return UUID.randomUUID().toString().substring(0, 8);
    }
}