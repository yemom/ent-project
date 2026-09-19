package com.clinic.config;

import com.zaxxer.hikari.HikariConfig;
import com.zaxxer.hikari.HikariDataSource;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;
import org.springframework.util.StringUtils;

import javax.sql.DataSource;
import java.net.URI;

@Configuration
@Slf4j
public class DatabaseConfig {

    @Value("${spring.datasource.url:${DATABASE_URL:}}")
    private String rawUrl;

    @Value("${spring.datasource.username:}")
    private String username;

    @Value("${spring.datasource.password:}")
    private String password;

    @Value("${spring.datasource.driver-class-name:org.postgresql.Driver}")
    private String driverClassName;

    @Value("${spring.datasource.hikari.maximum-pool-size:15}")
    private int maxPoolSize;

    @Value("${spring.datasource.hikari.minimum-idle:2}")
    private int minIdle;

    @Value("${spring.datasource.hikari.connection-timeout:30000}")
    private long connectionTimeout;

    @Bean
    @Primary
    public DataSource dataSource() {
        HikariConfig config = new HikariConfig();

        String resolvedUrl = rawUrl != null ? rawUrl.trim() : "";
        String resolvedUsername = username != null ? username.trim() : "";
        String resolvedPassword = password != null ? password.trim() : "";

        if (StringUtils.hasText(resolvedUrl)) {
            // Automatically handle Render / Supabase postgres:// or postgresql:// URLs
            if (resolvedUrl.startsWith("postgres://") || resolvedUrl.startsWith("postgresql://")) {
                try {
                    String cleanUrl = resolvedUrl.startsWith("postgres://")
                            ? "postgresql://" + resolvedUrl.substring("postgres://".length())
                            : resolvedUrl;

                    URI uri = new URI(cleanUrl);
                    if (uri.getUserInfo() != null) {
                        String[] userInfo = uri.getUserInfo().split(":", 2);
                        if (!StringUtils.hasText(resolvedUsername)) {
                            resolvedUsername = userInfo[0];
                        }
                        if (userInfo.length > 1 && !StringUtils.hasText(resolvedPassword)) {
                            resolvedPassword = userInfo[1];
                        }
                    }

                    int port = uri.getPort() == -1 ? 5432 : uri.getPort();
                    String dbPath = uri.getPath();
                    if (dbPath != null && dbPath.startsWith("/")) {
                        dbPath = dbPath.substring(1);
                    }

                    resolvedUrl = "jdbc:postgresql://" + uri.getHost() + ":" + port + "/" + dbPath;
                    if (uri.getQuery() != null) {
                        resolvedUrl += "?" + uri.getQuery();
                    }
                    log.info("Converted cloud postgres URI to standard JDBC format: jdbc:postgresql://{}:{}/{}", uri.getHost(), port, dbPath);
                } catch (Exception e) {
                    log.warn("Could not parse postgres URI, falling back to direct string: {}", e.getMessage());
                }
            }
        }

        if (!StringUtils.hasText(resolvedUrl)) {
            resolvedUrl = "jdbc:postgresql://localhost:5432/clinic_db";
        }

        config.setJdbcUrl(resolvedUrl);
        if (StringUtils.hasText(resolvedUsername)) {
            config.setUsername(resolvedUsername);
        }
        if (StringUtils.hasText(resolvedPassword)) {
            config.setPassword(resolvedPassword);
        }
        config.setDriverClassName(driverClassName);
        config.setMaximumPoolSize(maxPoolSize);
        config.setMinimumIdle(minIdle);
        config.setConnectionTimeout(connectionTimeout);
        config.setPoolName("ClinicHikariPool");

        return new HikariDataSource(config);
    }
}
