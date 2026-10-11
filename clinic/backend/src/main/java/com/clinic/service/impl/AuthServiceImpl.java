package com.clinic.service.impl;

import com.clinic.dto.request.LoginRequest;
import com.clinic.dto.request.RegisterRequest;
import com.clinic.dto.response.AuthResponse;
import com.clinic.dto.response.UserSummaryResponse;
import com.clinic.entity.RefreshToken;
import com.clinic.entity.TokenBlacklist;
import com.clinic.entity.Patient;
import com.clinic.entity.User;
import com.clinic.entity.UserRole;
import com.clinic.mapper.UserMapper;
import com.clinic.repository.RefreshTokenRepository;
import com.clinic.repository.TokenBlacklistRepository;
import com.clinic.repository.UserRepository;
import com.clinic.security.CustomUserPrincipal;
import com.clinic.security.RolePermissions;
import com.clinic.security.jwt.JwtTokenProvider;
import com.clinic.service.AuditLogService;
import com.clinic.service.AuthService;
import com.clinic.entity.AuditAction;
import com.clinic.exception.BadRequestException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

@Service
@Transactional
@Slf4j
public class AuthServiceImpl implements AuthService {

    private final AuthenticationManager authenticationManager;
    private final PasswordEncoder passwordEncoder;
    private final UserRepository userRepository;
    private final TokenBlacklistRepository tokenBlacklistRepository;
    private final RefreshTokenRepository refreshTokenRepository;
    private final JwtTokenProvider jwtTokenProvider;
    private final UserMapper userMapper;
    private final AuditLogService auditLogService;

    @Value("${app.jwt.refresh-expiration-millis:604800000}")
    private long refreshExpirationMillis;

    public AuthServiceImpl(
            AuthenticationManager authenticationManager,
            PasswordEncoder passwordEncoder,
            UserRepository userRepository,
            TokenBlacklistRepository tokenBlacklistRepository,
            RefreshTokenRepository refreshTokenRepository,
            JwtTokenProvider jwtTokenProvider,
            UserMapper userMapper,
            AuditLogService auditLogService
    ) {
        this.authenticationManager = authenticationManager;
        this.passwordEncoder = passwordEncoder;
        this.userRepository = userRepository;
        this.tokenBlacklistRepository = tokenBlacklistRepository;
        this.refreshTokenRepository = refreshTokenRepository;
        this.jwtTokenProvider = jwtTokenProvider;
        this.userMapper = userMapper;
        this.auditLogService = auditLogService;
    }

    @Override
    public AuthResponse register(RegisterRequest request) {
        log.debug("Registering user with email={}", request.email());
        if (userRepository.existsByEmail(request.email())) {
            throw new IllegalArgumentException("Email already exists");
        }

        if (request.role() != null && request.role() != UserRole.PATIENT) {
            // Self-service registration can only ever create a patient account.
            throw new IllegalArgumentException("Self-registration is only allowed for patient accounts");
        }

        Patient user = Patient.builder()
                .email(request.email())
                .password(passwordEncoder.encode(request.password()))
                .fullName(request.fullName())
                .phone(request.phone())
                .role(UserRole.PATIENT)
                .active(true)
                .build();

        User savedUser = userRepository.save(user);
        return issueToken(savedUser);
    }

    @Override
    @Transactional(readOnly = true)
    public AuthResponse login(LoginRequest request) {
        log.debug("Authenticating user with email={}", request.email());
        Authentication authentication;
        try {
            authentication = authenticationManager.authenticate(
                    new UsernamePasswordAuthenticationToken(request.email(), request.password())
            );
        } catch (BadCredentialsException e) {
            auditLogService.recordAnonymous(request.email(), AuditAction.LOGIN_FAILED, "USER", null,
                    "Invalid credentials", null);
            throw e;
        }

        Object principal = authentication.getPrincipal();
        if (!(principal instanceof CustomUserPrincipal customUserPrincipal)) {
            throw new UsernameNotFoundException("Invalid authentication principal");
        }

        User user = customUserPrincipal.getUser();
        auditLogService.recordAs(customUserPrincipal, AuditAction.LOGIN_SUCCESS, "USER", user.getId(),
                "Web login", null);
        return issueToken(user);
    }

    @Override
    public AuthResponse refresh(String refreshToken) {
        if (refreshToken == null || refreshToken.isBlank()) {
            throw new BadRequestException("A refresh token is required");
        }

        String hash = jwtTokenProvider.hashRefreshToken(refreshToken);
        RefreshToken stored = refreshTokenRepository.findByTokenHash(hash)
                .orElseThrow(() -> new BadRequestException("Invalid refresh token"));

        Instant now = Instant.now();
        if (!stored.isUsable(now)) {
            // A revoked or expired token being presented suggests replay:
            // drop every session for that user.
            revokeAllRefreshTokens(stored.getUserId());
            throw new BadRequestException("Refresh token is no longer valid");
        }

        // Rotation: the presented token is single-use.
        stored.setRevokedAt(now);
        refreshTokenRepository.save(stored);

        User user = userRepository.findById(stored.getUserId())
                .filter(User::getActive)
                .orElseThrow(() -> new BadRequestException("User account is not active"));

        return issueToken(user);
    }

    @Override
    public void logout(String bearerToken) {
        log.debug("Processing logout request");
        if (bearerToken == null || !bearerToken.startsWith("Bearer ")) {
            return;
        }

        String token = bearerToken.substring(7);
        if (!jwtTokenProvider.validateToken(token)) {
            return;
        }

        Instant expiry = jwtTokenProvider.getExpiration(token);
        tokenBlacklistRepository.save(TokenBlacklist.builder()
                .token(token)
                .expiresAt(expiry)
                .blacklistedAt(Instant.now())
                .build());
        log.info("Token blacklisted until {}", expiry);
    }

    @Override
    public void revokeAllRefreshTokens(String userId) {
        Instant now = Instant.now();
        Optional.ofNullable(refreshTokenRepository.findAll())
                .orElse(java.util.List.of())
                .stream()
                .filter(token -> token.getUserId() != null && token.getUserId().equals(userId))
                .filter(token -> token.getRevokedAt() == null)
                .forEach(token -> {
                    token.setRevokedAt(now);
                    refreshTokenRepository.save(token);
                });
        log.info("Revoked refresh tokens for user {}", userId);
    }

    private AuthResponse issueToken(User user) {
        CustomUserPrincipal principal = new CustomUserPrincipal(user);
        Authentication authentication = new UsernamePasswordAuthenticationToken(
                principal,
                null,
                principal.getAuthorities()
        );
        String accessToken = jwtTokenProvider.generateToken(authentication);
        Instant expiresAt = jwtTokenProvider.getExpiration(accessToken);

        String refreshToken = jwtTokenProvider.generateRefreshToken();
        refreshTokenRepository.save(RefreshToken.builder()
                .id(UUID.randomUUID().toString())
                .userId(user.getId())
                .tokenHash(jwtTokenProvider.hashRefreshToken(refreshToken))
                .expiresAt(Instant.now().plusMillis(refreshExpirationMillis))
                .createdAt(Instant.now())
                .build());

        UserSummaryResponse responseUser = userMapper.toSummaryResponse(user);
        return AuthResponse.of(accessToken, refreshToken, expiresAt, responseUser,
                RolePermissions.forRole(user.getRole()));
    }
}