package com.clinic.service;

import com.clinic.entity.UserRole;
import com.clinic.mapper.UserMapper;
import com.clinic.repository.RefreshTokenRepository;
import com.clinic.repository.TokenBlacklistRepository;
import com.clinic.repository.UserRepository;
import com.clinic.security.jwt.JwtTokenProvider;
import com.clinic.service.impl.AuthServiceImpl;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;
import java.util.UUID;

import static com.clinic.support.TestFixtures.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AuthServiceImplTest {

    @Mock private AuthenticationManager authenticationManager;
    @Mock private PasswordEncoder passwordEncoder;
    @Mock private UserRepository userRepository;
    @Mock private TokenBlacklistRepository tokenBlacklistRepository;
    @Mock private RefreshTokenRepository refreshTokenRepository;
    @Mock private JwtTokenProvider jwtTokenProvider;
    @Mock private AuditLogService auditLogService;
    private final UserMapper userMapper = new UserMapper();
    private AuthServiceImpl authService;

    @org.junit.jupiter.api.BeforeEach
    void setUp() {
        authService = new AuthServiceImpl(authenticationManager, passwordEncoder, userRepository,
                tokenBlacklistRepository, refreshTokenRepository, jwtTokenProvider, userMapper, auditLogService);
    }

    @Test
    void registerCreatesUser() {
        when(userRepository.existsByEmail("patient@example.com")).thenReturn(false);
        when(passwordEncoder.encode(any())).thenReturn("encoded");
        when(userRepository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));
        when(jwtTokenProvider.generateToken(any())).thenReturn("test-token");
        when(jwtTokenProvider.getExpiration("test-token")).thenReturn(java.time.Instant.now().plusSeconds(3600));
        when(jwtTokenProvider.generateRefreshToken()).thenReturn("refresh-token");
        when(jwtTokenProvider.hashRefreshToken(any())).thenReturn("hash");

        var response = authService.register(registerRequest());

        assertEquals(UserRole.PATIENT, response.user().role());
        // The permission set travels with the session so the frontend can gate UI.
        assertTrue(response.permissions().contains("appointment:manage"));
        assertEquals("refresh-token", response.refreshToken());
    }
}
