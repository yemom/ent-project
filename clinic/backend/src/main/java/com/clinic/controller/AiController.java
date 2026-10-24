package com.clinic.controller;

import com.clinic.ai.AiActionService;
import com.clinic.ai.AiCapability;
import com.clinic.ai.AiCapabilityResult;
import com.clinic.ai.AiService;
import com.clinic.config.ApiPaths;
import com.clinic.dto.request.AiChatRequest;
import com.clinic.dto.request.AiProposeActionRequest;
import com.clinic.dto.response.AiCapabilitiesResponse;
import com.clinic.dto.response.AiChatResponse;
import com.clinic.dto.response.AiForecastResponse;
import com.clinic.dto.response.AiConversationResponse;
import com.clinic.dto.response.AiMessageResponse;
import com.clinic.dto.response.AiPendingActionResponse;
import com.clinic.entity.AiConversation;
import com.clinic.entity.AiMessage;
import com.clinic.entity.AiPendingAction;
import com.clinic.exception.BadRequestException;
import com.clinic.exception.ResourceNotFoundException;
import com.clinic.repository.AiConversationRepository;
import com.clinic.repository.AiMessageRepository;
import com.clinic.security.CurrentUser;
import jakarta.validation.Valid;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * The AI assistant's HTTP surface.
 *
 * <p>Every method requires authentication and no method trusts anything
 * identity-bearing from the request. Role and resource permissions are re-checked
 * in {@code AiCapabilityService} and {@code AiActionService}; conversation ownership
 * is enforced inside the repository query.
 *
 * <p>The controller holds no business logic — it maps requests to services and
 * results to DTOs. Anything that looks like a decision here is a decision that
 * belongs a layer down, and would be untested.
 */
@RestController
@RequestMapping(ApiPaths.AI)
@Slf4j
@PreAuthorize("isAuthenticated()")
public class AiController {

    private final AiService aiService;
    private final AiActionService actionService;
    private final AiConversationRepository conversationRepository;
    private final AiMessageRepository messageRepository;
    private final CurrentUser currentUser;

    public AiController(AiService aiService,
                        AiActionService actionService,
                        AiConversationRepository conversationRepository,
                        AiMessageRepository messageRepository,
                        CurrentUser currentUser) {
        this.aiService = aiService;
        this.actionService = actionService;
        this.conversationRepository = conversationRepository;
        this.messageRepository = messageRepository;
        this.currentUser = currentUser;
    }

    /**
     * What the assistant can do, and whether it is switched on.
     *
     * <p>Answers 200 with {@code available: false} rather than 503 when the feature
     * is merely disabled: the frontend needs the capabilities list either way, and a
     * disabled feature is a state to render, not an error.
     */
    @GetMapping("/capabilities")
    public ResponseEntity<AiCapabilitiesResponse> capabilities() {
        AiService.AiAvailability availability = aiService.availability();
        List<AiCapabilitiesResponse.Capability> capabilities = aiService.capabilities().stream()
                .map(AiController::describe)
                .toList();
        return ResponseEntity.ok(new AiCapabilitiesResponse(
                availability.available(),
                availability.enabled(),
                availability.providerConfigured(),
                availability.provider(),
                availability.reason(),
                capabilities));
    }

    /**
     * Answers one question from authorised hospital data.
     */
    @PostMapping("/chat")
    public ResponseEntity<AiChatResponse> chat(@Valid @RequestBody AiChatRequest request) {
        AiService.AiTurnResult turn = aiService.chat(
                request.capabilityId(),
                request.arguments(),
                request.message(),
                request.conversationId());

        return ResponseEntity.ok(new AiChatResponse(
                turn.conversationId(),
                turn.answer(),
                turn.requiresHumanReview(),
                turn.reviewNotice(),
                turn.sources(),
                turn.computedAt(),
                turn.containsIdentifiableData(),
                turn.urgentConcernDetected()));
    }

    /**
     * Returns the computed, role-scoped forecast even when the optional language
     * model provider is disabled. No generated claim is presented as a fact.
     */
    @GetMapping("/forecast")
    public ResponseEntity<AiForecastResponse> forecast() {
        AiCapabilityResult facts = aiService.forecast();
        return ResponseEntity.ok(new AiForecastResponse(
                facts.facts(),
                facts.sources(),
                facts.computedAt()));
    }

    /** The caller's own conversations, newest first. */
    @GetMapping("/conversations")
    public ResponseEntity<List<AiConversationResponse>> conversations(
            @org.springframework.web.bind.annotation.RequestParam(defaultValue = "0") int page,
            @org.springframework.web.bind.annotation.RequestParam(defaultValue = "20") int size) {
        int bounded = Math.max(1, Math.min(50, size));
        int boundedPage = Math.max(0, page);
        List<AiConversationResponse> conversations = conversationRepository
                .findOwnedByUser(currentUser.userId(), PageRequest.of(boundedPage, bounded))
                .getContent()
                .stream()
                .map(AiController::toResponse)
                .toList();
        return ResponseEntity.ok(conversations);
    }

    /**
     * One conversation's turns.
     *
     * <p>A conversation belonging to somebody else answers 404 — the owner-scoped
     * query returns empty — so this cannot be used to probe for valid ids.
     */
    @GetMapping("/conversations/{id}")
    public ResponseEntity<List<AiMessageResponse>> conversation(@PathVariable String id) {
        AiConversation conversation = conversationRepository
                .findOwnedById(id, currentUser.userId())
                .orElseThrow(() -> new ResourceNotFoundException("Conversation not found"));

        List<AiMessageResponse> messages = messageRepository
                .findByConversationIdOrderByCreatedAtAsc(conversation.getId())
                .stream()
                .map(AiController::toResponse)
                .toList();
        return ResponseEntity.ok(messages);
    }

