package com.clinic.service;

import com.clinic.dto.request.LoginRequest;
import com.clinic.dto.request.RegisterRequest;
import com.clinic.dto.response.AuthResponse;

public interface AuthService {

    AuthResponse register(RegisterRequest request);

    AuthResponse login(LoginRequest request);

    /** Exchanges a refresh token for a new pair, rotating the presented token. */
    AuthResponse refresh(String refreshToken);

    void logout(String bearerToken);

    /** Revokes every refresh token for a user (password change, forced sign-out). */
    void revokeAllRefreshTokens(String userId);
}