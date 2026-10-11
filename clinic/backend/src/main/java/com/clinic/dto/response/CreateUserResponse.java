package com.clinic.dto.response;

/**
 * Result of creating an account.
 *
 * <p>{@code generatedPassword} is populated only when the caller did not supply one.
 * It is returned exactly once, in this response, and never stored in plain text —
 * so it is the single chance to hand the credential over.
 *
 * <p>On a later read of the same user this field is always null, which is what
 * makes the "shown once" guarantee hold rather than being a promise in a comment.
 */
public record CreateUserResponse(
        UserResponse user,
        String generatedPassword
) {
    public static CreateUserResponse of(UserResponse user) {
        return new CreateUserResponse(user, null);
    }

    public static CreateUserResponse withGeneratedPassword(UserResponse user, String password) {
        return new CreateUserResponse(user, password);
    }
}