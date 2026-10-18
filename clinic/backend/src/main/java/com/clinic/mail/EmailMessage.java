package com.clinic.mail;

/**
 * A message to deliver.
 *
 * <p>Deliberately plain text only. Password-reset mail is read by people and by
 * clients that strip images, and no hospital system sends sensitive clinical
 * content through this interface today; adding an HTML part later should be a
 * deliberate change, not an accident of the sender implementation.
 *
 * @param to      recipient address
 * @param subject subject line, never {@code null}
 * @param body    plain-text body, never {@code null}
 */
public record EmailMessage(String to, String subject, String body) {
}