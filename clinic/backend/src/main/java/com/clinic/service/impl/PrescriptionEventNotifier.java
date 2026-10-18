package com.clinic.service.impl;

import com.clinic.entity.NotificationType;
import com.clinic.entity.PrescriptionOrder;
import com.clinic.entity.UserRole;
import com.clinic.security.CurrentUser;
import com.clinic.service.NotificationService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Set;

/**
 * Announces prescription lifecycle changes.
 *
 * <p>Called from the prescription service after the record is persisted, so a
 * rejected request never produces a notification claiming a prescription exists.
 *
 * <h2>Who is told, and why</h2>
 *
 * <ul>
 *   <li><b>Pharmacists</b> — a new order, or a status change, is their queue.
 *       They hold {@code prescription:verify} / {@code prescription:dispense}, so
 *       this is the one audience entitled to the content.</li>
 *   <li><b>The prescribing doctor</b> — told when pharmacy finishes with the order,
 *       because "dispensed" and "rejected, needs a look" both need a clinician's
 *       attention and neither would otherwise come back to them.</li>
 *   <li><b>The patient is not notified.</b> {@code PrescriptionOrder} stores no
 *       patient id — only a name — so there is no identity to address a
 *       notification to. Guessing one, or resolving a patient from a free-text
 *       name, would risk delivering clinical information to the wrong account.
 *       Patient-visible prescription release needs a real patient reference on the
 *       order, which is recorded as a gap rather than faked.</li>
 * </ul>
 *
 * <h2>Content</h2>
 *
 * The text deliberately omits the drug, the dosage and the patient name. A
 * notification is visible on a bell badge, in a dropdown, and often on a shared
 * screen; the recipient clicks through to the record that does carry the detail.
 */
@Service
@Slf4j
public class PrescriptionEventNotifier {

    private static final Set<UserRole> PHARMACY = Set.of(UserRole.PHARMACIST);

    private static final String PHARMACY_LINK = "/pharmacist/orders";
    private static final String DOCTOR_LINK = "/doctor/prescriptions";

    private final NotificationService notificationService;
    private final CurrentUser currentUser;

    public PrescriptionEventNotifier(NotificationService notificationService, CurrentUser currentUser) {
        this.notificationService = notificationService;
        this.currentUser = currentUser;
    }

    /** A prescription has been written and is waiting on the pharmacy queue. */
    @Transactional
    public void onCreated(PrescriptionOrder order) {
        if (order == null || order.getId() == null) {
            return;
        }
        int toPharmacy = notificationService.notifyRolesOnce(
                PHARMACY, NotificationType.PRESCRIPTION_CREATED,
                "Prescription awaiting review",
                "A new prescription has been added to the pharmacy queue.",
                order.getId(), PHARMACY_LINK,
                NotificationType.PRESCRIPTION_CREATED.name(), null);

        log.info("Prescription {} announced to pharmacy ({} row(s))", order.getId(), toPharmacy);
    }

    /**
     * The pharmacy moved the order on.
     *
     * <p>The target status is the event's discriminator, so "dispensed" and
     * "rejected" are separate announcements rather than one suppressing the other.
     */
    @Transactional
    public void onStatusChanged(PrescriptionOrder order, String previousStatus) {
        if (order == null || order.getId() == null) {
            return;
        }

        String status = order.getStatus() == null ? "" : order.getStatus().name();

        int toPharmacy = notificationService.notifyRolesOnce(
                PHARMACY, NotificationType.PRESCRIPTION_STATUS_CHANGED,
                "Prescription " + status.toLowerCase(java.util.Locale.ROOT),
                "A prescription in the pharmacy queue is now " + status + ".",
                order.getId(), PHARMACY_LINK,
                NotificationType.PRESCRIPTION_STATUS_CHANGED.name(), status);

        // The prescriber hears about it once pharmacy has acted. Notifying them at
        // creation would be noise: they wrote it.
        int toDoctor = 0;
        if (order.getDoctorId() != null && !order.getDoctorId().isBlank()) {
            String actor = currentUser.tryGetUserId();
            if (!order.getDoctorId().equals(actor)) {
                toDoctor = notificationService.notifyUsersOnce(
                        Set.of(order.getDoctorId()), NotificationType.PRESCRIPTION_STATUS_CHANGED,
                        "Your prescription was " + status.toLowerCase(java.util.Locale.ROOT),
                        statusMessage(status, previousStatus),
                        order.getId(), DOCTOR_LINK,
                        NotificationType.PRESCRIPTION_STATUS_CHANGED.name(), status);
            }
        }

        log.info("Prescription {} status {} -> {} announced: {} pharmacy row(s), {} doctor",
                order.getId(), previousStatus, status, toPharmacy, toDoctor);
    }

    /** Says what the prescriber now has to do, without restating the prescription. */
    private String statusMessage(String status, String previousStatus) {
        return switch (status) {
            case "DISPENSED" ->
                    "The pharmacy has dispensed your prescription. Any instructions were given at collection.";
            case "REJECTED" ->
                    "The pharmacy could not dispense this prescription and has asked for a review. "
                            + "Please contact the clinic to arrange an alternative.";
            default ->
                    "A prescription you raised is now " + status + ".";
        };
    }
}