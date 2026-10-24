package com.clinic.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import org.springframework.stereotype.Component;

/**
 * Outbound email configuration.
 *
 * <p>Bound to {@code app.mail.*}. Every value comes from the environment so no
 * credential is ever committed. The absence of {@code MAIL_HOST} is a supported,
 * meaningful state: it means "this deployment cannot send mail", which the
 * password-reset endpoints report as a service-unavailable response instead of
 * pretending to have sent a message.
 */
@Component
@ConfigurationProperties(prefix = "app.mail")
@Validated
public class MailProperties {

    /** SMTP host. Blank or unset means no transport is configured. */
    private String host;

    @Min(1)
    @Max(65535)
    private int port = 587;

    private String username;

    private String password;

    /** Sender address, e.g. {@code no-reply@clinic.example}. */
    private String from = "no-reply@clinic.local";

    /** STARTTLS on a submission port such as 587. */
    private boolean startTls = true;

    /** Implicit TLS, typically used on a provider's dedicated TLS port. */
    private boolean sslEnable = false;

    /** Seconds to wait for the SMTP connection before giving up. */
    @Min(1)
    private int connectionTimeoutSeconds = 10;

    /** Seconds to wait for the SMTP conversation before giving up. */
    @Min(1)
    private int timeoutSeconds = 10;

    /** Seconds to wait while writing SMTP commands before giving up. */
    @Min(1)
    private int writeTimeoutSeconds = 10;

    public String getHost() {
        return host;
    }

    public void setHost(String host) {
        this.host = host;
    }

    public int getPort() {
        return port;
    }

    public void setPort(int port) {
        this.port = port;
    }

    public String getUsername() {
        return username;
    }

    public void setUsername(String username) {
        this.username = username;
    }

    public String getPassword() {
        return password;
    }

    public void setPassword(String password) {
        this.password = password;
    }

    public String getFrom() {
        return from;
    }

    public void setFrom(String from) {
        this.from = from;
    }

    public boolean isStartTls() {
        return startTls;
    }

    public void setStartTls(boolean startTls) {
        this.startTls = startTls;
    }

    public boolean isSslEnable() {
        return sslEnable;
    }

    public void setSslEnable(boolean sslEnable) {
        this.sslEnable = sslEnable;
    }

    public int getConnectionTimeoutSeconds() {
        return connectionTimeoutSeconds;
    }

    public void setConnectionTimeoutSeconds(int connectionTimeoutSeconds) {
        this.connectionTimeoutSeconds = connectionTimeoutSeconds;
    }

    public int getTimeoutSeconds() {
        return timeoutSeconds;
    }

    public void setTimeoutSeconds(int timeoutSeconds) {
        this.timeoutSeconds = timeoutSeconds;
    }

    public int getWriteTimeoutSeconds() {
        return writeTimeoutSeconds;
    }

    public void setWriteTimeoutSeconds(int writeTimeoutSeconds) {
        this.writeTimeoutSeconds = writeTimeoutSeconds;
    }
}