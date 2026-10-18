package com.clinic.mail;

/**
 * The transport accepted the message but could not deliver it.
 *
 * <p>Separated from the framework's own exception types so business code can react
 * to a genuine delivery failure without importing {@code jakarta.mail} or
 * {@code org.springframework.mail}.
 */
public class MailDeliveryException extends RuntimeException {

    public MailDeliveryException(String message, Throwable cause) {
        super(message, cause);
    }
}