    /**
     * Prepares an appointment change for review.
     *
     * <p>Returns 201 with a proposal. Nothing has been written to the appointment
     * book: the response carries an approval id and a description for the
     * confirmation screen.
     */
    @PostMapping("/actions/propose")
    public ResponseEntity<AiPendingActionResponse> propose(@Valid @RequestBody AiProposeActionRequest request) {
        String type = request.type().trim().toUpperCase(java.util.Locale.ROOT);

        AiPendingAction action = switch (type) {
            case AiPendingAction.TYPE_BOOK_APPOINTMENT, "BOOK" -> actionService.proposeBooking(
                    request.conversationId(), request.patientId(), request.doctorId(),
                    request.appointmentDate(), request.durationMinutes(), request.reason());
            case AiPendingAction.TYPE_RESCHEDULE, "RESCHEDULE" -> actionService.proposeReschedule(
                    request.conversationId(), request.appointmentId(),
                    request.appointmentDate(), request.durationMinutes());
            case AiPendingAction.TYPE_CANCEL, "CANCEL" -> actionService.proposeCancellation(
                    request.conversationId(), request.appointmentId(), request.reason());
            default -> throw new BadRequestException("Unsupported action type: " + request.type());
        };

        return ResponseEntity.status(HttpStatus.CREATED).body(toResponse(action));
    }

    /** Proposals awaiting this user's decision. */
    @GetMapping("/actions/pending")
    public ResponseEntity<List<AiPendingActionResponse>> pendingActions() {
        return ResponseEntity.ok(actionService.pendingActions().stream()
                .map(AiController::toResponse)
                .toList());
    }

    /**
     * Applies a proposal the user explicitly approved.
     *
     * <p>Re-checks ownership, expiry, permissions, payload validity and slot
     * availability before committing.
     */
    @PostMapping("/actions/{id}/confirm")
    public ResponseEntity<AiPendingActionResponse> confirm(@PathVariable String id) {
        AiActionService.ActionOutcome outcome = actionService.confirm(id);
        return ResponseEntity.ok(new AiPendingActionResponse(
                outcome.actionId(),
                null,
                outcome.status(),
                null,
                null,
                null,
                outcome.message(),
                outcome.appointmentId()));
    }

    /** Discards a proposal without applying it. */
    @PostMapping("/actions/{id}/reject")
    public ResponseEntity<Void> reject(@PathVariable String id) {
        actionService.reject(id);
        return ResponseEntity.noContent().build();
    }

    // ------------------------------------------------------------------
    // mapping
    // ------------------------------------------------------------------

    private static AiCapabilitiesResponse.Capability describe(AiCapability capability) {
        return new AiCapabilitiesResponse.Capability(
                capability.id(),
                capability.label(),
                capability.description(),
                suggestedQuestion(capability),
                capability.involvesClinicalText(),
                capability.requiredArguments().stream()
                        .map(arg -> new AiCapabilitiesResponse.RequiredArgument(arg.name(), arg.prompt()))
                        .toList());
    }

    /** Ready-made questions, so the UI never invents prompts a user cannot ground. */
    private static String suggestedQuestion(AiCapability capability) {
        return switch (capability) {
            case APPOINTMENT_METRICS ->
                    "Summarise today's appointments using the authorised scheduling data.";
            case AVAILABLE_SLOTS ->
                    "Which appointment slots are free for this doctor over the next week?";
            case PATIENT_REGISTRATIONS ->
                    "How many new patients registered in the last 30 days?";
            case STAFF_WORKLOAD ->
                    "Which doctors are carrying the heaviest appointment load this month?";
            case PHARMACY_INVENTORY ->
                    "Which pharmacy items are below their reorder thresholds, and what expires soon?";
            case LABORATORY_WORKLOAD ->
                    "Summarise the pending laboratory workload.";
            case FINANCIAL_SUMMARY ->
                    "Show the monthly financial summary I am authorised to access.";
            case CLINICAL_DOCUMENTATION ->
                    "Draft a visit summary from the authorised clinical notes for this encounter.";
            case PATIENT_OWN_RECORD ->
                    "Explain my most recent medical record in plain language.";
            case PATIENT_OWN_APPOINTMENTS ->
                    "What are my upcoming appointments, and what should I prepare for?";
            case MY_APPOINTMENTS ->
                    "Summarise today's appointments assigned to me, and which need confirmation.";
            case OPERATIONAL_FORECAST ->
                    "Forecast the next 30 days from the authorised operational data and explain the limitations.";
        };
    }

    private static AiConversationResponse toResponse(AiConversation conversation) {
        return new AiConversationResponse(
                conversation.getId(),
                conversation.getTitle(),
                conversation.getCreatedAt(),
                conversation.getUpdatedAt());
    }

    private static AiMessageResponse toResponse(AiMessage message) {
        boolean assistantTurn = AiMessage.ROLE_ASSISTANT.equals(message.getRole());
        return new AiMessageResponse(
                message.getId(),
                message.getRole(),
                message.getContent(),
                message.getCreatedAt(),
                Boolean.TRUE.equals(message.getRequiresHumanReview()),
                assistantTurn && Boolean.TRUE.equals(message.getRequiresHumanReview()));
    }

    private static AiPendingActionResponse toResponse(AiPendingAction action) {
        return new AiPendingActionResponse(
                action.getId(),
                action.getActionType(),
                action.getStatus(),
                action.getDescription(),
                action.getCreatedAt(),
                action.getExpiresAt(),
                action.getResultMessage(),
                action.getResultEntityId());
    }

    @SuppressWarnings("unused")
    private static AiCapabilityResult unusedResultHolder(AiCapabilityResult result) {
        // Kept out of the controller surface on purpose; see class javadoc.
        return result;
    }
}
