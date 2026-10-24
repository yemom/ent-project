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
import java.util.Map;

/**
 * Adapter for a local Ollama server's native {@code /api/chat} endpoint.
 *
 * <p>The adapter deliberately has no API-key requirement. The deployment boundary
 * is the local Ollama host, which is still checked against the configured host
 * allow-list before clinical context leaves the application process.
 */
@Component
@Slf4j
public class OllamaProvider implements AiProvider {

    private static final String PROVIDER_NAME = "local-ollama";

    private final AiProperties properties;
    private final HttpClient httpClient;
    private final com.fasterxml.jackson.databind.ObjectMapper objectMapper;

    public OllamaProvider(AiProperties properties,
                          com.fasterxml.jackson.databind.ObjectMapper objectMapper) {
        this.properties = properties;
        this.objectMapper = objectMapper;
        this.httpClient = HttpClient.newBuilder()
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
        return properties.isConfiguredFor(PROVIDER_NAME) && hostIsAllowed(properties.getApiUrl());
    }

    @Override
    public AiProviderResponse chat(AiProviderRequest request) {
        if (!properties.isConfiguredFor(PROVIDER_NAME)) {
            throw new AiProviderException(Reason.NOT_CONFIGURED,
                    "Local Ollama is not configured on this deployment");
        }
        if (!hostIsAllowed(properties.getApiUrl())) {
            throw new AiProviderException(Reason.NOT_CONFIGURED,
                    "The configured Ollama host is not on the allow-list");
        }

        final String body;
        try {
            body = objectMapper.writeValueAsString(buildPayload(request));
        } catch (Exception ex) {
            throw new AiProviderException(Reason.INVALID_REQUEST,
                    "The Ollama request could not be prepared", ex);
        }

        HttpRequest httpRequest = HttpRequest.newBuilder()
                .uri(URI.create(chatUri(properties.getApiUrl())))
                .timeout(Duration.ofMillis(properties.getRequestTimeoutMillis()))
                .header("Content-Type", "application/json")
                .header("Accept", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(body))
                .build();

        HttpResponse<String> response;
        try {
            response = httpClient.send(httpRequest, HttpResponse.BodyHandlers.ofString());
        } catch (java.net.http.HttpTimeoutException ex) {
            throw new AiProviderException(Reason.TIMEOUT,
                    "Ollama did not respond within " + properties.getRequestTimeoutMillis() + "ms", ex);
        } catch (java.io.IOException ex) {
            log.warn("Ollama transport failure: {}", ex.getClass().getSimpleName());
            throw new AiProviderException(Reason.TRANSPORT_ERROR,
                    "The local Ollama server could not be reached", ex);
        } catch (InterruptedException ex) {
            Thread.currentThread().interrupt();
            throw new AiProviderException(Reason.TRANSPORT_ERROR,
                    "The Ollama request was interrupted", ex);
        }

        if (response.statusCode() / 100 != 2) {
            log.warn("Ollama returned HTTP {}", response.statusCode());
            throw new AiProviderException(
                    response.statusCode() == 429 ? Reason.RATE_LIMITED : Reason.PROVIDER_ERROR,
                    "Ollama returned an error (HTTP " + response.statusCode() + ")");
        }
        return parse(response.body());
    }

    private Map<String, Object> buildPayload(AiProviderRequest request) {
        List<Map<String, String>> messages = request.messages().stream()
                .map(message -> Map.of("role", message.role(), "content", message.content()))
                .toList();
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("model", request.model());
        payload.put("messages", messages);
        payload.put("stream", false);
        payload.put("options", Map.of("temperature", 0, "num_predict", request.maxOutTokens()));
        return payload;
    }

    private AiProviderResponse parse(String body) {
        final JsonNode root;
        try {
            root = objectMapper.readTree(body);
        } catch (Exception ex) {
            throw new AiProviderException(Reason.INVALID_RESPONSE,
                    "Ollama returned a response that could not be parsed", ex);
        }
        String text = root.path("message").path("content").asText(null);
        if (text == null || text.isBlank()) {
            throw new AiProviderException(Reason.INVALID_RESPONSE,
                    "Ollama returned an empty completion");
        }
        JsonNode promptCount = root.path("prompt_eval_count");
        JsonNode outputCount = root.path("eval_count");
        return new AiProviderResponse(
                text,
                promptCount.isNumber() ? promptCount.asInt() : null,
                outputCount.isNumber() ? outputCount.asInt() : null,
                root.path("model").asText(null));
    }

    private String chatUri(String configuredUrl) {
        String base = configuredUrl.endsWith("/") ? configuredUrl.substring(0, configuredUrl.length() - 1) : configuredUrl;
        return base.endsWith("/api/chat") ? base : base + "/api/chat";
    }

    private boolean hostIsAllowed(String configuredUrl) {
        if (configuredUrl == null || configuredUrl.isBlank()) {
            return false;
        }
        List<String> allowed = properties.getAllowedHosts();
        if (allowed == null || allowed.isEmpty()) {
            return true;
        }
        try {
            String host = URI.create(configuredUrl).getHost();
            return host != null && allowed.stream().anyMatch(entry -> entry.equalsIgnoreCase(host));
        } catch (IllegalArgumentException ex) {
            return false;
        }
    }

    @Override
    public String toString() {
        return "OllamaProvider{configured=" + isAvailable() + '}';
    }
}
