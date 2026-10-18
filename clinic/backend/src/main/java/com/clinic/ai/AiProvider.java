package com.clinic.ai;

/**
 * A configured AI backend.
 *
 * <p>The hospital chooses which provider serves its prompts without any business
 * code changing: {@code AI_PROVIDER} selects an implementation, and the
 * orchestration layer above only ever sees this interface.
 *
 * <p>Implementations must not write prompts, completions or credentials to logs.
 */
public interface AiProvider {

    /** Identifies the implementation, e.g. {@code openai-compatible}. */
    String name();

    /**
     * Whether this provider can currently serve a request.
     *
     * <p>Checked before any token is minted so the system reports "AI is not
     * configured" rather than failing mid-request.
     */
    boolean isAvailable();

    /**
     * Generates a completion.
     *
     * @throws AiProviderException on timeout, provider error or an unparseable reply
     */
    AiProviderResponse chat(AiProviderRequest request);
}