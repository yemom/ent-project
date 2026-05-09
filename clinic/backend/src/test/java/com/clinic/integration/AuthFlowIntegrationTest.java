package com.clinic.integration;

import com.clinic.dto.request.LoginRequest;
import com.clinic.dto.request.RegisterRequest;
import com.clinic.entity.UserRole;
import com.clinic.repository.TokenBlacklistRepository;
import com.clinic.repository.UserRepository;
import com.clinic.service.AuthService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest(properties = {
    "spring.datasource.url=jdbc:h2:mem:clinice_integration;MODE=PostgreSQL;DB_CLOSE_DELAY=-1;DATABASE_TO_UPPER=false",
    "spring.datasource.driver-class-name=org.h2.Driver",
    "spring.datasource.username=sa",
    "spring.datasource.password=",
    "spring.jpa.hibernate.ddl-auto=create-drop",
    "spring.sql.init.mode=never",
    "spring.flyway.enabled=false"
})
class AuthFlowIntegrationTest {

    @Autowired
    private AuthService authService;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private TokenBlacklistRepository tokenBlacklistRepository;

    @Test
    void registerLoginAndLogoutFlowWorks() {
        RegisterRequest registerRequest = new RegisterRequest("integration.patient@example.com", "Password123!", "Integration Patient", "+15551111", UserRole.PATIENT);
        var registerResponse = authService.register(registerRequest);

        assertNotNull(registerResponse.accessToken());
        assertTrue(userRepository.findByEmail("integration.patient@example.com").isPresent());

        LoginRequest loginRequest = new LoginRequest("integration.patient@example.com", "Password123!");
        var loginResponse = authService.login(loginRequest);

        assertNotNull(loginResponse.accessToken());
        assertEquals("integration.patient@example.com", loginResponse.user().email());

        authService.logout("Bearer " + loginResponse.accessToken());
        assertEquals(1, tokenBlacklistRepository.count());
    }
}
