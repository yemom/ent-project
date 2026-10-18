package com.clinic.ai;

/**
 * A provider's reply.
 *
 * <p>Only the text and the usage counters are carried out. Anything else the
 * provider returns — reasoning traces, tool fragments, provider-specific blocks —
 * is discarded at this boundary so it cannot reach a browser or a log.
 *
 * @param text         the generated text
 * @param promptTokens tokens consumed by the prompt, or {@code null} if unreported
 * @param outputTokens tokens generated, or {@code null} if unreported
 * @param model        the model that actually served the request, as reported back
 */
public record AiProviderResponse(String text, Integer promptTokens, Integer outputTokens, String model) {
}