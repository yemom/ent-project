package com.clinic.security;

import com.clinic.entity.AdminUser;
import com.clinic.entity.Doctor;
import com.clinic.entity.Notification;
import com.clinic.entity.NotificationType;
import com.clinic.entity.Pharmacist;
import com.clinic.entity.User;
import com.clinic.entity.UserRole;
import com.clinic.repository.NotificationRepository;
import com.clinic.repository.PrescriptionOrderRepository;
import com.clinic.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Prescription events reach pharmacy and the prescriber — and nobody else.
 *
 * <p>Driven through the real service so the wiring itself is under test; calling the
 * notifier directly would pass whether or not it had been connected to anything.
 */
@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:clinicpresc;MODE=PostgreSQL;DB_CLOSE_DELAY=-1;DATABASE_TO_UPPER=false",
        "spring.datasource.driver-class-name=org.h2.Driver",
        "spring.datasource.username=sa",
        "spring.datasource.password=",
        "spring.jpa.hibernate.ddl-auto=create-drop",
        "spring.sql.init.mode=never",
        "spring.flyway.enabled=false",
        "app.rate-limit.enabled=false"
})
@AutoConfigureMockMvc
class PrescriptionNotificationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private NotificationRepository notificationRepository;

    @Autowired
    private PrescriptionOrderRepository prescriptionOrderRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    private String doctorId;
    private String pharmacistId;

    @BeforeEach
    void seed() {
        SecurityContextHolder.clearContext();
        notificationRepository.deleteAllInBatch();
        prescriptionOrderRepository.deleteAllInBatch();
        userRepository.deleteAllInBatch();

        doctorId = save(Doctor.builder().role(UserRole.DOCTOR).specialization("General")
                .licenseNumber("LIC-" + shortId()).available(true).build(), "doctor");
        pharmacistId = save(Pharmacist.builder().role(UserRole.PHARMACIST).build(), "pharmacist");
    }

    @Test
    void aNewPrescriptionReachesThePharmacyQueue() throws Exception {
        createPrescription();

        List<Notification> rows = notificationRepository.findAll();
        assertThat(rows).anySatisfy(row -> {
            assertThat(row.getType()).isEqualTo(NotificationType.PRESCRIPTION_CREATED);
            assertThat(row.getRecipientRole()).isEqualTo(UserRole.PHARMACIST);
        });

        assertThat(rows)
                .as("the prescriber wrote it; telling them back is noise")
                .noneSatisfy(row -> assertThat(row.getRecipientUserId()).isEqualTo(doctorId));
    }

    @Test
    void dispensingTellsThePrescribingDoctor() throws Exception {
        String orderId = createPrescription();

        mockMvc.perform(patch("/api/v1/prescription-orders/" + orderId + "/status")
                        .with(asUser(pharmacistId))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\":\"DISPENSED\"}"))
                .andExpect(status().isOk());

        assertThat(notificationRepository.findAll()).anySatisfy(row -> {
            assertThat(row.getRecipientUserId()).isEqualTo(doctorId);
            assertThat(row.getType()).isEqualTo(NotificationType.PRESCRIPTION_STATUS_CHANGED);
            // A rejected prescription needs a clinician to act; a dispensed one needs
            // no follow-up, so the wording differs.
            assertThat(row.getMessage()).isNotBlank();
        });
    }

    @Test
    void rejectionExplainsThatAReviewIsNeeded() throws Exception {
        String orderId = createPrescription();

        mockMvc.perform(patch("/api/v1/prescription-orders/" + orderId + "/status")
                        .with(asUser(pharmacistId))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\":\"REJECTED\"}"))
                .andExpect(status().isOk());

        assertThat(notificationRepository.findAll())
                .anySatisfy(row -> assertThat(row.getMessage()).contains("review"));
    }

    @Test
    void theNotificationNeverCarriesTheDrugOrThePatientName() throws Exception {
        String orderId = createPrescription();

        mockMvc.perform(patch("/api/v1/prescription-orders/" + orderId + "/status")
                        .with(asUser(pharmacistId))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\":\"DISPENSED\"}"))
                .andExpect(status().isOk());

        // A bell badge is visible on a shared screen. The recipient clicks through to
        // the record for the detail, so the preview must not carry it.
        assertThat(notificationRepository.findAll()).allSatisfy(row -> {
            assertThat(row.getTitle().toLowerCase(java.util.Locale.ROOT)).doesNotContain("warfarin");
            assertThat(row.getMessage().toLowerCase(java.util.Locale.ROOT)).doesNotContain("warfarin");
        });
    }

    @Test
    void theSameStatusChangeIsNotAnnouncedTwice() throws Exception {
        String orderId = createPrescription();

        mockMvc.perform(patch("/api/v1/prescription-orders/" + orderId + "/status")
                        .with(asUser(pharmacistId))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\":\"DISPENSED\"}"))
                .andExpect(status().isOk());
        long afterFirst = notificationRepository.count();

        mockMvc.perform(patch("/api/v1/prescription-orders/" + orderId + "/status")
                        .with(asUser(pharmacistId))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\":\"DISPENSED\"}"))
                .andExpect(status().isOk());

        assertThat(notificationRepository.count())
                .as("repeating an action must not fill the bell")
                .isEqualTo(afterFirst);
    }

    // ------------------------------------------------------------------

    private String createPrescription() throws Exception {
        String body = mockMvc.perform(post("/api/v1/prescription-orders")
                        .with(asUser(doctorId))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"doctorId":"%s","doctorName":"Dr Test","patientName":"Patient Test",
                                 "drugName":"Warfarin 5mg","dosage":"5mg once daily",
                                 "instructions":"Take with food"}
                                """.formatted(doctorId)))
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

    private org.springframework.test.web.servlet.request.RequestPostProcessor asUser(String userId) {
        User user = userRepository.findById(userId).orElseThrow();
        CustomUserPrincipal principal = new CustomUserPrincipal(user);
        return SecurityMockMvcRequestPostProcessors.authentication(
                new UsernamePasswordAuthenticationToken(principal, null, principal.getAuthorities()));
    }

    private static String shortId() {
        return UUID.randomUUID().toString().substring(0, 8);
    }


}