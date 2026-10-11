package com.clinic.config;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.flyway.FlywayMigrationStrategy;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
@Slf4j
public class FlywayConfig {

    /**
     * flyway.repair() runs two extra statements on every boot. It is kept for
     * self-healing failed migrations, but can be switched off to shave startup time.
     */
    @Value("${spring.flyway.repair-on-startup:true}")
    private boolean repairOnStartup;

    @Bean
    public FlywayMigrationStrategy flywayMigrationStrategy() {
        return flyway -> {
            if (repairOnStartup) {
                log.info("Running Flyway repair to clear any failed migration entries...");
                try {
                    flyway.repair();
                } catch (Exception e) {
                    log.warn("Flyway repair returned: {}", e.getMessage());
                }
            }
            log.info("Running Flyway migration...");
            flyway.migrate();
            log.info("Flyway migration successfully completed.");
        };
    }
}