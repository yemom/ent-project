package com.clinic.config;

import com.clinic.entity.Patient;
import com.clinic.entity.UserRole;
import com.clinic.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
@RequiredArgsConstructor
@Slf4j
public class AdminUserInitializer implements ApplicationRunner {

    @Value("${ADMIN_NAME:ESrom Basazinaw}")
    private String adminName;

    @Value("${ADMIN_EMAIL:12yemom@gmail.com}")
    private String adminEmail;

    @Value("${ADMIN_PASSWORD:12345678}")
    private String adminPassword;

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        // Only create admin if it does not already exist. Do not modify existing accounts on startup.
        boolean exists = userRepository.findByEmail(adminEmail).isPresent();
        if (exists) {
            log.info("Admin account already exists for email={}; skipping creation.", adminEmail);
            return;
        }

        Patient adminUser = Patient.builder()
                .fullName(adminName != null && !adminName.isBlank() ? adminName : "Administrator")
                .email(adminEmail)
                .password(passwordEncoder.encode(adminPassword != null ? adminPassword : "changeme"))
                .role(UserRole.ADMIN)
                .active(true)
                .build();

        userRepository.save(adminUser);
        log.info("Admin user created for email={}", adminEmail);
    }
}
