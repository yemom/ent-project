package com.clinic.security;

import com.clinic.entity.AdminUser;
import com.clinic.entity.Notification;
import com.clinic.entity.NotificationType;
import com.clinic.entity.Patient;
import com.clinic.entity.User;
import com.clinic.entity.UserRole;
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

import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Notification isolation, filtering and read-state persistence.
 *
 * <p>Covers the three properties the feature actually rests on: a caller sees only
 * their own rows, the category and read-state filters narrow rather than widen, and
 * read state survives a reload. Each is asserted through the HTTP layer rather
 * than by calling the repository, so the controller's scoping is under test too.
 */
@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:clinicnotif;MODE=PostgreSQL;DB_CLOSE_DELAY=-1;DATABASE_TO_UPPER=false",
        "spring.datasource.driver-class-name=org.h2.Driver",
        "spring.datasource.username=sa",
        "spring.datasource.password=",
        "spring.jpa.hibernate.ddl-auto=create-drop",
        "spring.sql.init.mode=never",
        "spring.flyway.enabled=false",
        "app.rate-limit.enabled=false"
})
@AutoConfigureMockMvc
class NotificationFilteringTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private NotificationRepository notificationRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    private String patientId;
    private String otherPatientId;

    @BeforeEach
    void seed() {
        SecurityContextHolder.clearContext();
        notificationRepository.deleteAllInBatch();
        userRepository.deleteAllInBatch();

        patientId = save(Patient.builder().role(UserRole.PATIENT).build(), "patient");
        otherPatientId = save(Patient.builder().role(UserRole.PATIENT).build(), "other");
    }

    // ------------------------------------------------------------------
    // Isolation
    // ------------------------------------------------------------------

    @Test
    void aCallerOnlySeesTheirOwnNotifications() throws Exception {
        notificationRepository.saveAll(List.of(
                row(patientId, NotificationType.APPOINTMENT_CREATED),
                row(otherPatientId, NotificationType.LAB_RESULT_READY)));

        mockMvc.perform(get("/api/v1/notifications").with(asUser(patientId)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(1))
                .andExpect(jsonPath("$.content[0].type").value("APPOINTMENT_CREATED"));
    }

    @Test
    void aRoleBroadcastIsVisibleToHoldersOfThatRoleAndToNobodyElse() throws Exception {
        // There is no dedicated Receptionist entity, and `User` is abstract, so the
        // role is carried on the generic staff entity the rest of the suite uses.
        // Only the role matters here: notification scoping reads the role and nothing
        // else.
        String receptionistId = save(AdminUser.builder()
                .role(UserRole.RECEPTIONIST)
                .build(), "reception");
        notificationRepository.save(Notification.builder()
                .recipientRole(UserRole.RECEPTIONIST)
                .type(NotificationType.SYSTEM)
                .title("Clinic notice")
                .message("Water supply is off until 4pm.")
                .build());

        mockMvc.perform(get("/api/v1/notifications").with(asUser(receptionistId)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(1));

        mockMvc.perform(get("/api/v1/notifications").with(asUser(patientId)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(0));
    }

    @Test
    void oneUserCannotMarkAnotherUsersNotificationRead() throws Exception {
        Notification theirs = notificationRepository.save(row(otherPatientId, NotificationType.SYSTEM));

        mockMvc.perform(patch("/api/v1/notifications/" + theirs.getId() + "/read")
                        .with(asUser(patientId)))
                .andExpect(status().isNotFound());

        assertThat(notificationRepository.findById(theirs.getId()).orElseThrow().isRead())
                .as("a rejected request must leave the other user's row untouched")
                .isFalse();
    }

    @Test
    void theLegacyLabNotificationEndpointsAreGone() throws Exception {
        // These took the recipient's userId from the query string and returned that
        // user's rows with only a role check, so any doctor could read any other
        // doctor's notifications, and any id could be marked read — or unread — by
        // anyone. The unified owner-scoped endpoints above replaced them; this pins
        // that the unscoped surface does not come back.
        mockMvc.perform(get("/api/lab-notifications")
                        .param("userId", otherPatientId)
                        .with(asUser(patientId)))
                .andExpect(status().isNotFound());

        mockMvc.perform(get("/api/lab-notifications/unread-count/" + otherPatientId)
                        .with(asUser(patientId)))
                .andExpect(status().isNotFound());
    }

    // ------------------------------------------------------------------
    // Filtering
    // ------------------------------------------------------------------

    @Test
    void theCategoryFilterNarrowsWithoutWidening() throws Exception {
        notificationRepository.saveAll(List.of(
                row(patientId, NotificationType.APPOINTMENT_CREATED),
                row(patientId, NotificationType.APPOINTMENT_CANCELLED),
                row(patientId, NotificationType.LAB_RESULT_READY)));

        mockMvc.perform(get("/api/v1/notifications")
                        .param("type", "APPOINTMENT_CREATED")
                        .with(asUser(patientId)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(1))
                .andExpect(jsonPath("$.content[0].type").value("APPOINTMENT_CREATED"));
    }

    @Test
    void theCategoryFilterCannotReachAnotherUsersRows() throws Exception {
        notificationRepository.saveAll(List.of(
                row(patientId, NotificationType.APPOINTMENT_CREATED),
                row(otherPatientId, NotificationType.APPOINTMENT_CREATED)));

        // The patient asks for exactly the category the other patient's row has.
        mockMvc.perform(get("/api/v1/notifications")
                        .param("type", "APPOINTMENT_CREATED")
                        .with(asUser(patientId)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(1));
    }

    @Test
    void theReadStateFilterSplitsTheList() throws Exception {
        Notification read = notificationRepository.save(row(patientId, NotificationType.SYSTEM));
        read.markRead();
        notificationRepository.save(read);
        notificationRepository.save(row(patientId, NotificationType.SYSTEM));

        mockMvc.perform(get("/api/v1/notifications").param("read", "false").with(asUser(patientId)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(1));

        mockMvc.perform(get("/api/v1/notifications").param("read", "true").with(asUser(patientId)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(1));

        mockMvc.perform(get("/api/v1/notifications").with(asUser(patientId)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(2));
    }

    @Test
    void anUnknownCategoryIsRejectedRatherThanTreatedAsNoFilter() throws Exception {
        notificationRepository.save(row(patientId, NotificationType.SYSTEM));

        // Silently ignoring the typo would return the unfiltered list and read as
        // "you have no notifications of that kind" rather than "that kind is wrong".
        mockMvc.perform(get("/api/v1/notifications")
                        .param("type", "APPLEPOINTMENT_CREATED")
                        .with(asUser(patientId)))
                .andExpect(status().isBadRequest());
    }

    // ------------------------------------------------------------------
    // Read state
    // ------------------------------------------------------------------

    @Test
    void readStatePersistsAcrossAReload() throws Exception {
        Notification row = notificationRepository.save(row(patientId, NotificationType.SYSTEM));

        mockMvc.perform(patch("/api/v1/notifications/" + row.getId() + "/read")
                        .with(asUser(patientId)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.read").value(true));

        // The bell re-reads this on every visit, so the badge has to be correct
        // from the database rather than from anything held in the tab.
        mockMvc.perform(get("/api/v1/notifications").with(asUser(patientId)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content[0].read").value(true));

        mockMvc.perform(get("/api/v1/notifications/unread-count").with(asUser(patientId)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").value(0));
    }

    @Test
    void markingEverythingReadUpdatesTheUnreadCount() throws Exception {
        notificationRepository.saveAll(List.of(
                row(patientId, NotificationType.SYSTEM),
                row(patientId, NotificationType.APPOINTMENT_CREATED)));
        notificationRepository.save(row(otherPatientId, NotificationType.SYSTEM));

        mockMvc.perform(patch("/api/v1/notifications/read-all").with(asUser(patientId)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").value(2));

        mockMvc.perform(get("/api/v1/notifications/unread-count").with(asUser(patientId)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").value(0));

        // The other patient's row must not have been touched by the bulk update.
        assertThat(notificationRepository.findAll())
                .filteredOn(row -> otherPatientId.equals(row.getRecipientUserId()))
                .allSatisfy(row -> assertThat(row.isRead()).isFalse());
    }

    // ------------------------------------------------------------------

    private Notification row(String recipientUserId, NotificationType type) {
        return Notification.builder()
                .recipientUserId(recipientUserId)
                .type(type)
                .title(type.name())
                .message("Notification for " + type.name())
                .build();
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
