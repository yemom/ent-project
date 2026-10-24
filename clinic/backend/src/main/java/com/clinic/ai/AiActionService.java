package com.clinic.ai;

import com.clinic.dto.request.AppointmentCreateRequest;
import com.clinic.dto.request.AppointmentUpdateRequest;
import com.clinic.dto.response.AppointmentResponse;
import com.clinic.entity.AiPendingAction;
import com.clinic.exception.BadRequestException;
import com.clinic.exception.ConflictException;
import com.clinic.exception.ForbiddenException;
import com.clinic.exception.ResourceNotFoundException;
import com.clinic.exception.ServiceUnavailableException;
import com.clinic.repository.AiPendingActionRepository;
import com.clinic.security.CurrentUser;
import com.clinic.service.AppointmentService;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.LocalDateTime;
import java.time.format.DateTimeParseException;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

/**
 * The human-approval gate for any appointment change the assistant proposes.
 *
 * <p>The split of responsibility is the important part:
 *
 * <ul>
 *   <li><b>Proposing</b> is a server-validated, typed operation. It is not
 *       something the model emits. A language model proposing "book Dr Smith at
 *       3pm for patient X" would be proposing a string, and a string is not
 *       something worth confirming.</li>
 *   <li><b>Confirming</b> re-runs every check. Permissions are re-read from the live
 *       principal, the payload is re-validated, and availability and conflicts are
 *       re-checked by {@link AppointmentService} at the moment of commit. The world
 *       moved between the proposal and the click, and a confirmation is not a
 *       promise about the future.</li>
 *   <li><b>Nothing happens without a click.</b> Creating a {@link AiPendingAction}
 *       writes one row. Until the owning user confirms, no appointment service is
 *       called at all.</li>
 * </ul>
 *
 * <p>An approval id is also not an authorisation: every read is scoped to the
 * proposing user, so an id leaked through a log or a screenshot is inert.
 */
@Service
@Slf4j
public class AiActionService {

    private static final Duration ACTION_TTL = Duration.ofMinutes(10);

    private final AiPendingActionRepository actionRepository;
    private final AppointmentService appointmentService;
    private final CurrentUser currentUser;
    private final ObjectMapper objectMapper;
    private final AiService aiService;

    public AiActionService(AiPendingActionRepository actionRepository,
                           AppointmentService appointmentService,
                           CurrentUser currentUser,
                           ObjectMapper objectMapper,
                           AiService aiService) {
        this.actionRepository = actionRepository;
        this.appointmentService = appointmentService;
        this.currentUser = currentUser;
        this.objectMapper = objectMapper;
        this.aiService = aiService;
    }

    /**
     * Prepares a booking for review.
     *
     * <p>Validates now so the confirmation screen shows something that can actually
     * succeed, but performs no write.
     *
     * @param conversationId the conversation this proposal belongs to, for context
     * @param patientId      the patient; ownership is enforced by the appointment service
     * @param doctorId       the doctor
     * @param appointmentDate ISO-8601 local date-time
     * @param durationMinutes appointment length
     * @param reason         why the visit is needed, shown to the user
     */
    @Transactional
    public AiPendingAction proposeBooking(String conversationId,
                                          String patientId,
                                          String doctorId,
                                          String appointmentDate,
                                          Integer durationMinutes,
                                          String reason) {
        requireActionPermission(AiPendingAction.TYPE_BOOK_APPOINTMENT);
        if (currentUser.is(com.clinic.entity.UserRole.PATIENT)
                && !currentUser.userId().equals(patientId)) {
            throw new ForbiddenException("You may only prepare appointments for yourself.");
        }
        requireAvailable();

        if (patientId == null || patientId.isBlank()
                || doctorId == null || doctorId.isBlank()) {
            throw new BadRequestException("A patient and a doctor are required");
        }

        LocalDateTime start;
        try {
            start = LocalDateTime.parse(appointmentDate);
        } catch (DateTimeParseException | NullPointerException ex) {
            throw new BadRequestException("The appointment date must be an ISO-8601 local date and time");
        }

        if (start.isBefore(LocalDateTime.now())) {
            throw new BadRequestException("An appointment cannot be booked in the past");
        }

        int duration = durationMinutes == null ? 30 : Math.max(5, Math.min(480, durationMinutes));

        String description = "Book an appointment on %s for %d minutes%s".formatted(
                start, duration, reason == null || reason.isBlank() ? "" : " — " + reason);

        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("patientId", patientId);
        payload.put("doctorId", doctorId);
        payload.put("appointmentDate", start.toString());
        payload.put("duration", duration);
        if (reason != null && !reason.isBlank()) {
            payload.put("reasonForVisit", reason);
        }

        return store(conversationId, AiPendingAction.TYPE_BOOK_APPOINTMENT, description, payload);
    }

