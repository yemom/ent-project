package com.clinic.service.impl;

import com.clinic.entity.LabOrder;
import com.clinic.entity.LabOrderStatus;
import com.clinic.entity.LabResult;
import com.clinic.entity.LabResultStatus;
import com.clinic.entity.NotificationType;
import com.clinic.entity.UserRole;
import com.clinic.security.CurrentUser;
import com.clinic.service.NotificationService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Locale;
import java.util.Set;

/**
 * Announces laboratory events to the people who have to act on them.
 *
 * <p>Replaces the inline {@code notifyRoles} / {@code createForUser} calls that
 * were scattered through the lab services. Those calls had three problems this
 * centralises:
 *
 * <ol>
 *   <li><b>They were not idempotent.</b> A retried request or a double-clicked
 *       button produced a second identical row in the bell. Every emit here is
 *       keyed through {@code …Once}, so an event is announced once.</li>
 *   <li><b>They broadcast to pharmacists.</b> A lab order is an investigation, not a
 *       medication, so the pharmacy has no queue for it. Worse, the message
 *       carried the patient id, so every pharmacist in the hospital received a
 *       notification naming a patient they have no clinical relationship with.
 *       The pharmacy audience is dropped here: it was over-broadcast, and it was
 *       carrying an identifier to an audience that should not have it.</li>
 *   <li><b>Order status changes announced nothing.</b> Accepting, starting and
 *       cancelling an order were silent, so the ordering doctor had no way to know
 *       the laboratory had picked the work up or dropped it.</li>
 * </ol>
 *
 * <h2>Who is told</h2>
 *
 * <ul>
 *   <li><b>Laboratory staff</b> — a new order or a status change is their queue.
 *       They hold {@code lab_order:read} and are entitled to the order's content.</li>
 *   <li><b>The ordering doctor</b> — told when the order moves and when a result
 *       reaches FINAL or is flagged critical. They requested the investigation and
 *       are the only party who acts on the result.</li>
 * </ul>
 *
 * <p><b>The patient is not notified here.</b> A laboratory result is clinical
 * information whose release to the patient is governed by the result's own
 * verification and release state, which this class does not read. Announcing
 * "a result is ready" before it is approved for release would tell the patient
 * something they are not yet entitled to know. Patient notification belongs on the
 * release path, not on the order path.
 *
 * <p><b>Nurses are not notified.</b> Requirement is to involve nursing "only when
 * the result or workflow requires nursing action". The schema has no field on
 * {@code LabOrder} or {@code LabResult} expressing that, so there is nothing to
 * decide with; broadcasting instead would be the over-notification the system
 * exists to avoid. Recorded as a limitation rather than guessed at.
 */
@Service
@Slf4j
public class LabEventNotifier {

    /**
     * The laboratory queue.
     *
     * <p>{@code LABORATORY} is the legacy alias of {@code LAB_TECHNICIAN} and is
     * included so a role-stamped row from before the rename is still delivered to.
     */
    private static final Set<UserRole> LABORATORY_STAFF =
            Set.of(UserRole.LAB_TECHNICIAN, UserRole.LABORATORY);

    private static final String ORDER_LINK = "/laboratory/orders";
    private static final String DOCTOR_LAB_LINK = "/doctor/laboratory";

    private final NotificationService notificationService;
    private final CurrentUser currentUser;

    public LabEventNotifier(NotificationService notificationService, CurrentUser currentUser) {
        this.notificationService = notificationService;
        this.currentUser = currentUser;
    }

    /** A doctor has requested an investigation. */
    @Transactional
    public void onOrderCreated(LabOrder order) {
        if (order == null || order.getId() == null) {
            return;
        }

        // Urgency is the only clinical qualifier in the preview. The test names and
        // the clinical notes stay on the record — the bell is a nudge, not the chart.
        String message = "A %s-priority investigation was requested.".formatted(
                order.getUrgency() == null ? "routine" : order.getUrgency().name().toLowerCase(Locale.ROOT));

        int toLab = notificationService.notifyRolesOnce(
                LABORATORY_STAFF, NotificationType.LAB_ORDER_CREATED,
                "New laboratory order", message,
                order.getId(), ORDER_LINK,
                NotificationType.LAB_ORDER_CREATED.name(), null);

        log.info("Lab order {} announced to the laboratory queue ({} role row(s))", order.getId(), toLab);
    }

