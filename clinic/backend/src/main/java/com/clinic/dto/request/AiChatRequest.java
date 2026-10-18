package com.clinic.dto.request;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.util.Map;

/**
 * One question to the assistant.
 *
 * <p>What this deliberately does not accept: a role, a user id, a patient id
 * chosen by the client for a clinical capability, or free-form tool arguments
 * beyond the small validated set each capability understands. Everything
 * identity-bearing is resolved from the caller's token on the server.
 *
 * @param conversationId continue an existing conversation, or null to start one
 * @param capabilityId   which question to answer, from the server's allow-list
 * @param arguments      capability inputs; interpreted and validated server-side
 * @param message        the user's question
 */
public record AiChatRequest(

        @Size(max = 64, message = "Conversation id is not valid")
        String conversationId,

        @NotBlank(message = "A capability is required")
        @Size(max = 64, message = "Capability id is not valid")
        String capabilityId,

        /**
         * Bounded so the request body cannot be used to ship a payload to the
         * provider. Arguments are individual scalars; a deeply nested structure has
         * no legitimate use here.
         */
        @Size(max = 10, message = "Too many arguments")
        Map<String, Object> arguments,

        @NotBlank(message = "A question is required")
        @Size(max = 8000, message = "Your question is too long")
        String message
) {
}