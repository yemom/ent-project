package com.clinic.config;

import com.clinic.mail.EmailSender;
import com.clinic.mail.SmtpEmailSender;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.mail.javamail.JavaMailSenderImpl;

import java.util.Properties;

/**
 * Builds the SMTP client from {@link MailProperties}.
 *
 * <p>Spring Boot's own mail auto-configuration is bypassed deliberately: the
 * project uses a single {@code app.mail.*} namespace rather than mixing
 * {@code spring.mail.*} (transport) with {@code app.mail.from} (sender identity).
 * One namespace means one place to document and one place to misconfigure.
 *
 * <p>The bean is constructed unconditionally, including when no host is set, so
 * that wiring failures surface at startup rather than at the first password reset
 * in production. {@link SmtpEmailSender#isConfigured()} is what reports the
 * absence, and the reset workflow checks it before issuing a token.
 */
@Configuration
public class MailConfig {

    @Bean
    @ConditionalOnMissingBean(JavaMailSenderImpl.class)
    public JavaMailSenderImpl mailSender(MailProperties properties) {
        JavaMailSenderImpl sender = new JavaMailSenderImpl();
        sender.setHost(properties.getHost());
        sender.setPort(properties.getPort());
        sender.setUsername(properties.getUsername());
        sender.setPassword(properties.getPassword());

        Properties jvmProps = new Properties();
        jvmProps.put("mail.transport.protocol", "smtp");
        if (properties.isStartTls()) {
            jvmProps.put("mail.smtp.starttls.enable", "true");
            // Refuse to downgrade rather than silently send a reset token in clear.
            jvmProps.put("mail.smtp.starttls.required", "true");
        }
        jvmProps.put("mail.smtp.connectiontimeout", String.valueOf(properties.getConnectionTimeoutSeconds() * 1000));
        jvmProps.put("mail.smtp.timeout", String.valueOf(properties.getTimeoutSeconds() * 1000));
        // One connection per send: the volume here is a handful of requests an
        // hour, and a shared pool would outlive a credential rotation.
        jvmProps.put("mail.smtp.connectionpool", "false");
        sender.setJavaMailProperties(jvmProps);
        return sender;
    }

    @Bean
    @ConditionalOnMissingBean(EmailSender.class)
    public EmailSender emailSender(org.springframework.mail.javamail.JavaMailSenderImpl mailSender,
                                   MailProperties properties) {
        return new SmtpEmailSender(mailSender, properties);
    }
}