    /**
     * Prepares a cancellation for review.
     */
    @Transactional
    public AiPendingAction proposeCancellation(String conversationId,
                                               String appointmentId,
                                               String reason) {
        requireActionPermission(AiPendingAction.TYPE_CANCEL);
        requireAvailable();
        if (appointmentId == null || appointmentId.isBlank()) {
            throw new BadRequestException("An appointment is required");
        }
        // Reads through the service, so a caller cannot even propose cancelling an
        // appointment they are not allowed to see.
        AppointmentResponse appointment = appointmentService.getById(appointmentId);

        String description = "Cancel the appointment on %s (currently %s)".formatted(
                appointment.appointmentDate(), appointment.status());

        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("appointmentId", appointmentId);
        payload.put("cancellationReason", reason == null || reason.isBlank()
                ? "Cancelled by an authorised user via the assistant"
                : reason);

        return store(conversationId, AiPendingAction.TYPE_CANCEL, description, payload);
    }

    /**
     * Prepares a reschedule for review.
     */
    @Transactional
    public AiPendingAction proposeReschedule(String conversationId,
                                             String appointmentId,
                                             String newDate,
                                             Integer durationMinutes) {
        requireActionPermission(AiPendingAction.TYPE_RESCHEDULE);
        requireAvailable();
        if (appointmentId == null || appointmentId.isBlank()) {
            throw new BadRequestException("An appointment is required");
        }
        AppointmentResponse appointment = appointmentService.getById(appointmentId);

        LocalDateTime start;
        try {
            start = LocalDateTime.parse(newDate);
        } catch (DateTimeParseException | NullPointerException ex) {
            throw new BadRequestException("The new date must be an ISO-8601 local date and time");
        }
        if (start.isBefore(LocalDateTime.now())) {
            throw new BadRequestException("An appointment cannot be moved into the past");
        }

        int duration = durationMinutes == null
                ? (appointment.duration() == null ? 30 : appointment.duration())
                : Math.max(5, Math.min(480, durationMinutes));

        String description = "Move the appointment on %s to %s (%d minutes)".formatted(
                appointment.appointmentDate(), start, duration);

        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("appointmentId", appointmentId);
        payload.put("appointmentDate", start.toString());
        payload.put("duration", duration);

        return store(conversationId, AiPendingAction.TYPE_RESCHEDULE, description, payload);
    }

    /**
     * Executes a previously proposed action.
     *
     * <p>Re-checks ownership, expiry, the caller's permissions and the payload
     * before touching the appointment service. The action is marked resolved even
     * when the appointment service rejects it, so a conflicting slot cannot be
     * retried indefinitely against a stale proposal.
     */
    @Transactional
    public ActionOutcome confirm(String actionId) {
        // Ownership before availability, for the same reason as in AiService.chat: a
        // proposal id that is not the caller's answers 404 whether or not the AI
        // feature happens to be switched on. An availability check first would turn
        // that into a 503 and make the endpoint's behaviour depend on configuration.
        AiPendingAction action = actionRepository
                .findOwnedById(actionId, currentUser.userId())
                // 404 rather than 403: a confirmation id is not an authorisation, and
                // answering "not found" for someone else's id reveals nothing.
                .orElseThrow(() -> new ResourceNotFoundException("This proposed action was not found"));

        requireAvailable();

        LocalDateTime now = LocalDateTime.now();
        if (action.isExpiredAt(now)) {
            action.setStatus(AiPendingAction.STATUS_EXPIRED);
            action.setResolvedAt(now);
            action.setResultMessage("The proposal expired before it was confirmed.");
            actionRepository.save(action);
            throw new BadRequestException("This proposal has expired. Please prepare it again.");
        }
        if (!action.isPending()) {
            throw new BadRequestException("This proposal has already been resolved.");
        }

        // Permissions are re-read here, not carried over from proposal time. A role
        // change between the two moments must take effect.
        if (!AiCapability.forActionType(action.getActionType()).isAvailableTo(currentUser.role())) {
            throw new ForbiddenException("You no longer have permission to perform this action.");
        }

        Map<String, Object> payload = readPayload(action);

        try {
            AppointmentResponse result = switch (action.getActionType()) {
                case AiPendingAction.TYPE_BOOK_APPOINTMENT -> appointmentService.create(
                        new AppointmentCreateRequest(
                                String.valueOf(payload.get("patientId")),
                                String.valueOf(payload.get("doctorId")),
                                LocalDateTime.parse(String.valueOf(payload.get("appointmentDate"))),
                                Integer.valueOf(String.valueOf(payload.get("duration"))),
                                "SCHEDULED",
                                payload.get("reasonForVisit") == null ? null : String.valueOf(payload.get("reasonForVisit")),
                                "Created after confirmation of an assistant proposal"));
                case AiPendingAction.TYPE_RESCHEDULE -> appointmentService.update(
                        String.valueOf(payload.get("appointmentId")),
                        new AppointmentUpdateRequest(
                                null, null,
                                LocalDateTime.parse(String.valueOf(payload.get("appointmentDate"))),
                                Integer.valueOf(String.valueOf(payload.get("duration"))),
                                null, null, null, null, null, null, null, null));
                case AiPendingAction.TYPE_CANCEL -> appointmentService.cancel(
                        String.valueOf(payload.get("appointmentId")),
                        payload.get("cancellationReason") == null
                                ? "Cancelled after confirmation of an assistant proposal"
                                : String.valueOf(payload.get("cancellationReason")));
                default -> throw new BadRequestException("Unsupported action type: " + action.getActionType());
            };

            action.setStatus(AiPendingAction.STATUS_EXECUTED);
            action.setResultEntityId(result.id());
            action.setResultMessage("Completed.");
            action.setResolvedAt(LocalDateTime.now());
            actionRepository.save(action);

            return new ActionOutcome(action.getId(), AiPendingAction.STATUS_EXECUTED, result.id(),
                    "The appointment change has been applied.");
        } catch (RuntimeException ex) {
            // Conflicts and validation failures are the expected outcomes of a
            // proposal that has gone stale. The action is spent either way: a slot
            // taken in the meantime will not reopen by trying again.
            action.setStatus(AiPendingAction.STATUS_FAILED);
            action.setResultMessage(safeMessage(ex));
            action.setResolvedAt(LocalDateTime.now());
            actionRepository.save(action);

            throw new com.clinic.exception.ConflictException("The proposed change could not be applied: " + safeMessage(ex));
        }
    }

