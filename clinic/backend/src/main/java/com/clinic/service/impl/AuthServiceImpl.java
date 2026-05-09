package com.clinic.service.impl;

import com.clinic.dto.request.LoginRequest;
import com.clinic.dto.request.RegisterRequest;
import com.clinic.dto.response.AuthResponse;
import com.clinic.dto.response.UserSummaryResponse;
import com.clinic.entity.TokenBlacklist;
import com.clinic.entity.Patient;
import com.clinic.entity.User;
import com.clinic.entity.UserRole;
import com.clinic.mapper.UserMapper;
import com.clinic.repository.TokenBlacklistRepository;
import com.clinic.repository.UserRepository;
import com.clinic.security.CustomUserPrincipal;
import com.clinic.security.jwt.JwtTokenProvider;
import com.clinic.service.AuthService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;

@Service
@Transactional
@Slf4j
public class AuthServiceImpl implements AuthService {

    private final AuthenticationManager authenticationManager;
    private final PasswordEncoder passwordEncoder;
    private final UserRepository userRepository;
    private final TokenBlacklistRepository tokenBlacklistRepository;
    private final JwtTokenProvider jwtTokenProvider;
    private final UserMapper userMapper;

    public AuthServiceImpl(
            AuthenticationManager authenticationManager,
            PasswordEncoder passwordEncoder,
            UserRepository userRepository,
            TokenBlacklistRepository tokenBlacklistRepository,
            JwtTokenProvider jwtTokenProvider,
            UserMapper userMapper
    ) {
        this.authenticationManager = authenticationManager;
        this.passwordEncoder = passwordEncoder;
        this.userRepository = userRepository;
        this.tokenBlacklistRepository = tokenBlacklistRepository;
        this.jwtTokenProvider = jwtTokenProvider;
        this.userMapper = userMapper;
    }

    @Override
    public AuthResponse register(RegisterRequest request) {
        log.debug("Registering user with email={}", request.email());
        if (userRepository.existsByEmail(request.email())) {
            throw new IllegalArgumentException("Email already exists");
        }

        if (request.role() != null && request.role() != UserRole.PATIENT) {
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
        Authentication authentication = authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(request.email(), request.password())
        );

        Object principal = authentication.getPrincipal();
        if (!(principal instanceof CustomUserPrincipal customUserPrincipal)) {
            throw new UsernameNotFoundException("Invalid authentication principal");
        }

        return issueToken(customUserPrincipal.getUser());
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

    private AuthResponse issueToken(User user) {
        CustomUserPrincipal principal = new CustomUserPrincipal(user);
        Authentication authentication = new UsernamePasswordAuthenticationToken(
                principal,
                null,
                principal.getAuthorities()
        );
        String token = jwtTokenProvider.generateToken(authentication);
        Instant expiresAt = jwtTokenProvider.getExpiration(token);
        UserSummaryResponse responseUser = userMapper.toSummaryResponse(user);
        return AuthResponse.of(token, expiresAt, responseUser);
    }
}
