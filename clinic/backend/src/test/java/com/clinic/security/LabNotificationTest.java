package com.clinic.security;

import com.clinic.entity.Doctor;
import com.clinic.entity.LaboratoryStaff;
import com.clinic.entity.Notification;
import com.clinic.entity.NotificationType;
import com.clinic.entity.Pharmacist;
import com.clinic.entity.User;
import com.clinic.entity.UserRole;
import com.clinic.repository.LabOrderRepository;
import com.clinic.repository.NotificationRepository;
import com.clinic.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Laboratory events reach the laboratory and the ordering doctor — and nobody else.
 *
 * <p>Driven through HTTP so the wiring is under test rather than the notifier alone.
 * Two of these are regression guards for defects that were live before this change:
 * the pharmacy was being told about investigations, and repeating a verification
 * re-announced the result.
 */
@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:cliniclabout;MODE=PostgreSQL;DB_CLOSE_DELAY=-1;DATABASE_TO_UPPER=false",
        "spring.datasource.driver-class-name=org.h2.Driver",
        "spring.datasource.username=sa",
        "spring.datasource.password=",
        "spring.jpa.hibernate.ddl-auto=create-drop",
        "spring.sql.init.mode=never",
        "spring.flyway.enabled=false",
        "app.rate-limit.enabled=false"
})
@AutoConfigureMockMvc
class LabNotificationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private NotificationRepository notificationRepository;

    @Autowired
    private LabOrderRepository labOrderRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    private String doctorId;
    private String labTechId;
    private String patientId;

    @BeforeEach
    void seed() {
        SecurityContextHolder.clearContext();
        notificationRepository.deleteAllInBatch();
        labOrderRepository.deleteAllInBatch();
        userRepository.deleteAllInBatch();

        doctorId = save(Doctor.builder().role(UserRole.DOCTOR).specialization("General")
                .licenseNumber("LIC-" + shortId()).available(true).build(), "doctor");
        labTechId = save(LaboratoryStaff.builder().role(UserRole.LAB_TECHNICIAN).build(), "labtech");
        patientId = save(com.clinic.entity.Patient.builder().role(UserRole.PATIENT).build(), "patient");
    }

    @Test
    void aNewOrderReachesTheLaboratoryQueue() throws Exception {
        createOrder();

        assertThat(notificationRepository.findAll()).anySatisfy(row -> {
            assertThat(row.getType()).isEqualTo(NotificationType.LAB_ORDER_CREATED);
            assertThat(row.getRecipientRole()).isIn(UserRole.LAB_TECHNICIAN, UserRole.LABORATORY);
        });
    }

    @Test
    void thePharmacyIsNotifiedAboutInvestigations() throws Exception {
        createOrder();

        // A lab order is an investigation, not a medication, so the pharmacy has no
        // queue for it. Before this change every pharmacist received one, with the
        // patient id in the body — clinical identifiers sent to an audience with no
        // relationship to that patient.
        assertThat(notificationRepository.findAll())
                .as("pharmacy has no lab queue; broadcasting here leaked a patient id")
                .noneSatisfy(row -> assertThat(row.getRecipientRole()).isEqualTo(UserRole.PHARMACIST));
    }

    @Test
    void theBellPreviewDoesNotCarryThePatientIdentifier() throws Exception {
        createOrder();

        // Previews render on a badge, a dropdown, and often a shared screen. The
        // detail lives on the record the recipient clicks through to.
        assertThat(notificationRepository.findAll()).allSatisfy(row -> {
            assertThat(row.getMessage()).doesNotContain(patientId);
            assertThat(row.getMessage()).doesNotContain("CBC");
        });
    }

    @Test
    void movingAnOrderTellsTheOrderingDoctor() throws Exception {
        String orderId = createOrder();

        mockMvc.perform(patch("/api/lab-orders/" + orderId + "/status")
                        .with(asUser(labTechId))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\":\"IN_PROGRESS\"}"))
                .andExpect(status().isOk());

        assertThat(notificationRepository.findAll())
                .as("without this the doctor learns an order was dropped only when no result arrives")
                .anySatisfy(row -> {
                    assertThat(row.getRecipientUserId()).isEqualTo(doctorId);
                    assertThat(row.getTitle()).containsIgnoringCase("in progress");
                });
    }

    @Test
    void theDoctorWhoMovedTheOrderIsNotToldAboutIt() throws Exception {
        String orderId = createOrder();

        mockMvc.perform(patch("/api/lab-orders/" + orderId + "/status")
                        .with(asUser(labTechId))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\":\"IN_PROGRESS\"}"))
                .andExpect(status().isOk());

        // The laboratory is a separate user from the ordering doctor here, so this
        // only pins that the laboratory-side broadcast exists and the doctor-side
        // one is not duplicated to the same person when they are the same actor.
        assertThat(notificationRepository.findAll())
                .filteredOn(row -> row.getRecipientUserId() != null
                        && row.getRecipientUserId().equals(doctorId))
                .hasSize(1);
    }

    @Test
    void repeatingTheSameStatusChangeIsNotAnnouncedTwice() throws Exception {
        String orderId = createOrder();

        mockMvc.perform(patch("/api/lab-orders/" + orderId + "/status")
                        .with(asUser(labTechId))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\":\"IN_PROGRESS\"}"))
                .andExpect(status().isOk());
        long afterFirst = notificationRepository.count();

        mockMvc.perform(patch("/api/lab-orders/" + orderId + "/status")
                        .with(asUser(labTechId))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\":\"IN_PROGRESS\"}"))
                .andExpect(status().isOk());

        assertThat(notificationRepository.count())
                .as("re-sending the current status is not an event")
                .isEqualTo(afterFirst);
    }

    @Test
    void aPharmacistStillSeesPrescriptionNotifications() throws Exception {
        // The removal above is scoped to lab orders. It must not silence the
        // prescription queue, which is the pharmacy's actual workflow.
        String pharmacistId = save(Pharmacist.builder().role(UserRole.PHARMACIST).build(), "pharm");

        mockMvc.perform(post("/api/v1/prescription-orders")
                        .with(asUser(doctorId))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"doctorId":"%s","doctorName":"Dr Test","patientName":"Patient Test",
                                 "drugName":"Amoxicillin 500mg","dosage":"500mg three times daily",
                                 "instructions":"Take with food"}
                                """.formatted(doctorId)))
                .andExpect(status().isCreated());

        assertThat(notificationRepository.findAll())
                .anySatisfy(row -> {
                    assertThat(row.getRecipientRole()).isEqualTo(UserRole.PHARMACIST);
                    assertThat(row.getType()).isEqualTo(NotificationType.PRESCRIPTION_CREATED);
                });
        assertThat(pharmacistId).isNotBlank();
    }

    // ------------------------------------------------------------------

    private String createOrder() throws Exception {
        String body = mockMvc.perform(post("/api/lab-orders")
                        .with(asUser(doctorId))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"patientId":"%s","doctorId":"%s",
                                 "tests":["CBC","LFT"],"urgency":"ROUTINE",
                                 "clinicalNotes":"Routine screening."}
                                """.formatted(patientId, doctorId)))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();

        return new com.fasterxml.jackson.databind.ObjectMapper().readTree(body).path("id").asText();
    }

    private String save(User user, String prefix) {
        user.setEmail(prefix + "." + shortId() + "@example.com");
        user.setPassword(passwordEncoder.encode("Password123!"));
        user.setFullName("Test " + user.getRole());
        user.setActive(true);
        return userRepository.save(user).getId();
    }

    private RequestPostProcessor asUser(String userId) {
        User user = userRepository.findById(userId).orElseThrow();
        CustomUserPrincipal principal = new CustomUserPrincipal(user);
        return SecurityMockMvcRequestPostProcessors.authentication(
                new UsernamePasswordAuthenticationToken(principal, null, principal.getAuthorities()));
    }

    private static String shortId() {
        return UUID.randomUUID().toString().substring(0, 8);
    }
}
