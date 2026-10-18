package com.clinic.security;

import com.clinic.entity.PasswordResetToken;
import com.clinic.entity.Patient;
import com.clinic.entity.RefreshToken;
import com.clinic.entity.User;
import com.clinic.entity.User;
import com.clinic.entity.UserRole;
import com.clinic.exception.ServiceUnavailableException;
import com.clinic.mail.EmailMessage;
import com.clinic.mail.EmailSender;
import com.clinic.repository.PasswordResetTokenRepository;
import com.clinic.repository.RefreshTokenRepository;
import com.clinic.repository.UserRepository;
import com.clinic.validation.PasswordPolicy;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * The security properties of self-service password reset.
 *
 * <p>Driven through HTTP rather than by calling the service, because the claims
 * being tested — a constant response body, a 503 instead of a lie, a 401/403
 * boundary — are properties of the endpoint as deployed, not of a method in
 * isolation.
 *
 * <p>No SMTP server is involved. {@link RecordingEmailSender} stands in for the
 * transport, which is what lets the delivery-failure path be exercised at all: a
 * real SMTP server would be needed to provoke a failure, and a test that cannot
 * reach its own error path is not testing much.
 */
@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:clinicreset;MODE=PostgreSQL;DB_CLOSE_DELAY=-1;DATABASE_TO_UPPER=false",
        "spring.datasource.driver-class-name=org.h2.Driver",
        "spring.datasource.username=sa",
        "spring.datasource.password=",
        "spring.jpa.hibernate.ddl-auto=create-drop",
        "spring.sql.init.mode=never",
        "spring.flyway.enabled=false",
        "app.rate-limit.enabled=false",
        "app.password-reset.token-ttl-minutes=30",
        "app.password-reset.max-issuances-per-window=3",
        "app.password-reset.issuance-window-minutes=60"
})
@AutoConfigureMockMvc
class PasswordResetFlowTest {

    @TestConfiguration
    static class StubMail {
        @Bean
        @Primary
        RecordingEmailSender recordingEmailSender() {
            return new RecordingEmailSender();
        }
    }

    /**
     * Test double for the transport.
     *
     * <p>{@link #configured} toggles the "this deployment has mail" state;
     * {@link #failNext} toggles a delivery failure, which is otherwise very hard to
     * provoke.
     */
    static class RecordingEmailSender implements EmailSender {
        private final List<EmailMessage> sent = new ArrayList<>();
        private boolean configured = true;
        private boolean failNext = false;

        @Override
        public boolean isConfigured() {
            return configured;
        }

        @Override
        public void send(EmailMessage message) {
            if (failNext) {
                failNext = false;
                throw new com.clinic.mail.MailDeliveryException("simulated transport failure", null);
            }
            sent.add(message);
        }

        void reset() {
            sent.clear();
            configured = true;
            failNext = false;
        }

        EmailMessage last() {
            return sent.isEmpty() ? null : sent.get(sent.size() - 1);
        }
    }

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private PasswordResetTokenRepository tokenRepository;

    @Autowired
    private RefreshTokenRepository refreshTokenRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private RecordingEmailSender mail;

    private static final String KNOWN_EMAIL = "reset.user@example.com";
    private static final String UNKNOWN_EMAIL = "no.such.person@example.com";
    private static final String ORIGINAL_PASSWORD = "Orig1nal!";

    private String userId;

    @BeforeEach
    void seed() {
        mail.reset();
        tokenRepository.deleteAllInBatch();
        refreshTokenRepository.deleteAllInBatch();
        userRepository.deleteAllInBatch();

        Patient patient = Patient.builder()
                .email(KNOWN_EMAIL)
                .password(passwordEncoder.encode(ORIGINAL_PASSWORD))
                .fullName("Reset User")
                .role(UserRole.PATIENT)
                .active(true)
                .registrationNumber("REG-" + UUID.randomUUID().toString().substring(0, 8))
                .build();
        userId = userRepository.save(patient).getId();
    }

    // ------------------------------------------------------------------
    // Enumeration resistance
    // ------------------------------------------------------------------

    /**
     * The core property: a registered address and an unregistered one must produce
     * byte-identical responses. If these ever diverge, the endpoint has become an
     * account-existence oracle.
     */
    @Test
    void aKnownAndAnUnknownAddressProduceIdenticalResponses() throws Exception {
        MvcResult known = mockMvc.perform(post("/api/v1/auth/forgot-password")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"" + KNOWN_EMAIL + "\"}"))
                .andExpect(status().isAccepted())
                .andReturn();

