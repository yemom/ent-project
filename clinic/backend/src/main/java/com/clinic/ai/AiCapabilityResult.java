package com.clinic.ai;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

/**
 * The facts one capability produced, and where they came from.
 *
 * <p>Everything a prompt is built from. The model sees {@link #facts()} and
 * nothing else — not the query, not the entity graph, not a patient record
 * fetched on its behalf. What it cannot see, it cannot leak.
 *
 * @param facts                  the computed values, already serialised to primitives
 * @param sources                references the caller may verify against, e.g. module and date range
 * @param computedAt             when these numbers were computed, shown to the user as freshness
 * @param containsIdentifiableData whether any free-text clinical content is included
 * @param empty                  true when the query ran successfully and matched nothing
 */
public record AiCapabilityResult(
        Map<String, Object> facts,
        List<String> sources,
        LocalDateTime computedAt,
        boolean containsIdentifiableData,
        boolean empty
) {

    public static AiCapabilityResult of(Map<String, Object> facts,
                                        List<String> sources,
                                        boolean containsIdentifiableData) {
        return new AiCapabilityResult(facts, sources, LocalDateTime.now(),
                containsIdentifiableData, isEmpty(facts));
    }

    public static AiCapabilityResult emptyResult(String source) {
        return new AiCapabilityResult(
                Map.of("result", "No records matched this request."),
                List.of(source),
                LocalDateTime.now(),
                false,
                true);
    }

    /**
     * Whether the fact set carries nothing to say.
     *
     * <p>Checks every value rather than just the map size: a capability that
     * legitimately returns {@code {"cancelledAppointments": 0}} is still a real
     * answer, and the model should say "none" rather than "I could not find that".
     */
    private static boolean isEmpty(Map<String, Object> facts) {
        if (facts == null || facts.isEmpty()) {
            return true;
        }
        for (Object value : facts.values()) {
            if (value == null) {
                continue;
            }
            if (value instanceof Number number && number.longValue() != 0L) {
                return false;
            }
            if (value instanceof CharSequence text && !text.toString().isBlank()) {
                return false;
            }
            if (value instanceof java.util.Collection<?> collection && !collection.isEmpty()) {
                return false;
            }
            if (value instanceof Map<?, ?> map && !map.isEmpty()) {
                return false;
            }
            if (value instanceof Boolean flag && flag) {
                return false;
            }
        }
        return true;
    }
}