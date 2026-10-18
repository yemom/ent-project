package com.clinic.ai;

import com.clinic.ai.AiProviderException.Reason;
import com.fasterxml.jackson.databind.JsonNode;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/**
 * Any provider exposing an OpenAI-compatible {@code /chat/completions} API.
 *
 * <p>Chosen because it is the lowest common denominator: OpenAI, Azure OpenAI,
 * Ollama, vLLM, LM Studio and most gateways speak it, so a hospital can start with
 * a hosted service, move to a self-hosted model behind its own firewall, or change
 * provider again, by editing {@code AI_API_URL} alone.
 *
 * <h2>Safety properties</h2>
 *
 * <ul>
 *   <li>The key is set as an {@code Authorization} header and never appears in a log
 *       line, an exception message or a response body.</li>
 *   <li>The destination host is validated against {@code AI_ALLOWED_HOSTS} before
 *       the connection is made, so a misconfiguration cannot redirect clinical
 *       context to an unintended host.</li>
 *   <li>Connect and request timeouts are both set; an unresponsive provider costs a
 *       request timeout, not a hung thread.</li>
 *   <li>Only the first choice's text is read back. Provider-specific extras,
 *       reasoning traces and tool fragments are dropped at the boundary.</li>
 * </ul>
 */
@Component
@Slf4j
public class OpenAiCompatibleProvider implements AiProvider {

    private static final String PROVIDER_NAME = "openai-compatible";

    private final AiProperties properties;
    private final HttpClient httpClient;
    private final com.fasterxml.jackson.databind.ObjectMapper objectMapper;

    public OpenAiCompatibleProvider(AiProperties properties,
                                    com.fasterxml.jackson.databind.ObjectMapper objectMapper) {
        this.properties = properties;
        this.objectMapper = objectMapper;
        this.httpClient = HttpClient.newBuilder()
                // Shorter than the request timeout so a hung connection fails as
                // a connect timeout rather than consuming the whole budget.
                .connectTimeout(Duration.ofSeconds(5))
                .followRedirects(HttpClient.Redirect.NEVER)
                .build();
    }

    @Override
    public String name() {
        return PROVIDER_NAME;
    }

    @Override
    public boolean isAvailable() {
        return properties.isConfigured() && hostIsAllowed(properties.getApiUrl());
    }

    @Override
    public AiProviderResponse chat(AiProviderRequest request) {
        if (!properties.isConfigured()) {
            throw new AiProviderException(Reason.NOT_CONFIGURED,
                    "AI is not configured on this deployment");
        }
        if (!hostIsAllowed(properties.getApiUrl())) {
            throw new AiProviderException(Reason.NOT_CONFIGURED,
                    "The configured AI endpoint host is not on the allow-list");
        }

        String body;
        try {
            body = objectMapper.writeValueAsString(buildPayload(request));
        } catch (Exception ex) {
            // Serialising our own request cannot fail in any way worth retrying, so
            // this is reported as a provider-side problem rather than propagated as
            // an unexpected exception type.
            throw new AiProviderException(Reason.INVALID_REQUEST,
                    "The AI request could not be prepared", ex);
        }

        HttpRequest httpRequest = HttpRequest.newBuilder()
                .uri(URI.create(properties.getApiUrl()))
                .timeout(Duration.ofMillis(properties.getRequestTimeoutMillis()))
                .header("Content-Type", "application/json")
                .header("Accept", "application/json")
                .header("Authorization", "Bearer " + properties.getApiKey())
                .POST(HttpRequest.BodyPublishers.ofString(body))
                .build();

        HttpResponse<String> response;
        try {
            response = httpClient.send(httpRequest, HttpResponse.BodyHandlers.ofString());
        } catch (java.net.http.HttpTimeoutException ex) {
            throw new AiProviderException(Reason.TIMEOUT,
                    "The AI provider did not respond within " + properties.getRequestTimeoutMillis() + "ms", ex);
        } catch (java.io.IOException ex) {
            // The message can carry the host and port; it is logged at warn without
            // the request body, which is the part that would contain clinical data.
            log.warn("AI provider transport failure: {}", ex.getClass().getSimpleName());
            throw new AiProviderException(Reason.TRANSPORT_ERROR, "The AI provider could not be reached", ex);
        } catch (InterruptedException ex) {
            Thread.currentThread().interrupt();
            throw new AiProviderException(Reason.TRANSPORT_ERROR, "The AI request was interrupted", ex);
        }

        if (response.statusCode() / 100 != 2) {
            // The body is not logged: providers echo request content in error
            // responses, and that content is authorised patient data.
            log.warn("AI provider returned HTTP {}", response.statusCode());
            com.clinic.ai.AiProviderException.Reason reason =
                    response.statusCode() == 429
                            ? com.clinic.ai.AiProviderException.Reason.RATE_LIMITED
                            : com.clinic.ai.AiProviderException.Reason.PROVIDER_ERROR;
            throw new AiProviderException(reason,
                    "The AI provider returned an error (HTTP " + response.statusCode() + ")");
        }

        return parse(response.body());
    }