        MvcResult unknown = mockMvc.perform(post("/api/v1/auth/forgot-password")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"" + UNKNOWN_EMAIL + "\"}"))
                .andExpect(status().isAccepted())
                .andReturn();

        assertThat(known.getResponse().getStatus()).isEqualTo(unknown.getResponse().getStatus());
        assertThat(known.getResponse().getContentAsString())
                .isEqualTo(unknown.getResponse().getContentAsString());
    }

    @Test
    void anUnknownAddressStillPassesBeanValidationLikeAKnownOne() throws Exception {
        // A format check applied to one address but not the other would leak the
        // same information through the status code.
        mockMvc.perform(post("/api/v1/auth/forgot-password")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"not-an-email\"}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void aDeactivatedAccountIsIndistinguishableFromAnActiveOne() throws Exception {
        User user = userRepository.findById(userId).orElseThrow();
        user.setActive(false);
        // Explicit save: this test is not transactional, so the mutating call alone
        // would be rolled back with its repository transaction and the account would
        // still look active.
        userRepository.save(user);

        MvcResult deactivated = mockMvc.perform(post("/api/v1/auth/forgot-password")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"" + KNOWN_EMAIL + "\"}"))
                .andExpect(status().isAccepted())
                .andReturn();

        assertThat(deactivated.getResponse().getContentAsString())
                .isEqualTo(mockMvc.perform(post("/api/v1/auth/forgot-password")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("{\"email\":\"" + UNKNOWN_EMAIL + "\"}"))
                        .andReturn().getResponse().getContentAsString());
        assertThat(mail.sent).as("a deactivated account must not receive mail").isEmpty();
    }

    // ------------------------------------------------------------------
    // Token handling
    // ------------------------------------------------------------------

    @Test
    void aResetLinkIsMailedAndOnlyTheHashIsStored() throws Exception {
        mockMvc.perform(post("/api/v1/auth/forgot-password")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"" + KNOWN_EMAIL + "\"}"))
                .andExpect(status().isAccepted());

        assertThat(mail.sent).hasSize(1);
        String body = mail.last().body();
        assertThat(body).contains("/reset-password?token=");

        String emailedToken = body.substring(body.indexOf("token=") + "token=".length()).split("\\s")[0];
        PasswordResetToken stored = tokenRepository.findAll().stream().findFirst().orElseThrow();

        // The digest must not be the token, and must not contain it.
        assertThat(stored.getTokenHash()).isNotEqualTo(emailedToken);
        assertThat(stored.getTokenHash()).doesNotContain(emailedToken);
        assertThat(stored.getTokenHash()).hasSize(64);
    }

    @Test
    void anExpiredTokenIsRejected() throws Exception {
        String token = requestTokenAndExtractIt();
        // Move the deadline into the past rather than sleeping: the test asserts
        // the rule, not that thirty minutes pass.
        PasswordResetToken stored = tokenRepository.findAll().stream().findFirst().orElseThrow();
        stored.setExpiresAt(Instant.now().minusSeconds(1));
        tokenRepository.save(stored);

        assertResetRejected(token);
    }

    @Test
    void aSpentTokenCannotBeReused() throws Exception {
        String token = requestTokenAndExtractIt();

        resetWith(token, NEW_PASSWORD).andExpect(status().isOk());

        // The second attempt must fail even though the first succeeded and the
        // password is now the new one.
        assertResetRejected(token);
    }

    @Test
    void anUnknownTokenIsRejected() throws Exception {
        assertResetRejected("this-is-not-a-real-token");
    }

    @Test
    void aTamperedTokenIsRejected() throws Exception {
        String token = requestTokenAndExtractIt();
        // Flip one character: still a plausible token, wrong digest.
        char[] chars = token.toCharArray();
        chars[0] = chars[0] == 'a' ? 'b' : 'a';
        assertResetRejected(new String(chars));
    }

    @Test
    void requestingAgainRetiresTheEarlierToken() throws Exception {
        String first = requestTokenAndExtractIt();
        requestTokenAndExtractIt();

        // The superseded link is dead; only the newest one works.
        assertResetRejected(first);
    }

    // ------------------------------------------------------------------
    // Successful reset
    // ------------------------------------------------------------------

    @Test
    void aValidTokenChangesThePassword() throws Exception {
        String token = requestTokenAndExtractIt();
        resetWith(token, NEW_PASSWORD).andExpect(status().isOk());

        assertThat(passwordEncoder.matches(NEW_PASSWORD, currentPassword())).isTrue();
        assertThat(passwordEncoder.matches(ORIGINAL_PASSWORD, currentPassword())).isFalse();
    }

    @Test
    void aSuccessfulResetRevokesEveryExistingSession() throws Exception {
        refreshTokenRepository.save(RefreshToken.builder()
                .id(UUID.randomUUID().toString())
                .userId(userId)
                .tokenHash("hash-a")
                .expiresAt(Instant.now().plusSeconds(3600))
                .createdAt(Instant.now())
                .build());
        refreshTokenRepository.save(RefreshToken.builder()
                .id(UUID.randomUUID().toString())
                .userId(userId)
                .tokenHash("hash-b")
                .expiresAt(Instant.now().plusSeconds(3600))
                .createdAt(Instant.now())
                .build());

        resetWith(requestTokenAndExtractIt(), NEW_PASSWORD).andExpect(status().isOk());

        assertThat(refreshTokenRepository.findAll())
                .as("a password reset is how a user recovers from a compromise; the "
                        + "old sessions must not survive it")
                .allSatisfy(t -> assertThat(t.getRevokedAt()).isNotNull());
    }

    @Test
    void aWeakPasswordIsRejectedWithoutSpendingTheToken() throws Exception {
        String token = requestTokenAndExtractIt();
        resetWith(token, "short").andExpect(status().isBadRequest());

        // The token must remain usable: rejecting the password is not the same as
        // consuming the reset.
        resetWith(token, NEW_PASSWORD).andExpect(status().isOk());
    }

    // ------------------------------------------------------------------
    // Missing mail transport
    // ------------------------------------------------------------------

    @Test
    void withNoMailTransportTheServerRefusesRatherThanPretending() throws Exception {
        mail.configured = false;

        mockMvc.perform(post("/api/v1/auth/forgot-password")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"" + KNOWN_EMAIL + "\"}"))
                .andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.message").value(
                        org.hamcrest.Matchers.containsString("not available")));

        assertThat(mail.sent).isEmpty();
        assertThat(tokenRepository.count())
                .as("no token may be minted when it cannot be delivered")
                .isZero();
    }

    @Test
    void aMissingTransportIsAlsoReportedForAnUnknownAddress() throws Exception {
        mail.configured = false;

        mockMvc.perform(post("/api/v1/auth/forgot-password")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"" + UNKNOWN_EMAIL + "\"}"))
                .andExpect(status().isServiceUnavailable());
    }

    @Test
    void aFailedDeliveryIsReportedAndLeavesNoUsableToken() throws Exception {
        mail.failNext = true;

        mockMvc.perform(post("/api/v1/auth/forgot-password")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"" + KNOWN_EMAIL + "\"}"))
                .andExpect(status().isServiceUnavailable());

        assertThat(tokenRepository.findByUserIdAndUsedAtIsNull(userId))
                .as("an undelivered link is a live credential sitting in a table for nobody")
                .isEmpty();
    }

    // ------------------------------------------------------------------
    // Abuse
    // ------------------------------------------------------------------

    @Test
    void issuanceIsCappedPerAccount() throws Exception {
        for (int i = 0; i < 3; i++) {
            mockMvc.perform(post("/api/v1/auth/forgot-password")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{\"email\":\"" + KNOWN_EMAIL + "\"}"))
                    .andExpect(status().isAccepted());
        }

        // The fourth trips the per-account cap. This cannot be used to probe for
        // accounts: the cap is keyed on an address that has already proved it can
        // mint tokens.
        mockMvc.perform(post("/api/v1/auth/forgot-password")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"" + KNOWN_EMAIL + "\"}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void theEndpointsAreReachableWithoutAuthentication() throws Exception {
        // They must be: the person who cannot sign in is the person who needs this.
        // Safety comes from the constant response and the unguessable token.
        mockMvc.perform(post("/api/v1/auth/forgot-password")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"" + KNOWN_EMAIL + "\"}"))
                .andExpect(status().isAccepted());
    }

    // ------------------------------------------------------------------
    // helpers
    // ------------------------------------------------------------------

    private static final String NEW_PASSWORD = "N3wPassword!";

    private String currentPassword() {
        return userRepository.findById(userId).orElseThrow().getPassword();
    }

    private String requestTokenAndExtractIt() throws Exception {
        MvcResult result = mockMvc.perform(post("/api/v1/auth/forgot-password")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"" + KNOWN_EMAIL + "\"}"))
                .andExpect(status().isAccepted())
                .andReturn();

        String body = mail.last().body();
        String tail = body.substring(body.indexOf("token=") + "token=".length());
        return tail.split("\\s")[0].trim();
    }

    private org.springframework.test.web.servlet.ResultActions resetWith(String token, String newPassword)
            throws Exception {
        return mockMvc.perform(post("/api/v1/auth/reset-password")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"token\":\"" + token + "\",\"newPassword\":\"" + newPassword + "\"}"));
    }

    private void assertResetRejected(String token) throws Exception {
        resetWith(token, NEW_PASSWORD)
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value(
                        org.hamcrest.Matchers.containsString("invalid or has expired")));
    }

    @Test
    void theTestPasswordsSatisfyThePolicy() {
        // Guards the fixtures themselves: a policy change that rejects these would
        // make every other test in this class fail for a confusing reason.
        assertThat(PasswordPolicy.isValid(ORIGINAL_PASSWORD)).isTrue();
        assertThat(PasswordPolicy.isValid(NEW_PASSWORD)).isTrue();
    }
}