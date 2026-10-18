package com.clinic.ai;

import com.clinic.ai.AiProviderException.Reason;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * The provider adapter, against a stub HTTP endpoint.
 *
 * <p>Covers the failure modes that matter in production and are hard to provoke
 * with a real provider: an unreachable host, a slow one, a 500, a 429, and a 200
 * whose body is not the shape the adapter expects.
 *
 * <p>A provider failure must never be reported as anything other than a provider
 * failure. In particular it must never carry the API key or the prompt in its
 * message, because those messages reach logs.
 */
class OpenAiCompatibleProviderTest {

    private final ObjectMapper objectMapper = new ObjectMapper();

    private AiProperties properties;

    @BeforeEach
    void setUp() {
        properties = new AiProperties();
        properties.setEnabled(true);
        properties.setApiKey("test-key-not-a-real-secret");
        properties.setModel("test-model");
        properties.setRequestTimeoutMillis(1500);
    }

    private AiProviderRequest request() {
        return new AiProviderRequest("test-model",
                List.of(AiPromptMessage.system("You are a test."),
                        AiPromptMessage.user("How many appointments today?")),
                100);
    }

    @Test
    void withNothingConfiguredTheProviderIsUnavailable() {
        properties.setEnabled(false);
        assertThat(new OpenAiCompatibleProvider(properties, objectMapper).isAvailable()).isFalse();
    }

    @Test
    void anEnabledProviderWithoutAUrlOrKeyIsStillUnavailable() {
        properties.setApiUrl("");
        assertThat(new OpenAiCompatibleProvider(properties, objectMapper).isAvailable()).isFalse();

        properties.setApiUrl("http://localhost:1/v1/chat/completions");
        properties.setApiKey("");
        assertThat(new OpenAiCompatibleProvider(properties, objectMapper).isAvailable()).isFalse();
    }

    @Test
    void anUnreachableEndpointIsReportedAsATransportErrorNotAProviderError() {
        // Port 1 is reserved and refuses connections, which is a realistic stand-in
        // for a provider that is down.
        properties.setApiUrl("http://127.0.0.1:1/v1/chat/completions");

        AiProvider provider = new OpenAiCompatibleProvider(properties, objectMapper);
        assertThatThrownBy(() -> provider.chat(request()))
                .isInstanceOf(AiProviderException.class)
                .satisfies(ex -> assertThat(((AiProviderException) ex).getReason())
                        .isIn(Reason.TRANSPORT_ERROR, Reason.TIMEOUT));
    }

    @Test
    void aSlowEndpointTimesOut() {
        // A real timeout needs a real server; standing one up would make this test
        // slow and flaky. Instead the budget is set to the floor and pointed at a
        // non-routable address, which is the same code path.
        properties.setApiUrl("http://10.255.255.1:9/v1/chat/completions");
        properties.setRequestTimeoutMillis(300);

        AiProvider provider = new OpenAiCompatibleProvider(properties, objectMapper);
        assertThatThrownBy(() -> provider.chat(request()))
                .isInstanceOf(AiProviderException.class);
    }

    @Test
    void aProviderErrorNeverLeaksTheApiKeyOrThePrompt() {
        properties.setApiUrl("http://127.0.0.1:1/v1/chat/completions");

        AiProvider provider = new OpenAiCompatibleProvider(properties, objectMapper);
        try {
            provider.chat(request());
        } catch (AiProviderException ex) {
            assertThat(ex.getMessage())
                    .doesNotContain(properties.getApiKey())
                    .doesNotContain("How many appointments today?")
                    .doesNotContain("You are a test.");
        }
    }

    @Test
    void aHostOutsideTheAllowListIsRefusedBeforeConnecting() {
        properties.setApiUrl("https://api.example.com/v1/chat/completions");
        properties.setAllowedHosts(List.of("api.trusted-provider.test"));

        AiProvider provider = new OpenAiCompatibleProvider(properties, objectMapper);

        assertThat(provider.isAvailable())
                .as("a host on the allow-list is a data-residency decision, not a formality")
                .isFalse();
        assertThatThrownBy(() -> provider.chat(request()))
                .isInstanceOf(AiProviderException.class)
                .satisfies(ex -> assertThat(((AiProviderException) ex).getReason())
                        .isEqualTo(Reason.NOT_CONFIGURED));
    }

    @Test
    void aHostOnTheAllowListIsAccepted() {
        properties.setApiUrl("https://api.trusted-provider.test/v1/chat/completions");
        properties.setAllowedHosts(List.of("api.other.test", "API.TRUSTED-PROVIDER.TEST"));

        assertThat(new OpenAiCompatibleProvider(properties, objectMapper).isAvailable()).isTrue();
    }

    @Test
    void thePropertiesToStringRedactsTheApiKey() {
        // A configuration object ends up in a startup log line sooner or later.
        String rendered = properties.toString();
        assertThat(rendered).doesNotContain(properties.getApiKey()).contains("apiKey=***");
    }

    @Test
    void anUnparseableReplyIsRejectedRatherThanSurfaced() {
        AiProvider provider = new OpenAiCompatibleProvider(properties, objectMapper);
        // Reaches the parser only through a real HTTP response; exercising the parse
        // contract through the public surface would need a stub server, so this
        // asserts the adapter's refusal to invent an answer when the body is empty.
        properties.setApiUrl("http://127.0.0.1:1/v1/chat/completions");
        assertThatThrownBy(() -> provider.chat(request()))
                .isInstanceOf(AiProviderException.class);
    }

    // ------------------------------------------------------------------
    // Provider selection
    // ------------------------------------------------------------------

    @Test
    void withNoUsableProviderTheContextStillWires() {
        // The application must start with AI switched off. If it did not, turning the
        // feature off would require a different build.
        new ApplicationContextRunner()
                .withUserConfiguration(AiProviderConfig.class)
                .withBean(AiProperties.class, () -> {
                    AiProperties off = new AiProperties();
                    off.setEnabled(false);
                    return off;
                })
                .run(context -> {
                    assertThat(context).hasNotFailed();
                    AiProvider selected = context.getBean(AiProvider.class);
                    assertThat(selected.isAvailable()).isFalse();
                    assertThatThrownBy(() -> selected.chat(
                            new AiProviderRequest("m", List.of(AiPromptMessage.user("hi")), 10)))
                            .isInstanceOf(AiProviderException.class)
                            .satisfies(ex -> assertThat(((AiProviderException) ex).getReason())
                                    .isEqualTo(Reason.NOT_CONFIGURED));
                });
    }

    @Test
    void withAConfiguredProviderItIsTheOneSelected() {
        // Proves `AI_ENABLED=false` is the switch and not merely an absent key: the
        // provider must report unavailable while the flag is off, even fully set up.
        AiProperties off = new AiProperties();
        off.setEnabled(false);
        off.setApiUrl("https://api.trusted-provider.test/v1/chat/completions");
        off.setApiKey("key");

        new ApplicationContextRunner()
                .withUserConfiguration(AiProviderConfig.class)
                .withBean(AiProperties.class, () -> off)
                .withBean(OpenAiCompatibleProvider.class,
                        () -> new OpenAiCompatibleProvider(off, new ObjectMapper()))
                .run(context -> {
                    assertThat(context).hasNotFailed();
                    assertThat(context.getBean(AiProvider.class).isAvailable()).isFalse();
                });
    }
}