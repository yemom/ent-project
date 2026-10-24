package com.clinic.mail;

import com.clinic.config.MailProperties;
import lombok.extern.slf4j.Slf4j;
import org.springframework.mail.MailException;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Component;

/**
 * SMTP transport.
 *
 * <p>Configured entirely from the environment, so the same build runs against a
 * local relay, a hospital mail gateway, or a transactional provider's SMTP API
 * without a code change. See {@code MAIL_*} in the backend README.
 *
 * <p>Failure handling: a {@code MailException} is translated into
 * {@link MailDeliveryException} so callers above this layer never see a Spring
 * mail type. The underlying cause's message can contain the recipient address, so
 * it is logged at warn with the exception only — never the message body, which for
 * password reset contains the token.
 */
@Component
@Slf4j
public class SmtpEmailSender implements EmailSender {

    private final JavaMailSender mailSender;
    private final MailProperties properties;

    public SmtpEmailSender(JavaMailSender mailSender, MailProperties properties) {
        this.mailSender = mailSender;
        this.properties = properties;
    }

    @Override
    public boolean isConfigured() {
        return properties.getHost() != null && !properties.getHost().isBlank();
    }

    @Override
    public void send(EmailMessage message) {
        if (!isConfigured()) {
            // Defence in depth: callers are expected to check first, and a token
            // that silently never arrives is indistinguishable from a broken reset.
            throw new IllegalStateException(
                    "MAIL_HOST is not configured; refusing to send mail that the user will never receive");
        }

        SimpleMailMessage mail = new SimpleMailMessage();
        mail.setFrom(properties.getFrom());
        mail.setTo(message.to());
        mail.setSubject(message.subject());
        mail.setText(message.body());

        try {
            mailSender.send(mail);
        } catch (MailException ex) {
            log.warn("Email delivery failed via SMTP host={} port={} errorType={}",
                    properties.getHost(), properties.getPort(), ex.getClass().getSimpleName());
            throw new MailDeliveryException("The email could not be delivered", ex);
        }
    }
}