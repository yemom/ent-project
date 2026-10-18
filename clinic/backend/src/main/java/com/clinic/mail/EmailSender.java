package com.clinic.mail;

/**
 * Provider-independent outbound email.
 *
 * <p>Business code depends on this, never on Spring's mail API, so the hospital
 * can move between an SMTP relay, a transactional provider, or an internal
 * gateway without touching the workflows that send mail.
 *
 * <h2>On {@link #isConfigured()}</h2>
 *
 * A deployment with no mail transport must fail loudly, not silently. Callers are
 * expected to check {@link #isConfigured()} <em>before</em> they generate a token,
 * a ticket number or any other one-time secret, and return a service-unavailable
 * response when it is {@code false}. Generating a credential the user can never
 * receive is worse than not offering the feature: the workflow looks configured
 * while quietly doing nothing.
 *
 * <p>Implementations must not log message bodies, which for this system include
 * password-reset tokens.
 */
public interface EmailSender {

    /**
     * Whether a transport is configured and the sender can reasonably expect
     * delivery to succeed.
     */
    boolean isConfigured();

    /**
     * Delivers the message.
     *
     * @throws MailDeliveryException if the transport accepted the connection but
     *                               could not deliver, e.g. an invalid recipient
     */
    void send(EmailMessage message);
}