package com.clinic.exception;

import org.springframework.security.access.AccessDeniedException;

/**
 * Convenience subclass used where the caller is authenticated but not allowed.
 * Mapped to 403 by {@link GlobalExceptionHandler}.
 */
public class ForbiddenException extends AccessDeniedException {
    public ForbiddenException(String message) {
        super(message);
    }
}