package com.clinic.controller;

import com.clinic.config.ApiPaths;
import com.clinic.dto.request.LoginRequest;
import com.clinic.dto.request.RegisterRequest;
import com.clinic.dto.response.AuthResponse;
import com.clinic.dto.response.UserSummaryResponse;
import com.clinic.security.CustomUserPrincipal;
import com.clinic.security.CurrentUser;
import com.clinic.security.RolePermissions;
import com.clinic.service.AuthService;
import com.clinic.mapper.UserMapper;
import com.clinic.entity.User;
import jakarta.validation.Valid;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping(ApiPaths.AUTH)
@Slf4j
public class AuthController {

    private final AuthService authService;
    private final CurrentUser currentUser;
    private final UserMapper userMapper;

    public AuthController(AuthService authService, CurrentUser currentUser, UserMapper userMapper) {
        this.authService = authService;
        this.currentUser = currentUser;
        this.userMapper = userMapper;
    }

    @PostMapping("/register")
    public ResponseEntity<AuthResponse> register(@Valid @RequestBody RegisterRequest request) {
        log.info("Register request received for email={}", request.email());
        return ResponseEntity.status(HttpStatus.CREATED).body(authService.register(request));
    }

    @PostMapping("/login")
    public ResponseEntity<AuthResponse> login(@Valid @RequestBody LoginRequest request) {
        log.info("Login request received for email={}", request.email());
        return ResponseEntity.ok(authService.login(request));
    }

    @PostMapping("/refresh")
    public ResponseEntity<AuthResponse> refresh(@RequestBody(required = false) Map<String, String> body) {
        String refreshToken = body != null ? body.get("refreshToken") : null;
        return ResponseEntity.ok(authService.refresh(refreshToken));
    }

    @PostMapping("/logout")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<Void> logout(
            @RequestHeader(name = HttpHeaders.AUTHORIZATION, required = false) String authorizationHeader) {
        log.info("Logout request received");
        authService.logout(authorizationHeader);
        // Also drop refresh tokens so the session cannot be resurrected.
        try {
            authService.revokeAllRefreshTokens(currentUser.userId());
        } catch (Exception e) {
            log.warn("Could not revoke refresh tokens on logout: {}", e.getMessage());
        }
        return ResponseEntity.noContent().build();
    }

    /**
     * Identity of the caller plus the permission set the frontend uses to filter
     * navigation and guard routes. Sourced from the JWT, never from the request.
     */
    @GetMapping("/me")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<Object> me() {
        CustomUserPrincipal principal = currentUser.require();
        User user = principal.getUser();
        UserSummaryResponse userSummary = userMapper.toSummaryResponse(user);
        return ResponseEntity.ok(Map.of(
                "id", userSummary.id(),
                "fullName", userSummary.fullName(),
                "email", userSummary.email(),
                "role", userSummary.role().name(),
                "active", userSummary.active() != null ? userSummary.active() : Boolean.FALSE,
                "permissions", RolePermissions.forRole(user.getRole())
        ));
    }
}