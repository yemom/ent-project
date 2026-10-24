package com.clinic.mail;

import com.clinic.config.MailProperties;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.Timeout;
import org.springframework.mail.javamail.JavaMailSenderImpl;

import java.io.BufferedReader;
import java.io.BufferedWriter;
import java.io.IOException;
import java.io.InputStreamReader;
import java.io.OutputStreamWriter;
import java.net.ServerSocket;
import java.net.Socket;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class SmtpEmailSenderTest {

    @Test
    void missingHostIsReportedAsInvalidConfiguration() {
        MailProperties properties = properties();
        properties.setHost(" ");
        SmtpEmailSender sender = new SmtpEmailSender(new JavaMailSenderImpl(), properties);

        assertThat(sender.isConfigured()).isFalse();
        assertThatThrownBy(() -> sender.send(message()))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("MAIL_HOST");
    }

    @Test
    void connectionRefusalIsTranslatedWithoutExposingMessageContent() throws IOException {
        int port;
        try (ServerSocket socket = new ServerSocket(0)) {
            port = socket.getLocalPort();
        }

        MailProperties properties = properties();
        properties.setPort(port);
        SmtpEmailSender sender = new SmtpEmailSender(javaMailSender(properties), properties);

        assertThatThrownBy(() -> sender.send(message()))
                .isInstanceOf(MailDeliveryException.class)
                .hasMessage("The email could not be delivered");
    }

    @Test
    @Timeout(value = 5)
    void serverThatNeverAnswersIsBoundedByReadTimeout() throws Exception {
        try (SilentSmtpServer server = new SilentSmtpServer()) {
            MailProperties properties = properties();
            properties.setPort(server.port());
            properties.setConnectionTimeoutSeconds(1);
            properties.setTimeoutSeconds(1);
            properties.setWriteTimeoutSeconds(1);
            SmtpEmailSender sender = new SmtpEmailSender(javaMailSender(properties), properties);

            assertThatThrownBy(() -> sender.send(message()))
                    .isInstanceOf(MailDeliveryException.class);
        }
    }

    @Test
    void controlledSmtpServerAcceptsDelivery() throws Exception {
        try (ControlledSmtpServer server = new ControlledSmtpServer()) {
            MailProperties properties = properties();
            properties.setPort(server.port());
            SmtpEmailSender sender = new SmtpEmailSender(javaMailSender(properties), properties);

            sender.send(message());

            assertThat(server.message()).contains("reset-token-is-not-logged");
        }
    }

    private static EmailMessage message() {
        return new EmailMessage("recipient@example.com", "Reset", "reset-token-is-not-logged");
    }

    private static MailProperties properties() {
        MailProperties properties = new MailProperties();
        properties.setHost("127.0.0.1");
        properties.setPort(2525);
        properties.setFrom("no-reply@example.com");
        properties.setStartTls(false);
        properties.setUsername("");
        properties.setPassword("");
        properties.setConnectionTimeoutSeconds(1);
        properties.setTimeoutSeconds(1);
        properties.setWriteTimeoutSeconds(1);
        return properties;
    }

    private static JavaMailSenderImpl javaMailSender(MailProperties properties) {
        JavaMailSenderImpl sender = new JavaMailSenderImpl();
        sender.setHost(properties.getHost());
        sender.setPort(properties.getPort());
        sender.setUsername(properties.getUsername());
        sender.setPassword(properties.getPassword());
        java.util.Properties javaMail = new java.util.Properties();
        javaMail.setProperty("mail.smtp.auth", "false");
        javaMail.setProperty("mail.smtp.connectiontimeout",
                String.valueOf(properties.getConnectionTimeoutSeconds() * 1000));
        javaMail.setProperty("mail.smtp.timeout",
                String.valueOf(properties.getTimeoutSeconds() * 1000));
        javaMail.setProperty("mail.smtp.writetimeout",
                String.valueOf(properties.getWriteTimeoutSeconds() * 1000));
        sender.setJavaMailProperties(javaMail);
        return sender;
    }

    private static class SilentSmtpServer implements AutoCloseable {
        private final ServerSocket serverSocket = new ServerSocket(0);
        private final Thread thread;

        private SilentSmtpServer() throws IOException {
            thread = new Thread(() -> {
                try (Socket ignored = serverSocket.accept()) {
                    Thread.sleep(2_000);
                } catch (Exception ignored) {
                    // Test teardown closes the socket.
                }
            });
            thread.start();
        }

        int port() {
            return serverSocket.getLocalPort();
        }

        @Override
        public void close() throws IOException {
            serverSocket.close();
        }
    }

    private static class ControlledSmtpServer implements AutoCloseable {
        private final ServerSocket serverSocket = new ServerSocket(0);
        private final Thread thread;
        private final CountDownLatch completed = new CountDownLatch(1);
        private volatile String message = "";

        private ControlledSmtpServer() throws IOException {
            thread = new Thread(this::serve);
            thread.start();
        }

        int port() {
            return serverSocket.getLocalPort();
        }

        String message() throws InterruptedException {
            assertThat(completed.await(3, TimeUnit.SECONDS)).isTrue();
            return message;
        }

        private void serve() {
            try (Socket socket = serverSocket.accept();
                 BufferedReader reader = new BufferedReader(
                         new InputStreamReader(socket.getInputStream(), StandardCharsets.US_ASCII));
                 BufferedWriter writer = new BufferedWriter(
                         new OutputStreamWriter(socket.getOutputStream(), StandardCharsets.US_ASCII))) {
                reply(writer, "220 controlled.smtp ESMTP");
                StringBuilder data = new StringBuilder();
                String line;
                while ((line = reader.readLine()) != null) {
                    if (line.startsWith("EHLO") || line.startsWith("HELO")) {
                        reply(writer, "250-controlled.smtp");
                        reply(writer, "250 8BITMIME");
                    } else if (line.startsWith("MAIL FROM") || line.startsWith("RCPT TO")) {
                        reply(writer, "250 OK");
                    } else if (line.equals("DATA")) {
                        reply(writer, "354 End data with <CR><LF>.<CR><LF>");
                        while ((line = reader.readLine()) != null && !line.equals(".")) {
                            data.append(line).append('\n');
                        }
                        message = data.toString();
                        reply(writer, "250 Accepted");
                    } else if (line.equals("QUIT")) {
                        reply(writer, "221 Bye");
                        return;
                    } else {
                        reply(writer, "250 OK");
                    }
                }
            } catch (IOException ignored) {
                // The assertion observes completion or the client failure.
            } finally {
                completed.countDown();
            }
        }

        private static void reply(BufferedWriter writer, String response) throws IOException {
            writer.write(response);
            writer.write("\r\n");
            writer.flush();
        }

        @Override
        public void close() throws IOException, InterruptedException {
            serverSocket.close();
            thread.join(3_000);
        }
    }
}
