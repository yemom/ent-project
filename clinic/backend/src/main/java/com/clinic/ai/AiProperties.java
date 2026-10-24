package com.clinic.ai;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;

/**
 * AI provider configuration, bound to {@code ai.*}.
 *
 * <p>Every value is a placeholder resolved from the environment. There is no
 * default API URL, no default key and no default model: with {@code AI_ENABLED}
 * unset the whole feature is off and the endpoints report that honestly, which is
 * the only safe default for a hospital system.
 *
 * <p>Credentials live here, server-side, and nowhere else. Nothing in this class
 * is ever serialised into an HTTP response — see {@code toString()} below.
 */
@Component
@ConfigurationProperties(prefix = "ai")
public class AiProperties {

    /** Master switch. When false every AI endpoint answers "unavailable". */
    private boolean enabled = false;

    /** Provider identifier, e.g. {@code openai-compatible}. */
    private String provider = "openai-compatible";

    /** Base URL of an OpenAI-compatible {@code /chat/completions} endpoint. */
    private String apiUrl = "";

    /** Model name passed through to the provider. */
    private String model = "";

    /** Server-side secret. Never sent to the browser, never logged. */
    private String apiKey = "";

    /** Whole-request budget, in milliseconds. */
    private int requestTimeoutMillis = 20_000;

    /** Caps the response so a runaway generation cannot become a billing event. */
    private int maxOutputTokens = 700;

    /** Upper bound on the user's own message, in characters. */
    private int maxInputChars = 4_000;

    /** Turns of history replayed to the provider. */
    private int maxHistoryTurns = 8;

    /** Per-user request budget over a rolling window. */
    private int requestsPerWindow = 30;

    public int requestsWindowMinutes = 10;

    /**
     * Send only counts, dates and categories to the provider; never names,
     * diagnoses, free text or contact details.
     *
     * <p>Default {@code true}, and that default is the point. A deployment has to
     * opt in, in writing, to transmitting identifiable clinical information to a
     * third party, which is a privacy decision rather than a technical one.
     */
    private boolean allowIdentifiableData = false;

    /**
     * Hostnames the provider is permitted to send data to.
     *
     * <p>An empty list means "any host named by {@link #apiUrl}", which is
     * sufficient when the URL is fixed in configuration and removes a way for a
     * mistake to silently redirect clinical data somewhere else.
     */
    private List<String> allowedHosts = new ArrayList<>();

    public boolean isConfigured() {
        return isConfiguredFor(provider);
    }

    public boolean isConfiguredFor(String providerName) {
        boolean hasEndpoint = apiUrl != null && !apiUrl.isBlank();
        boolean hasModel = model != null && !model.isBlank();
        boolean localProvider = "local-ollama".equalsIgnoreCase(providerName);
        boolean hasKey = apiKey != null && !apiKey.isBlank() && !apiKey.startsWith("REPLACE_WITH_");
        return enabled && hasEndpoint && hasModel && (localProvider || hasKey);
    }

    public boolean isEnabled() {
        return enabled;
    }

    public void setEnabled(boolean enabled) {
        this.enabled = enabled;
    }

    public String getProvider() {
        return provider;
    }

    public void setProvider(String provider) {
        this.provider = provider;
    }

    public String getApiUrl() {
        return apiUrl;
    }

    public void setApiUrl(String apiUrl) {
        this.apiUrl = apiUrl;
    }

    public String getModel() {
        return model;
    }

    public void setModel(String model) {
        this.model = model;
    }

    public String getApiKey() {
        return apiKey;
    }

    public void setApiKey(String apiKey) {
        this.apiKey = apiKey;
    }

    public int getRequestTimeoutMillis() {
        return requestTimeoutMillis;
    }

    public void setRequestTimeoutMillis(int requestTimeoutMillis) {
        this.requestTimeoutMillis = requestTimeoutMillis;
    }

    public int getMaxOutputTokens() {
        return maxOutputTokens;
    }

    public void setMaxOutputTokens(int maxOutputTokens) {
        this.maxOutputTokens = maxOutputTokens;
    }

    public int getMaxInputChars() {
        return maxInputChars;
    }

    public void setMaxInputChars(int maxInputChars) {
        this.maxInputChars = maxInputChars;
    }

    public int getMaxHistoryTurns() {
        return maxHistoryTurns;
    }

    public void setMaxHistoryTurns(int maxHistoryTurns) {
        this.maxHistoryTurns = maxHistoryTurns;
    }

    public int getRequestsPerWindow() {
        return requestsPerWindow;
    }

    public void setRequestsPerWindow(int requestsPerWindow) {
        this.requestsPerWindow = requestsPerWindow;
    }

    public int getRequestsWindowMinutes() {
        return requestsWindowMinutes;
    }

    public void setRequestsWindowMinutes(int requestsWindowMinutes) {
        this.requestsWindowMinutes = requestsWindowMinutes;
    }

    public boolean isAllowIdentifiableData() {
        return allowIdentifiableData;
    }

    public void setAllowIdentifiableData(boolean allowIdentifiableData) {
        this.allowIdentifiableData = allowIdentifiableData;
    }

    public List<String> getAllowedHosts() {
        return allowedHosts;
    }

    /**
     * Binds {@code AI_ALLOWED_HOSTS}, which arrives as a comma-separated string.
     *
     * <p>Blanks are dropped so that leaving the variable unset yields an empty list
     * — "trust the configured URL" — rather than a list containing one empty string,
     * which would match no host and silently disable every request.
     */
    public void setAllowedHosts(List<String> allowedHosts) {
        List<String> cleaned = new java.util.ArrayList<>();
        if (allowedHosts != null) {
            for (String host : allowedHosts) {
                if (host != null && !host.isBlank()) {
                    for (String part : host.split(",")) {
                        String trimmed = part.trim();
                        if (!trimmed.isEmpty()) {
                            cleaned.add(trimmed);
                        }
                    }
                }
            }
        }
        this.allowedHosts = cleaned;
    }

    /**
     * Redacted by construction.
     *
     * <p>{@link #apiKey} is excluded outright rather than masked: a partially
     * revealed key still belongs in no log line, and Lombok's generated
     * {@code toString()} would otherwise include every field.
     */
    @Override
    public String toString() {
        return "AiProperties{enabled=" + enabled
                + ", provider='" + provider + '\''
                + ", apiUrl='" + apiUrl + '\''
                + ", model='" + model + '\''
                + ", apiKey=***"
                + ", allowIdentifiableData=" + allowIdentifiableData + '}';
    }
}