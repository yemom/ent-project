package com.clinic.ai;

import java.util.List;

/**
 * What the orchestration layer asks a provider to do.
 *
 * <p>Deliberately a single {@code chat} call rather than a generic "do anything"
 * request. The orchestrator decides what the model is allowed to see and what it
 * is allowed to do; the provider only turns an authorised message list into text.
 *
 * @param model       model identifier to use
 * @param messages    system prompt first, then the conversation
 * @param maxOutTokens cap on generated tokens
 */
public record AiProviderRequest(String model, List<AiPromptMessage> messages, int maxOutTokens) {
}