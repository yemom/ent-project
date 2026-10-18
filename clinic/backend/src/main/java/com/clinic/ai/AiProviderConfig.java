package com.clinic.ai;

import com.clinic.ai.AiProviderException.Reason;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;

/**
 * Provider selection.
 *
 * <p>Two beans can exist: the concrete providers (today, one
 * {@link OpenAiCompatibleProvider}) and this selection bean, which is marked
 * {@link Primary} so that every injection point of {@link AiProvider} resolves to
 * the chosen one.
 *
 * <p>Candidates are collected by concrete type rather than by injecting
 * {@code List<AiProvider>}. Injecting the interface would put this very bean in
 * its own candidate list, which is a circular dependency that only shows up once
 * the context is fully assembled. Adding a second provider means naming it here,
 * which is the point: the set of providers a deployment can use should be an
 * explicit decision, not whatever happens to be on the classpath.
 */
@Configuration
@Slf4j
public class AiProviderConfig {

    @Bean
    @Primary
    public AiProvider aiProvider(ObjectProvider<OpenAiCompatibleProvider> candidates,
                                 AiProperties properties) {
        for (OpenAiCompatibleProvider candidate : candidates) {
            if (candidate.isAvailable()) {
                log.info("AI assistant enabled with the {} provider (model={})",
                        candidate.name(), properties.getModel());
                return candidate;
            }
        }

        // Nothing usable. The application still starts, and every AI call reports
        // the feature as unavailable rather than failing.
        log.info("AI assistant unavailable: no configured provider is usable (enabled={}, apiUrlSet={}, apiKeySet={})",
                properties.isEnabled(),
                properties.getApiUrl() != null && !properties.getApiUrl().isBlank(),
                properties.getApiKey() != null && !properties.getApiKey().isBlank());
        return new UnavailableAiProvider(properties);
    }

    /**
     * Stand-in for "no usable provider".
     *
     * <p>Exists so the application context always wires, and so every call site has
     * exactly one thing to check. Callers reach it as a normal
     * {@link Reason#NOT_CONFIGURED}, which the same error mapping handles as a
     * misconfigured deployment would.
     */
    static final class UnavailableAiProvider implements AiProvider {

        private final AiProperties properties;

        UnavailableAiProvider(AiProperties properties) {
            this.properties = properties;
        }

        @Override
        public String name() {
            return "unavailable";
        }

        @Override
        public boolean isAvailable() {
            return false;
        }

        @Override
        public AiProviderResponse chat(AiProviderRequest request) {
            throw new AiProviderException(Reason.NOT_CONFIGURED,
                    "The AI assistant is not available on this deployment");
        }

        @Override
        public String toString() {
            return "UnavailableAiProvider{enabled=" + properties.isEnabled() + '}';
        }
    }
}