    /**
     * Discards a proposal.
     *
     * <p>Explicit, and recorded, so a rejected proposal is distinguishable from one
     * that was never made.
     */
    @Transactional
    public void reject(String actionId) {
        AiPendingAction action = actionRepository
                .findOwnedById(actionId, currentUser.userId())
                .orElseThrow(() -> new ResourceNotFoundException("This proposed action was not found"));

        if (!action.isPending()) {
            throw new BadRequestException("This proposal has already been resolved.");
        }
        action.setStatus(AiPendingAction.STATUS_REJECTED);
        action.setResolvedAt(LocalDateTime.now());
        actionRepository.save(action);
    }

    public java.util.List<AiPendingAction> pendingActions() {
        return actionRepository.findByOwnerUserIdAndStatusOrderByCreatedAtDesc(
                currentUser.userId(), AiPendingAction.STATUS_PROPOSED);
    }

    // ------------------------------------------------------------------
    // helpers
    // ------------------------------------------------------------------

    private AiPendingAction store(String conversationId,
                                  String actionType,
                                  String description,
                                  Map<String, Object> payload) {
        LocalDateTime now = LocalDateTime.now();
        String conversation = (conversationId == null || conversationId.isBlank())
                ? null
                : conversationId;

        try {
            return actionRepository.save(AiPendingAction.builder()
                    .id(UUID.randomUUID().toString())
                    .ownerUserId(currentUser.userId())
                    .conversationId(conversation == null ? "" : conversation)
                    .actionType(actionType)
                    .status(AiPendingAction.STATUS_PROPOSED)
                    .description(description)
                    .payload(objectMapper.writeValueAsString(payload))
                    .createdAt(now)
                    .expiresAt(now.plus(ACTION_TTL))
                    .build());
        } catch (Exception ex) {
            throw new BadRequestException("The proposal could not be prepared");
        }
    }

    /** Re-reads the stored payload as a map; never trusts the raw text. */
    private Map<String, Object> readPayload(AiPendingAction action) {
        try {
            Map<String, Object> payload = objectMapper.readValue(
                    action.getPayload(), new TypeReference<>() {
                    });
            if (payload == null || payload.isEmpty()) {
                throw new BadRequestException("This proposal is missing its details and cannot be applied.");
            }
            return payload;
        } catch (BadRequestException ex) {
            throw ex;
        } catch (Exception ex) {
            log.warn("Stored proposal payload could not be parsed for actionId={}", action.getId());
            throw new BadRequestException("This proposal could not be read and has been discarded.");
        }
    }

    private void requireAvailable() {
        AiService.AiAvailability availability = aiService.availability();
        if (!availability.available()) {
            throw new ServiceUnavailableException(availability.reason());
        }
    }

    private void requireActionPermission(String actionType) {
        AiCapability capability = AiCapability.forActionType(actionType);
        if (capability == null || !capability.isAvailableTo(currentUser.role())) {
            throw new ForbiddenException("You do not have permission to prepare this action.");
        }
    }

    /**
     * A message safe to show a user and to log.
     *
     * <p>Domain exceptions carry a message written for exactly this audience;
     * anything else is replaced rather than propagated, because an arbitrary
     * exception message can contain a stack fragment or a query.
     */
    private String safeMessage(RuntimeException ex) {
        if (ex instanceof BadRequestException
                || ex instanceof ForbiddenException
                || ex instanceof com.clinic.exception.ConflictException
                || ex instanceof com.clinic.exception.ResourceNotFoundException) {
            return ex.getMessage();
        }
        log.warn("Assistant-proposed action failed unexpectedly: {}", ex.getClass().getSimpleName());
        return "the appointment could not be changed";
    }

    public record ActionOutcome(String actionId, String status, String appointmentId, String message) {
    }
}