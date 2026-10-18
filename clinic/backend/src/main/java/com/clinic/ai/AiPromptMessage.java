package com.clinic.ai;

/**
 * One turn in a conversation.
 *
 * <p>The {@code role} is constrained here rather than by convention because these
 * values are written straight into a provider request body. Accepting an arbitrary
 * string would let a caller smuggle in a role the provider does not expect.
 *
 * @param role    {@code system}, {@code user} or {@code assistant}
 * @param content the turn's text; never {@code null}
 */
public record AiPromptMessage(String role, String content) {

    public static final String ROLE_SYSTEM = "system";
    public static final String ROLE_USER = "user";
    public static final String ROLE_ASSISTANT = "assistant";

    private static final java.util.Set<String> ROLES =
            java.util.Set.of(ROLE_SYSTEM, ROLE_USER, ROLE_ASSISTANT);

    public AiPromptMessage {
        if (role == null || !ROLES.contains(role)) {
            throw new IllegalArgumentException("Unsupported AI message role: " + role);
        }
        if (content == null) {
            throw new IllegalArgumentException("AI message content must not be null");
        }
    }

    public static AiPromptMessage system(String content) {
        return new AiPromptMessage(ROLE_SYSTEM, content);
    }

    public static AiPromptMessage user(String content) {
        return new AiPromptMessage(ROLE_USER, content);
    }

    public static AiPromptMessage assistant(String content) {
        return new AiPromptMessage(ROLE_ASSISTANT, content);
    }
}