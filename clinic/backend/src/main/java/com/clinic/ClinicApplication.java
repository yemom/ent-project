package com.clinic;

import com.clinic.config.RateLimitProperties;
import com.clinic.security.jwt.JwtProperties;
import org.springframework.cache.annotation.EnableCaching;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.EnableConfigurationProperties;

@SpringBootApplication
@EnableAsync
@EnableCaching
@EnableConfigurationProperties({JwtProperties.class, RateLimitProperties.class})
public class ClinicApplication {

    public static void main(String[] args) {
        SpringApplication.run(ClinicApplication.class, args);
    }
}
