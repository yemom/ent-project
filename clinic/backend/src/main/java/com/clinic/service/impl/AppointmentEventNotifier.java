package com.clinic.service.impl;

import com.clinic.entity.Appointment;
import com.clinic.entity.NotificationType;
import com.clinic.entity.UserRole;
import com.clinic.security.CurrentUser;
import com.clinic.service.NotificationService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.LinkedHashSet;
import java.util.Set;

/**
 * Announces appointment changes to the people who need to know.
 *
 * <p>Called from the appointment service <em>after</em> the record has been
 * persisted. That ordering is the point: a request rejected for a conflict or a
 * booking rule produces no notification, because no change happened. Wiring this
 * into a controller or a frontend handler would announce attempts, not events.
 *
 * <h2>Who is told, and why</h2>
 *
 * <ul>
 *   <li><b>The assigned doctor</b> — a booking or a change to a clinic they work
 *       is theirs to know about.</li>
 *   <li><b>The patient</b> — their own appointment moved. This is patient-facing
 *       information about their own care, which the patient is entitled to.</li>
 *   <li><b>Reception and the hospital administrator</b> — they own the schedule
 *       and are the ones who field the resulting phone call.</li>
 * </ul>
 *
 * <p><b>Nurses are deliberately not notified.</b> The requirement is to involve
 * nursing "only when the appointment type or workflow makes their involvement
 * relevant", and this schema has no appointment-type or care-path field that would
 * let that be decided honestly. Broadcasting to nurses on the assumption that they
 * might be needed is exactly the over-broadcast the system is meant to avoid, so
 * the safer default applies until there is data to decide with. Recorded as a known
 * limitation rather than left implicit.
 *
 * <h2>Duplicates</h2>
 *
 * Every emit is keyed on the event, the appointment and the recipient, so a retried
 * save or a double-clicked button cannot produce a second notification.
 */
@Service
@Slf4j
public class AppointmentEventNotifier {

    /**
     * Staff who own the schedule.
     *
     * <p>Reception is who field the phone call; the hospital administrator is
     * included because they own the service and are the escalation when reception
     * cannot act.
     */
    private static final Set<UserRole> SCHEDULING_STAFF =
            Set.of(UserRole.RECEPTIONIST, UserRole.HOSPITAL_ADMIN);

    /** Where a member of staff receiving one of these would act on it. */
    private static final String STAFF_LINK = "/reception/appointments";

    private final NotificationService notificationService;
    private final CurrentUser currentUser;

    public AppointmentEventNotifier(NotificationService notificationService, CurrentUser currentUser) {
        this.notificationService = notificationService;
        this.currentUser = currentUser;
    }

    /** An appointment has been booked. */
    @Transactional
    public void onCreated(Appointment appointment) {
        announce(appointment, NotificationType.APPOINTMENT_CREATED,
                "Appointment booked",
                "A new appointment has been scheduled on %s.".formatted(appointment.getAppointmentDate()),
                null);
    }

    /** An appointment has been moved to a different time. */
    @Transactional
    public void onRescheduled(Appointment appointment, String previousDate) {
        announce(appointment, NotificationType.APPOINTMENT_RESCHEDULED,
                "Appointment rescheduled",
                "Your appointment has moved from %s to %s.".formatted(
                        previousDate, appointment.getAppointmentDate()),
                // The previous time is part of the event's identity: an appointment
                // moved twice is two distinct announcements, not one.
                previousDate);
    }

    /** An appointment has been cancelled. */
    @Transactional
    public void onCancelled(Appointment appointment, String reason) {
        String status = appointment.getStatus() == null ? "" : appointment.getStatus().name();
        announce(appointment, NotificationType.APPOINTMENT_CANCELLED,
                "Appointment cancelled",
                reason == null || reason.isBlank()
                        ? "The appointment on %s has been cancelled.".formatted(appointment.getAppointmentDate())
                        : "The appointment on %s has been cancelled: %s".formatted(
                                appointment.getAppointmentDate(), reason),
                status);
    }

    /**
     * An appointment moved between lifecycle states.
     *
     * <p>The target status is the event's discriminator, so a confirmation and a
     * later no-show are two separate notifications rather than one that suppresses
     * the other.
     */
    @Transactional
    public void onStatusChanged(Appointment appointment) {
        String status = appointment.getStatus() == null ? "UPDATED" : appointment.getStatus().name();
        announce(appointment, NotificationType.APPOINTMENT_STATUS_CHANGED,
                "Appointment " + status.toLowerCase(java.util.Locale.ROOT).replace('_', ' '),
                "The appointment on %s is now %s.".formatted(appointment.getAppointmentDate(), status),
                status);
    }

    // ------------------------------------------------------------------

    private void announce(Appointment appointment,
                          NotificationType type,
                          String title,
                          String message,
                          String discriminator) {
        if (appointment == null || appointment.getId() == null) {
            return;
        }

        Set<String> careTeam = new LinkedHashSet<>();
        if (appointment.getDoctor() != null) {
            careTeam.add(appointment.getDoctor().getId());
        }
        if (appointment.getPatient() != null) {
            careTeam.add(appointment.getPatient().getId());
        }

        // A notification to whoever just made the change is noise: they already
        // know. Everyone else on the care team still needs telling.
        String actor = currentUser.tryGetUserId();
        if (actor != null) {
            careTeam.remove(actor);
        }

        int toCareTeam = notificationService.notifyUsersOnce(
                careTeam, type, title, message, appointment.getId(), STAFF_LINK,
                type.name(), discriminator);

        int toStaff = notificationService.notifyRolesOnce(
                SCHEDULING_STAFF, type, title, message, appointment.getId(), STAFF_LINK,
                type.name(), discriminator);

        log.info("Appointment {} announced: {} care-team recipient(s), {} staff row(s)",
                appointment.getId(), toCareTeam, toStaff);
    }
}