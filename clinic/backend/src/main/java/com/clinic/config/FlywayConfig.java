package com.clinic.config;

import lombok.extern.slf4j.Slf4j;
import org.flywaydb.core.Flyway;
import org.springframework.boot.autoconfigure.flyway.FlywayMigrationStrategy;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
@Slf4j
public class FlywayConfig {

    @Bean
    public FlywayMigrationStrategy flywayMigrationStrategy() {
        return flyway -> {
            log.info("Running Flyway repair to clear any failed migration entries...");
            try {
                flyway.repair();
            } catch (Exception e) {
                log.warn("Flyway repair returned: {}", e.getMessage());
            }
            log.info("Running Flyway migration...");
            flyway.migrate();
            log.info("Flyway migration successfully completed.");
        };
    }
}