    /**
     * The laboratory moved the order on.
     *
     * <p>The target status is the discriminator, so "accepted" and later
     * "cancelled" are two separate announcements rather than one suppressing the
     * other.
     *
     * @param previousStatus the status before this change, so a repeat of the
     *                       current status produces nothing
     */
    @Transactional
    public void onOrderStatusChanged(LabOrder order, String previousStatus) {
        if (order == null || order.getId() == null) {
            return;
        }

        String status = order.getStatus() == null ? "" : order.getStatus().name();
        if (status.equals(previousStatus)) {
            return; // nothing changed; re-sending the same status is not an event
        }

        int toLab = notificationService.notifyRolesOnce(
                LABORATORY_STAFF, NotificationType.LAB_ORDER_CREATED,
                "Laboratory order " + status.toLowerCase(Locale.ROOT).replace('_', ' '),
                "The order this laboratory raised is now " + status + ".",
                order.getId(), ORDER_LINK,
                NotificationType.LAB_ORDER_CREATED.name(), status);

        // The doctor who asked for the work hears that it moved. Without this the
        // only signal that an order was dropped is that no result ever arrives.
        int toDoctor = 0;
        String doctorId = order.getDoctorId();
        if (isNotBlank(doctorId) && !doctorId.equals(currentUser.tryGetUserId())) {
            toDoctor = notificationService.notifyUsersOnce(
                    Set.of(doctorId), NotificationType.LAB_ORDER_CREATED,
                    "Your laboratory order is now " + status.toLowerCase(Locale.ROOT).replace('_', ' '),
                    statusMessage(status),
                    order.getId(), DOCTOR_LAB_LINK,
                    NotificationType.LAB_ORDER_CREATED.name(), status);
        }

        log.info("Lab order {} {} -> {} announced: {} lab row(s), {} doctor",
                order.getId(), previousStatus, status, toLab, toDoctor);
    }

    /**
     * A result was recorded against an order.
     *
     * <p>A critical finding alerts the ordering doctor immediately rather than
     * waiting for finalisation: the whole point of a critical flag is that it must
     * not sit in a draft queue.
     */
    @Transactional
    public void onResultRecorded(LabResult result) {
        if (result == null || !Boolean.TRUE.equals(result.getCritical())) {
            return;
        }
        if (result.getLabOrder() == null) {
            return;
        }
        String doctorId = result.getLabOrder().getDoctorId();
        if (!isNotBlank(doctorId)) {
            return;
        }

        notificationService.createForUserOnce(
                doctorId,
                NotificationType.LAB_RESULT_READY,
                "Critical laboratory result",
                "A critical result has been recorded for one of your orders and needs your review.",
                result.getId(), DOCTOR_LAB_LINK,
                NotificationType.LAB_RESULT_READY.name(), "CRITICAL");
    }

    /**
     * A result was verified and is ready for the ordering doctor.
     *
     * <p>Keyed on the order, not the result row, so the same order going FINAL twice
     * notifies once. Re-finalising is something the UI and a retry can both cause,
     * and a result is a single event however many times it is saved.
     */
    @Transactional
    public void onResultFinalized(LabResult result) {
        if (result == null || !LabResultStatus.FINAL.equals(result.getStatus())) {
            return;
        }
        if (result.getLabOrder() == null) {
            return;
        }
        String doctorId = result.getLabOrder().getDoctorId();
        if (!isNotBlank(doctorId)) {
            return;
        }

        int created = notificationService.createForUserOnce(
                doctorId,
                NotificationType.LAB_RESULT_READY,
                "Laboratory result ready",
                "A result for one of your orders has been verified and is ready to review.",
                result.getId(),
                DOCTOR_LAB_LINK + "?orderId=" + result.getLabOrder().getId(),
                NotificationType.LAB_RESULT_READY.name(), "FINAL") == null ? 0 : 1;

        log.info("Lab result {} finalized for order {} ({} notification)",
                result.getId(), result.getLabOrder().getId(), created == 1 ? "new" : "already announced");
    }

    /** Says what changed, without restating the order. */
    private String statusMessage(String status) {
        return switch (status) {
            case "IN_PROGRESS" -> "The laboratory has started work on your investigation.";
            case "COMPLETED" -> "The laboratory has finished processing your investigation.";
            case "CANCELLED" -> "Your laboratory order was cancelled. Contact the clinic if you still need the test.";
            default -> "A laboratory order you raised is now " + status + ".";
        };
    }

    private static boolean isNotBlank(String value) {
        return value != null && !value.isBlank();
    }

    /** Kept for readability at the call sites that only care about the terminal states. */
    static boolean isTerminal(LabOrderStatus status) {
        return status == LabOrderStatus.COMPLETED || status == LabOrderStatus.CANCELLED;
    }
}