    private Map<String, Object> buildPayload(AiProviderRequest request) {
        List<Map<String, String>> messages = request.messages().stream()
                .map(m -> Map.of("role", m.role(), "content", m.content()))
                .toList();

        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("model", request.model());
        payload.put("messages", messages);
        payload.put("max_tokens", request.maxOutTokens());
        // Near-zero temperature: this assistant reads records and reports numbers,
        // and a creative answer to "how many patients cancelled" is a defect.
        payload.put("temperature", 0);
        return payload;
    }

    private AiProviderResponse parse(String body) {
        JsonNode root;
        try {
            root = objectMapper.readTree(body);
        } catch (Exception ex) {
            throw new AiProviderException(Reason.INVALID_RESPONSE,
                    "The AI provider returned a response that could not be parsed", ex);
        }

        JsonNode choices = root.path("choices");
        if (!choices.isArray() || choices.isEmpty()) {
            throw new AiProviderException(Reason.INVALID_RESPONSE,
                    "The AI provider returned no choices");
        }

        String text = choices.get(0).path("message").path("content").asText(null);
        if (text == null || text.isBlank()) {
            throw new AiProviderException(Reason.INVALID_RESPONSE,
                    "The AI provider returned an empty completion");
        }

        JsonNode usage = root.path("usage");
        return new AiProviderResponse(
                text,
                usage.path("prompt_tokens").isNumber() ? usage.path("prompt_tokens").asInt() : null,
                usage.path("completion_tokens").isNumber() ? usage.path("completion_tokens").asInt() : null,
                root.path("model").asText(null));
    }

    /**
     * Whether the configured URL points somewhere this deployment permits.
     *
     * <p>An empty allow-list means "the configured URL is trusted", which is the
     * right default when the URL comes from deployment configuration the operator
     * controls. Populating it adds a second gate for deployments that must satisfy
     * a data-residency or vendor policy.
     */
    private boolean hostIsAllowed(String apiUrl) {
        if (apiUrl == null || apiUrl.isBlank()) {
            return false;
        }
        List<String> allowed = properties.getAllowedHosts();
        if (allowed == null || allowed.isEmpty()) {
            return true;
        }
        String host;
        try {
            host = URI.create(apiUrl).getHost();
        } catch (IllegalArgumentException ex) {
            return false;
        }
        if (host == null) {
            return false;
        }
        return allowed.stream().anyMatch(entry -> entry.equalsIgnoreCase(host));
    }

    @Override
    public String toString() {
        return "OpenAiCompatibleProvider{name='" + PROVIDER_NAME.toLowerCase(Locale.ROOT)
                + "', configured=" + isAvailable() + '}';
    }
}