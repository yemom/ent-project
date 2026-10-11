package com.clinic.exception;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.ResponseStatus;

/**
 * The request was well-formed but conflicts with existing state — a duplicate
 * email, a code already taken.
 *
 * <p>Distinct from {@link BadRequestException} because the two mean different
 * things to a form: a 400 is "you filled this in wrong", a 409 is "someone else
 * got there first". Mapping both to 400 would make a duplicate email look like a
 * validation slip and send the user off fixing fields that are already correct.
 */
@ResponseStatus(HttpStatus.CONFLICT)
public class ConflictException extends RuntimeException {

    public ConflictException(String message) {
        super(message);
    }
}