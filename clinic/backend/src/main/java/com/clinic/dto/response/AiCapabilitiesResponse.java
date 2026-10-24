package com.clinic.dto.response;

import java.util.List;
import java.util.Map;

/**
 * What the assistant can do for the caller right now.
 *
 * <p>Computed from the caller's live permissions, so the list a patient sees and the
 * list a cashier sees are genuinely different. The frontend uses it to build its
 * suggested questions and to decide whether to render the panel at all.
 */
public record AiCapabilitiesResponse(

        boolean available,
        boolean enabled,
        boolean providerConfigured,
        String provider,
        /** Present when {@code available} is false, and safe to show to a user. */
        String unavailableReason,
        List<Capability> capabilities
) {

    /**
     * @param id                   machine-readable, sent back as {@code capabilityId}
     * @param label                short human title
     * @param description          what the question is answered from
     * @param suggestedQuestion    a ready-made question the UI can offer
     * @param requiresHumanReview  whether answers must be reviewed before use
     * @param requiredArguments    argument names the caller must supply before the
     *                            capability can answer, with a human prompt for each.
     *                            Declared by the server so the UI renders the right
     *                            input instead of hard-coding which capabilities
     *                            need one — which silently drifts.
     */
    public record Capability(
            String id,
            String label,
            String description,
            String suggestedQuestion,
            boolean requiresHumanReview,
            List<RequiredArgument> requiredArguments
    ) {
    }

    /**
     * One argument a capability cannot proceed without.
     *
     * @param name   the key the frontend sends back in {@code arguments}
     * @param prompt what to ask the user for, phrased so they know what will happen
     */
    public record RequiredArgument(String name, String prompt) {
    }

    public static AiCapabilitiesResponse unavailable(String reason, String provider) {
        return new AiCapabilitiesResponse(false, false, false, provider, reason, List.of());
    }
}