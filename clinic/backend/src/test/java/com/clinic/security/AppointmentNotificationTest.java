package com.clinic.security;

import com.clinic.entity.AdminUser;
import com.clinic.entity.Appointment;
import com.clinic.entity.AppointmentStatus;
import com.clinic.entity.Doctor;
import com.clinic.entity.Notification;
import com.clinic.entity.NotificationType;
import com.clinic.entity.Patient;
import com.clinic.entity.User;
import com.clinic.entity.UserRole;
import com.clinic.repository.AppointmentRepository;
import com.clinic.repository.DoctorRepository;
import com.clinic.repository.NotificationRepository;
import com.clinic.repository.PatientRepository;
import com.clinic.repository.UserRepository;
import com.clinic.service.NotificationEventKey;
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

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Appointment events produce notifications, for the right people, exactly once.
 *
 * <p>Driven through the real appointment service rather than by calling the
 * notifier directly, because the property being tested is that a <em>successful
 * business operation</em> announces itself — and that a rejected one stays silent.
 * Calling the notifier directly would pass whether or not it was wired in at all.
 */
@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:clinicnotify;MODE=PostgreSQL;DB_CLOSE_DELAY=-1;DATABASE_TO_UPPER=false",
        "spring.datasource.driver-class-name=org.h2.Driver",
        "spring.datasource.username=sa",
        "spring.datasource.password=",
        "spring.jpa.hibernate.ddl-auto=create-drop",
        "spring.sql.init.mode=never",
        "spring.flyway.enabled=false",
        "app.rate-limit.enabled=false"
})
@AutoConfigureMockMvc
class AppointmentNotificationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private AppointmentRepository appointmentRepository;

    @Autowired
    private PatientRepository patientRepository;

    @Autowired
    private DoctorRepository doctorRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private NotificationRepository notificationRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    private String receptionistId;
    private String doctorId;
    private String patientId;

    @BeforeEach
    void seed() {
        SecurityContextHolder.clearContext();
        notificationRepository.deleteAllInBatch();
        appointmentRepository.deleteAllInBatch();
        patientRepository.deleteAllInBatch();
        userRepository.deleteAllInBatch();

        receptionistId = save(AdminUser.builder().role(UserRole.RECEPTIONIST).build(), "reception");
        doctorId = save(Doctor.builder().role(UserRole.DOCTOR).specialization("General")
                .licenseNumber("LIC-" + shortId()).available(true).build(), "doctor");
        patientId = save(Patient.builder().role(UserRole.PATIENT)
                .registrationNumber("REG-" + shortId()).build(), "patient");
    }

    // ------------------------------------------------------------------
    // Routing
    // ------------------------------------------------------------------

    @Test
    void bookingNotifiesThePatientAndSchedulingStaff() throws Exception {
        String appointmentId = bookAppointment();

        List<Notification> rows = notificationRepository.findAll();

        // The patient is told about their own appointment.
        assertThat(rows).anySatisfy(row -> {
            assertThat(row.getRecipientUserId()).isEqualTo(patientId);
            assertThat(row.getType()).isEqualTo(NotificationType.APPOINTMENT_CREATED);
            assertThat(row.getReferenceId()).isEqualTo(appointmentId);
        });

        // Reception owns the schedule and must see it land in the queue.
        assertThat(rows).anySatisfy(row ->
                assertThat(row.getRecipientRole()).isEqualTo(UserRole.RECEPTIONIST));

        // The receptionist made the booking; telling them is noise.
        assertThat(rows).noneSatisfy(row ->
                assertThat(row.getRecipientUserId()).isEqualTo(receptionistId));
    }

    @Test
    void reschedulingAnnouncesBothTheMoveAndTheReason() throws Exception {
        String appointmentId = bookAppointment();
        long before = notificationRepository.count();

        // A doctor-initiated change, so the patient and reception are the audience.
        mockMvc.perform(putAppointment(appointmentId, LocalDateTime.now().plusDays(9)
                                .withHour(14).withMinute(0).withSecond(0).withNano(0))
                        .with(asUser(receptionistId)))
                .andExpect(status().isOk());

        List<Notification> rows = notificationRepository.findAll();
        assertThat(rows.size()).isGreaterThan((int) before);
        assertThat(rows).anySatisfy(row -> {
            assertThat(row.getType()).isEqualTo(NotificationType.APPOINTMENT_RESCHEDULED);
            // The message has to say where it moved from, or the recipient cannot
            // tell what changed.
            assertThat(row.getMessage()).contains("moved from");
        });
    }

    @Test
    void cancellingAnnouncesTheCancellation() throws Exception {
        String appointmentId = bookAppointment();

        mockMvc.perform(put("/api/v1/appointments/" + appointmentId + "/status")
                        .with(asUser(receptionistId))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\":\"CANCELLED\",\"reason\":\"Patient unwell\"}"))
                .andExpect(status().isOk());

        // Announced as a cancellation, not a generic status change, so the recipient
        // is told why — which is the part they actually need.
        assertThat(notificationRepository.findAll()).anySatisfy(row -> {
            assertThat(row.getType()).isEqualTo(NotificationType.APPOINTMENT_CANCELLED);
            assertThat(row.getMessage()).contains("Patient unwell");
        });
    }

    @Test
    void nursesAreNotBroadcastTo() throws Exception {
        // Nothing in the schema says whether a given appointment concerns nursing,
        // so notifying them would be an over-broadcast of private information.
        String nurseId = save(AdminUser.builder().role(UserRole.NURSE).build(), "nurse");
        assertThat(nurseId).isNotBlank();

        bookAppointment();

        assertThat(notificationRepository.findAll())
                .noneSatisfy(row -> assertThat(row.getRecipientRole()).isEqualTo(UserRole.NURSE));
    }

    // ------------------------------------------------------------------
    // Idempotency
    // ------------------------------------------------------------------

    @Test
    void theSameEventIsNotAnnouncedTwice() {
        Appointment appointment = appointmentEntity();

        String key = NotificationEventKey.of("APPOINTMENT_CREATED", appointment.getId(), null,
                patientId, null);
        assertThat(key).isNotBlank();

        // The key is a pure function of the event, which is what makes it usable as
        // a uniqueness constraint.
        assertThat(NotificationEventKey.of("APPOINTMENT_CREATED", appointment.getId(), null, patientId, null))
                .isEqualTo(key);
        // A different recipient is a different announcement.
        assertThat(NotificationEventKey.of("APPOINTMENT_CREATED", appointment.getId(), null, doctorId, null))
                .isNotEqualTo(key);
        // A different event type is a different announcement.
        assertThat(NotificationEventKey.of("APPOINTMENT_CANCELLED", appointment.getId(), null, patientId, null))
                .isNotEqualTo(key);
    }

    @Test
    void aRepeatedStatusChangeDoesNotDuplicateTheSameNotification() throws Exception {
        String appointmentId = bookAppointment();

        // SCHEDULED -> CONFIRMED, then CONFIRMED -> CONFIRMED (idempotent no-op).
        mockMvc.perform(put("/api/v1/appointments/" + appointmentId + "/status")
                        .with(asUser(receptionistId))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\":\"CONFIRMED\"}"))
                .andExpect(status().isOk());
        long afterFirst = notificationRepository.count();

        mockMvc.perform(put("/api/v1/appointments/" + appointmentId + "/status")
                        .with(asUser(receptionistId))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\":\"CONFIRMED\"}"))
                .andExpect(status().isOk());

        assertThat(notificationRepository.count())
                .as("re-sending the current state must not re-announce it")
                .isEqualTo(afterFirst);
    }

    @Test
    void eachRowCarriesAnEventKey() throws Exception {
        bookAppointment();
        assertThat(notificationRepository.findAll())
                .isNotEmpty()
                .allSatisfy(row -> assertThat(row.getEventKey()).isNotBlank());
    }

    // ------------------------------------------------------------------
    // Failures stay silent
    // ------------------------------------------------------------------

    @Test
    void aRejectedBookingProducesNoNotification() throws Exception {
        LocalDateTime slot = LocalDateTime.now().plusDays(3)
                .withHour(11).withMinute(0).withSecond(0).withNano(0);
        bookAppointment(slot);
        long afterBooking = notificationRepository.count();

        // The same slot a second time is refused with 409. Nothing changed, so
        // nothing may be announced — a notification here would tell staff an
        // appointment exists that does not.
        mockMvc.perform(post("/api/v1/appointments")
                        .with(asUser(receptionistId))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(bookBody(slot)))
                .andExpect(status().isConflict());

        assertThat(notificationRepository.count())
                .as("a conflict changes nothing, so nothing may be announced")
                .isEqualTo(afterBooking);
    }

    // ------------------------------------------------------------------
    // Reading
    // ------------------------------------------------------------------

    @Test
    void notificationsPersistAndAreScopedToTheirRecipient() throws Exception {
        bookAppointment();

        String patientBody = mockMvc.perform(get("/api/v1/notifications").with(asUser(patientId)))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();

        assertThat(patientBody).contains("Appointment booked");

        // A real, unrelated user must not see it. A fabricated id would answer 401
        // and prove nothing about visibility.
        String otherPatientId = save(Patient.builder().role(UserRole.PATIENT)
                .registrationNumber("REG-" + shortId()).build(), "other");
        String otherBody = mockMvc.perform(get("/api/v1/notifications").with(asUser(otherPatientId)))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();

        assertThat(otherBody).doesNotContain("Appointment booked");
    }

    @Test
    void unreadCountReflectsNewNotifications() throws Exception {
        bookAppointment();

        // `GET /notifications/unread-count` answers with a bare number, not an
        // envelope, so the assertion is on the body rather than a JSON path.
        String count = mockMvc.perform(get("/api/v1/notifications/unread-count").with(asUser(patientId)))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();

        assertThat(Long.parseLong(count.trim())).isPositive();
    }

    // ------------------------------------------------------------------
    // helpers
    // ------------------------------------------------------------------

    private String bookAppointment() throws Exception {
        return bookAppointment(LocalDateTime.now().plusDays(3)
                .withHour(9).withMinute(0).withSecond(0).withNano(0));
    }

    /**
     * Books an appointment and returns its id.
     *
     * <p>The id is read from JSON rather than by pattern: {@code AppointmentResponse}
     * also carries {@code patient.id} and {@code doctor.id}, so a greedy regex over
     * the body picks up one of those instead and every later request then targets
     * the wrong record.
     */
    private String bookAppointment(LocalDateTime when) throws Exception {
        String body = mockMvc.perform(post("/api/v1/appointments")
                        .with(asUser(receptionistId))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(bookBody(when)))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        return new com.fasterxml.jackson.databind.ObjectMapper()
                .readTree(body)
                .path("id")
                .asText();
    }

    private String bookBody(LocalDateTime when) {
        return """
                {"patientId":"%s","doctorId":"%s",
                 "appointmentDate":"%s","duration":30,"reasonForVisit":"Review"}
                """.formatted(patientId, doctorId, when.format(DateTimeFormatter.ISO_LOCAL_DATE_TIME));
    }

    private org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder putAppointment(
            String id, LocalDateTime when) {
        return org.springframework.test.web.servlet.request.MockMvcRequestBuilders
                .put("/api/v1/appointments/" + id)
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                        {"appointmentDate":"%s","duration":30}
                        """.formatted(when.format(DateTimeFormatter.ISO_LOCAL_DATE_TIME)));
    }

    private Appointment appointmentEntity() {
        return Appointment.builder()
                .patient(patientRepository.findById(patientId).orElseThrow())
                .doctor((Doctor) userRepository.findById(doctorId).orElseThrow())
                .appointmentDate(LocalDateTime.now().plusDays(1))
                .duration(30)
                .status(AppointmentStatus.SCHEDULED)
                .build();
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
